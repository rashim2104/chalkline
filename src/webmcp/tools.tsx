import { useWebMCP } from 'use-webmcp-tool'
import {
  addComponent,
  annotateComponent,
  attachCache,
  attachConsumer,
  connectComponents,
  describeComponent,
  detachDependency,
  removeComponent,
  routeIngress,
  useScope,
  useStore,
} from '../lib/store'
import type { Outcome } from '../lib/rules'

const READ_ONLY = { readOnlyHint: true, untrustedContentHint: false } as const
const MUTATING = { readOnlyHint: false, untrustedContentHint: false } as const

/**
 * A refusal is a successful tool call that reports a boundary. Returning it as
 * text (rather than throwing) is deliberate: the agent gets the rule, whose
 * rule it is, and what would unblock it, so the next attempt can be correct.
 */
const say = (outcome: Outcome<string>): string =>
  outcome.ok
    ? outcome.value
    : [
        `REFUSED (${outcome.code}).`,
        outcome.message,
        `Rule: ${outcome.rule}`,
        `Set by: ${outcome.ruleOwner === 'scope' ? 'the operator, via the scope region' : 'this architecture'}`,
        `To proceed: ${outcome.unblock}`,
      ].join(' ')

const PROTOCOLS = ['http', 'grpc', 'sql', 'redis', 'amqp', 's3'] as const
const KINDS = ['service', 'worker', 'database', 'cache', 'queue', 'storage', 'gateway'] as const

export function ChalklineTools() {
  const scope = useScope()
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)

  const can = (c: string) => scope.capabilities.includes(c as never)
  const allIds = nodes.map((n) => n.id)
  const scopedIds = scope.ids
  const scopedEdgeIds = edges
    .filter((e) => scopedIds.includes(e.source) && scopedIds.includes(e.target))
    .map((e) => e.id)
  const removableIds = scope.scoped
    .filter((n) => n.data.kind !== 'external')
    .map((n) => n.id)
  const cacheableIds = scope.scoped
    .filter((n) => n.data.kind === 'service' || n.data.kind === 'worker')
    .map((n) => n.id)
  const queueIds = scope.scoped.filter((n) => n.data.kind === 'queue').map((n) => n.id)
  const entrypointIds = scope.scoped
    .filter((n) => n.data.kind === 'edge' || n.data.kind === 'gateway')
    .map((n) => n.id)
  const region = scope.rect
    ? `The scope region currently holds ${scope.scoped.length} component(s): ${scopedIds.join(', ')}.`
    : 'No scope region is active, so nothing may be modified.'

  // ---------------------------------------------------------------- read

  useWebMCP({
    name: 'list_components',
    description:
      'List every component in this architecture, with its kind, subsystem, criticality tier, and whether it currently lies inside the operator scope region.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
    execute: () =>
      nodes
        .map(
          (n) =>
            `${n.id} | ${n.data.kind} | ${n.data.subsystem} | ${n.data.criticality} | ${
              scopedIds.includes(n.id) ? 'IN SCOPE' : 'out of scope'
            } | ${n.data.detail}`,
        )
        .join('\n'),
  })

  useWebMCP({
    name: 'list_dependencies',
    description:
      'List every dependency edge in this architecture as "source -> target (protocol)", with its stable id.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
    execute: () =>
      edges.map((e) => `${e.id} | ${e.source} -> ${e.target} | ${e.data?.protocol}`).join('\n'),
  })

  useWebMCP({
    name: 'get_scope',
    description:
      'Report the operator scope region: which components it contains, which subsystems they belong to, and therefore which editing tools are currently registered.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
    execute: () =>
      [
        region,
        scope.subsystems.length ? `Subsystems in scope: ${scope.subsystems.join(', ')}.` : '',
        `Editing tools currently registered: ${scope.capabilities.length ? scope.capabilities.join(', ') : 'none'}.`,
        'Components outside the region cannot be named as targets: they are absent from the tool schemas.',
      ]
        .filter(Boolean)
        .join(' '),
  })

  useWebMCP({
    name: 'describe_component',
    description:
      'Describe one component: what it is, what it depends on, and what depends on it. Read-only, so it works for any component whether or not it is in scope.',
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string', enum: allIds, description: 'Component id.' },
      },
      required: ['component'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    execute: ({ component }: { component: string }) => say(describeComponent('agent', component)),
  })

  // ------------------------------------------------------------- scoped
  // Every schema below narrows its target enum to the scope region. When the
  // region changes, the enum changes, the hook re-registers, and the agent's
  // vocabulary changes with it.

  useWebMCP({
    name: 'add_component',
    description: `Add a new component inside the operator scope region. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Short name, e.g. "sessions-cache".' },
        kind: { type: 'string', enum: [...KINDS] },
        detail: { type: 'string', description: 'One line on sizing or runtime.' },
      },
      required: ['label', 'kind', 'detail'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('add_component'),
    execute: (spec: { label: string; kind: string; detail: string }) =>
      say(addComponent('agent', spec as never)),
  })

  useWebMCP({
    name: 'connect_components',
    description: `Declare that one component depends on another. The source must lie inside the scope region. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: scopedIds, description: 'Caller. Must be in scope.' },
        target: { type: 'string', enum: allIds, description: 'Callee.' },
        protocol: { type: 'string', enum: [...PROTOCOLS] },
      },
      required: ['source', 'target', 'protocol'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('connect_components'),
    execute: ({ source, target, protocol }: { source: string; target: string; protocol: string }) =>
      say(connectComponents('agent', source, target, protocol as never)),
  })

  useWebMCP({
    name: 'detach_dependency',
    description: `Remove a dependency edge. Both endpoints must lie inside the scope region. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        dependency: { type: 'string', enum: scopedEdgeIds, description: 'Dependency id.' },
      },
      required: ['dependency'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('detach_dependency') && scopedEdgeIds.length > 0,
    execute: ({ dependency }: { dependency: string }) => say(detachDependency('agent', dependency)),
  })

  useWebMCP({
    name: 'remove_component',
    description: `Remove a component from the architecture. Requires explicit human approval on screen, and the call will not return until a human decides. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string', enum: removableIds, description: 'Component id, in scope.' },
      },
      required: ['component'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('remove_component') && removableIds.length > 0,
    execute: async ({ component }: { component: string }) =>
      say(await removeComponent('agent', component)),
  })

  useWebMCP({
    name: 'attach_cache',
    description: `Put a cache in front of a service that is inside the scope region. Only exists while the region holds a service or worker. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', enum: cacheableIds, description: 'Service to cache for.' },
        label: { type: 'string', description: 'Name for the new cache.' },
        detail: { type: 'string', description: 'Engine and sizing.' },
      },
      required: ['service', 'label', 'detail'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('attach_cache') && cacheableIds.length > 0,
    execute: ({ service, label, detail }: { service: string; label: string; detail: string }) =>
      say(attachCache('agent', service, label, detail)),
  })

  useWebMCP({
    name: 'attach_consumer',
    description: `Give a queue a worker to drain it. This tool only exists while the scope region contains a queue. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        queue: { type: 'string', enum: queueIds, description: 'Queue needing a consumer.' },
        label: { type: 'string', description: 'Name for the new worker.' },
        detail: { type: 'string', description: 'Runtime and concurrency.' },
      },
      required: ['queue', 'label', 'detail'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('attach_consumer') && queueIds.length > 0,
    execute: ({ queue, label, detail }: { queue: string; label: string; detail: string }) =>
      say(attachConsumer('agent', queue, label, detail)),
  })

  useWebMCP({
    name: 'route_ingress',
    description: `Route traffic from an entrypoint the scope region owns to a component. Only exists while the region holds an edge or gateway. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        entrypoint: { type: 'string', enum: entrypointIds, description: 'Edge or gateway, in scope.' },
        target: { type: 'string', enum: allIds, description: 'Where traffic should go.' },
      },
      required: ['entrypoint', 'target'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('route_ingress') && entrypointIds.length > 0,
    execute: ({ entrypoint, target }: { entrypoint: string; target: string }) =>
      say(routeIngress('agent', entrypoint, target)),
  })

  useWebMCP({
    name: 'annotate_component',
    description: `Revise the one-line description of a component inside the scope region. ${region}`,
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string', enum: scopedIds, description: 'Component id, in scope.' },
        note: { type: 'string', description: 'Replacement one-line detail.' },
      },
      required: ['component', 'note'],
      additionalProperties: false,
    },
    annotations: MUTATING,
    enabled: can('annotate_component') && scopedIds.length > 0,
    execute: ({ component, note }: { component: string; note: string }) =>
      say(annotateComponent('agent', component, note)),
  })

  return null
}
