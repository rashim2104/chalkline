import type { InfraEdgeData, NodeKind } from './types'
import type { InfraEdge, InfraNode } from './seed'

export type RuleOwner = 'architecture' | 'scope'

export interface Refusal {
  ok: false
  code: string
  rule: string
  ruleOwner: RuleOwner
  message: string
  unblock: string
}

export interface Allowed<T> {
  ok: true
  value: T
}

export type Outcome<T> = Allowed<T> | Refusal

export const refuse = (
  code: string,
  rule: string,
  ruleOwner: RuleOwner,
  message: string,
  unblock: string,
): Refusal => ({ ok: false, code, rule, ruleOwner, message, unblock })

export const allow = <T>(value: T): Allowed<T> => ({ ok: true, value })

const PROTOCOL_TARGETS: Record<InfraEdgeData['protocol'], NodeKind[]> = {
  http: ['service', 'gateway', 'edge', 'external', 'worker'],
  grpc: ['service', 'worker'],
  sql: ['database'],
  redis: ['cache'],
  amqp: ['queue'],
  s3: ['storage'],
}

const PASSIVE_KINDS: NodeKind[] = ['database', 'cache', 'queue', 'storage']

export const dependentsOf = (id: string, edges: InfraEdge[]): string[] =>
  edges.filter((e) => e.target === id).map((e) => e.source)

export const consumersOf = (id: string, edges: InfraEdge[]): string[] =>
  edges.filter((e) => e.source === id).map((e) => e.target)

export function checkConnect(
  source: InfraNode,
  target: InfraNode,
  protocol: InfraEdgeData['protocol'],
): Outcome<null> {
  if (source.id === target.id) {
    return refuse(
      'self_edge',
      'A component cannot depend on itself.',
      'architecture',
      `${source.data.label} cannot connect to itself.`,
      'Pick a different target component.',
    )
  }

  if (PASSIVE_KINDS.includes(source.data.kind)) {
    return refuse(
      'passive_source',
      'Data stores do not initiate calls; services call them.',
      'architecture',
      `${source.data.label} is a ${source.data.kind} and cannot be the source of a dependency.`,
      `Reverse the direction: connect a service to ${source.data.label} instead.`,
    )
  }

  const allowedTargets = PROTOCOL_TARGETS[protocol]
  if (!allowedTargets.includes(target.data.kind)) {
    return refuse(
      'protocol_mismatch',
      `Protocol "${protocol}" may only target: ${allowedTargets.join(', ')}.`,
      'architecture',
      `${target.data.label} is a ${target.data.kind}, which does not speak ${protocol}.`,
      `Use a protocol valid for a ${target.data.kind}, or pick a different target.`,
    )
  }

  if (source.data.kind === 'edge' && target.data.kind !== 'gateway') {
    return refuse(
      'edge_bypasses_gateway',
      'Edge tier must enter through a gateway.',
      'architecture',
      `${source.data.label} cannot reach ${target.data.label} directly.`,
      'Route through the load balancer or an API gateway.',
    )
  }

  if (
    source.data.subsystem !== target.data.subsystem &&
    target.data.kind !== 'gateway' &&
    target.data.kind !== 'external' &&
    PASSIVE_KINDS.includes(target.data.kind)
  ) {
    return refuse(
      'cross_subsystem_datastore',
      'A subsystem may not read another subsystem store directly.',
      'architecture',
      `${source.data.label} (${source.data.subsystem}) cannot attach to ${target.data.label}, which belongs to ${target.data.subsystem}.`,
      `Call the ${target.data.subsystem} service over HTTP instead of reaching into its store.`,
    )
  }

  return allow(null)
}

export function checkDelete(node: InfraNode, edges: InfraEdge[]): Outcome<null> {
  if (node.data.kind === 'external') {
    return refuse(
      'external_not_owned',
      'External providers are not part of this architecture.',
      'architecture',
      `${node.data.label} is a third-party dependency and cannot be deleted here.`,
      'Remove the dependencies that call it instead.',
    )
  }

  const dependents = dependentsOf(node.id, edges)
  if (dependents.length > 0) {
    return refuse(
      'has_dependents',
      'A component with inbound dependencies cannot be removed.',
      'architecture',
      `${node.data.label} still has ${dependents.length} inbound dependenc${
        dependents.length === 1 ? 'y' : 'ies'
      }: ${dependents.join(', ')}.`,
      `Detach ${dependents.join(', ')} first, then remove ${node.data.label}.`,
    )
  }

  return allow(null)
}

export const orphanedQueues = (
  nodes: InfraNode[],
  edges: InfraEdge[],
): InfraNode[] =>
  nodes.filter(
    (node) => node.data.kind === 'queue' && consumersOf(node.id, edges).length === 0,
  )
