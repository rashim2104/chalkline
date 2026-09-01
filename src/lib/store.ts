import { useSyncExternalStore } from 'react'
import type { InfraEdge, InfraNode } from './seed'
import { seedEdges, seedNodes } from './seed'
import { checkConnect, checkDelete, refuse, allow, type Outcome } from './rules'
import { deriveScope, type ScopeState } from './scope'
import type { InfraEdgeData, InfraNodeData, ScopeRect } from './types'

export type Actor = 'human' | 'agent'

export type ActivityStatus = 'ok' | 'refused' | 'awaiting' | 'declined'

export type Activity = {
  id: string
  seq: number
  actor: Actor
  tool: string
  status: ActivityStatus
  title: string
  detail?: string
  refusalCode?: string
  unblock?: string
}

export type Pending = {
  id: string
  tool: string
  summary: string
  consequence: string
  resolve: (approved: boolean) => void
}

type State = {
  nodes: InfraNode[]
  edges: InfraEdge[]
  scopeRect: ScopeRect | null
  activity: Activity[]
  pending: Pending | null
}

let state: State = {
  nodes: seedNodes,
  edges: seedEdges,
  scopeRect: null,
  activity: [],
  pending: null,
}

const listeners = new Set<() => void>()
let seq = 0

const emit = () => {
  for (const l of listeners) l()
}

const set = (partial: Partial<State>) => {
  state = { ...state, ...partial }
  emit()
}

export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const getState = (): State => state

export const useStore = <T,>(select: (s: State) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state),
  )

export const useScope = (): ScopeState =>
  useSyncExternalStore(
    subscribe,
    () => scopeCache(state),
    () => scopeCache(state),
  )

// deriveScope allocates; memoize so useSyncExternalStore sees a stable
// reference and does not loop.
let scopeMemo: { nodes: InfraNode[]; rect: ScopeRect | null; value: ScopeState } | null = null
const scopeCache = (s: State): ScopeState => {
  if (scopeMemo && scopeMemo.nodes === s.nodes && scopeMemo.rect === s.scopeRect) {
    return scopeMemo.value
  }
  const value = deriveScope(s.nodes, s.scopeRect)
  scopeMemo = { nodes: s.nodes, rect: s.scopeRect, value }
  return value
}

const uid = () => `a${++seq}`

const log = (entry: Omit<Activity, 'id' | 'seq'>) => {
  const record: Activity = { ...entry, id: uid(), seq }
  set({ activity: [record, ...state.activity].slice(0, 60) })
  return record
}

export const currentScope = (): ScopeState => scopeCache(state)

const inScope = (id: string): boolean => currentScope().ids.includes(id)

const outOfScope = (id: string) =>
  refuse(
    'out_of_scope',
    'A component outside the drawn scope cannot be modified.',
    'scope',
    `${id} lies outside the current scope region.`,
    `Extend the scope region to include ${id}, then retry.`,
  )

// ---------------------------------------------------------------- mutations

export const setScopeRect = (rect: ScopeRect | null) => set({ scopeRect: rect })

export const setNodes = (nodes: InfraNode[]) => set({ nodes })

export function describeComponent(actor: Actor, id: string): Outcome<string> {
  const node = state.nodes.find((n) => n.id === id)
  if (!node) {
    const r = refuse(
      'unknown_component',
      'The component must exist in this architecture.',
      'architecture',
      `No component named ${id}.`,
      'Call list_components to see valid names.',
    )
    log({ actor, tool: 'describe_component', status: 'refused', title: `describe ${id}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  const deps = state.edges.filter((e) => e.source === id).map((e) => e.target)
  const dependents = state.edges.filter((e) => e.target === id).map((e) => e.source)
  const text = [
    `${node.data.label} - ${node.data.kind}, ${node.data.criticality}, subsystem ${node.data.subsystem}.`,
    node.data.detail,
    deps.length ? `Depends on: ${deps.join(', ')}.` : 'Depends on nothing.',
    dependents.length ? `Depended on by: ${dependents.join(', ')}.` : 'Nothing depends on it.',
  ].join(' ')
  log({ actor, tool: 'describe_component', status: 'ok', title: `describe ${node.data.label}` })
  return allow(text)
}

export function connectComponents(
  actor: Actor,
  sourceId: string,
  targetId: string,
  protocol: InfraEdgeData['protocol'],
): Outcome<string> {
  const source = state.nodes.find((n) => n.id === sourceId)
  const target = state.nodes.find((n) => n.id === targetId)

  if (!source || !target) {
    const r = refuse('unknown_component', 'Both endpoints must exist.', 'architecture', `Unknown component: ${!source ? sourceId : targetId}.`, 'Call list_components to see valid names.')
    log({ actor, tool: 'connect_components', status: 'refused', title: `connect ${sourceId} -> ${targetId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  if (!inScope(sourceId)) {
    const r = outOfScope(sourceId)
    log({ actor, tool: 'connect_components', status: 'refused', title: `connect ${sourceId} -> ${targetId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  const verdict = checkConnect(source, target, protocol)
  if (!verdict.ok) {
    log({ actor, tool: 'connect_components', status: 'refused', title: `connect ${source.data.label} -> ${target.data.label}`, detail: verdict.message, refusalCode: verdict.code, unblock: verdict.unblock })
    return verdict
  }

  const id = `${sourceId}->${targetId}`
  if (state.edges.some((e) => e.id === id)) {
    const r = refuse('already_connected', 'A dependency may only be declared once.', 'architecture', `${source.data.label} already depends on ${target.data.label}.`, 'Nothing to do.')
    log({ actor, tool: 'connect_components', status: 'refused', title: `connect ${source.data.label} -> ${target.data.label}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  set({ edges: [...state.edges, { id, source: sourceId, target: targetId, type: 'infra', data: { protocol } }] })
  log({ actor, tool: 'connect_components', status: 'ok', title: `${source.data.label} -> ${target.data.label}`, detail: protocol })
  return allow(`Connected ${source.data.label} to ${target.data.label} over ${protocol}.`)
}

export function addComponent(
  actor: Actor,
  spec: Pick<InfraNodeData, 'label' | 'kind' | 'detail'> & { near?: string },
): Outcome<string> {
  const scope = currentScope()
  if (!scope.rect) {
    const r = refuse('no_scope', 'A scope region must be drawn before anything is added.', 'scope', 'No scope region is active.', 'Draw a scope region on the canvas first.')
    log({ actor, tool: 'add_component', status: 'refused', title: `add ${spec.label}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  const anchor = scope.scoped[0]
  const id = spec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (state.nodes.some((n) => n.id === id)) {
    const r = refuse('duplicate_component', 'Component names are unique.', 'architecture', `${id} already exists.`, 'Choose a different name.')
    log({ actor, tool: 'add_component', status: 'refused', title: `add ${spec.label}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  const node: InfraNode = {
    id,
    type: 'infra',
    position: {
      x: scope.rect.x + scope.rect.width / 2 - 104,
      y: scope.rect.y + scope.rect.height - 40,
    },
    data: {
      label: spec.label,
      kind: spec.kind,
      detail: spec.detail,
      subsystem: anchor?.data.subsystem ?? 'unassigned',
      env: 'prod',
      criticality: 'tier2',
    },
  }

  set({ nodes: [...state.nodes, node] })
  log({ actor, tool: 'add_component', status: 'ok', title: `added ${spec.label}`, detail: `${spec.kind} in ${node.data.subsystem}` })
  return allow(`Added ${spec.label} inside the scope region.`)
}

export function detachDependency(actor: Actor, edgeId: string): Outcome<string> {
  const edge = state.edges.find((e) => e.id === edgeId)
  if (!edge) {
    const r = refuse('unknown_dependency', 'The dependency must exist.', 'architecture', `No dependency ${edgeId}.`, 'Call list_dependencies to see valid ids.')
    log({ actor, tool: 'detach_dependency', status: 'refused', title: `detach ${edgeId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  if (!inScope(edge.source) || !inScope(edge.target)) {
    const r = outOfScope(inScope(edge.source) ? edge.target : edge.source)
    log({ actor, tool: 'detach_dependency', status: 'refused', title: `detach ${edgeId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  set({ edges: state.edges.filter((e) => e.id !== edgeId) })
  log({ actor, tool: 'detach_dependency', status: 'ok', title: `detached ${edgeId}` })
  return allow(`Detached ${edgeId}.`)
}

export function requestConfirmation(
  tool: string,
  summary: string,
  consequence: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const entry = log({ actor: 'agent', tool, status: 'awaiting', title: summary, detail: consequence })
    set({
      pending: {
        id: entry.id,
        tool,
        summary,
        consequence,
        resolve: (approved) => {
          set({ pending: null })
          set({
            activity: state.activity.map((a) =>
              a.id === entry.id ? { ...a, status: approved ? 'ok' : 'declined' } : a,
            ),
          })
          resolve(approved)
        },
      },
    })
  })
}

export const resolvePending = (approved: boolean) => state.pending?.resolve(approved)

export async function removeComponent(actor: Actor, id: string): Promise<Outcome<string>> {
  const node = state.nodes.find((n) => n.id === id)
  if (!node) {
    const r = refuse('unknown_component', 'The component must exist.', 'architecture', `No component ${id}.`, 'Call list_components to see valid names.')
    log({ actor, tool: 'remove_component', status: 'refused', title: `remove ${id}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  if (!inScope(id)) {
    const r = outOfScope(id)
    log({ actor, tool: 'remove_component', status: 'refused', title: `remove ${id}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  const verdict = checkDelete(node, state.edges)
  if (!verdict.ok) {
    log({ actor, tool: 'remove_component', status: 'refused', title: `remove ${node.data.label}`, detail: verdict.message, refusalCode: verdict.code, unblock: verdict.unblock })
    return verdict
  }

  const approved = await requestConfirmation(
    'remove_component',
    `Remove ${node.data.label}?`,
    `${node.data.label} is ${node.data.criticality} in ${node.data.subsystem}. This cannot be undone from the agent side.`,
  )
  if (!approved) {
    return refuse('declined_by_human', 'A human declined the change.', 'scope', `Removal of ${node.data.label} was declined.`, 'Ask the operator what they would prefer instead.')
  }

  set({
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.source !== id && e.target !== id),
  })
  return allow(`Removed ${node.data.label}.`)
}

// ------------------------------------------------- scope-shaped additions
// These exist only when the scope region contains the thing they act on: a
// cache can be attached to a service, a consumer only to a queue, ingress
// only where the scope owns an entrypoint.

const spawnBeside = (
  anchor: InfraNode,
  id: string,
  data: InfraNodeData,
  dx: number,
  dy: number,
): InfraNode => ({
  id,
  type: 'infra',
  position: { x: anchor.position.x + dx, y: anchor.position.y + dy },
  width: 224,
  height: 78,
  data,
})

const slug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function attachNew(
  actor: Actor,
  tool: string,
  targetId: string,
  label: string,
  kind: InfraNodeData['kind'],
  detail: string,
  protocol: InfraEdgeData['protocol'],
  direction: 'from-target' | 'to-target',
  offset: [number, number],
): Outcome<string> {
  const target = state.nodes.find((n) => n.id === targetId)
  if (!target) {
    const r = refuse('unknown_component', 'The component must exist.', 'architecture', `No component ${targetId}.`, 'Call list_components to see valid names.')
    log({ actor, tool, status: 'refused', title: `${tool} ${targetId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  if (!inScope(targetId)) {
    const r = outOfScope(targetId)
    log({ actor, tool, status: 'refused', title: `${tool} ${targetId}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  const id = slug(label)
  if (state.nodes.some((n) => n.id === id)) {
    const r = refuse('duplicate_component', 'Component names are unique.', 'architecture', `${id} already exists.`, 'Choose a different name.')
    log({ actor, tool, status: 'refused', title: `${tool} ${label}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }

  const node = spawnBeside(target, id, {
    label,
    kind,
    detail,
    subsystem: target.data.subsystem,
    env: target.data.env,
    criticality: 'tier2',
  }, offset[0], offset[1])

  const [source, dest] =
    direction === 'from-target' ? [targetId, id] : [id, targetId]

  set({
    nodes: [...state.nodes, node],
    edges: [
      ...state.edges,
      { id: `${source}->${dest}`, source, target: dest, type: 'infra', data: { protocol } },
    ],
  })
  log({ actor, tool, status: 'ok', title: `${label} attached to ${target.data.label}`, detail: `${source} -> ${dest} over ${protocol}` })
  return allow(`Attached ${label} to ${target.data.label} over ${protocol}.`)
}

export const attachCache = (actor: Actor, serviceId: string, label: string, detail: string) =>
  attachNew(actor, 'attach_cache', serviceId, label, 'cache', detail, 'redis', 'from-target', [300, -90])

export const attachConsumer = (actor: Actor, queueId: string, label: string, detail: string) =>
  attachNew(actor, 'attach_consumer', queueId, label, 'worker', detail, 'amqp', 'from-target', [300, 90])

export function routeIngress(
  actor: Actor,
  entrypointId: string,
  targetId: string,
): Outcome<string> {
  return connectComponents(actor, entrypointId, targetId, 'http')
}

export function annotateComponent(actor: Actor, id: string, note: string): Outcome<string> {
  const node = state.nodes.find((n) => n.id === id)
  if (!node) {
    const r = refuse('unknown_component', 'The component must exist.', 'architecture', `No component ${id}.`, 'Call list_components to see valid names.')
    log({ actor, tool: 'annotate_component', status: 'refused', title: `annotate ${id}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  if (!inScope(id)) {
    const r = outOfScope(id)
    log({ actor, tool: 'annotate_component', status: 'refused', title: `annotate ${id}`, detail: r.message, refusalCode: r.code, unblock: r.unblock })
    return r
  }
  set({
    nodes: state.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, detail: note } } : n,
    ),
  })
  log({ actor, tool: 'annotate_component', status: 'ok', title: `annotated ${node.data.label}`, detail: note })
  return allow(`Updated ${node.data.label}: ${note}`)
}
