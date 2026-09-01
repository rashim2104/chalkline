import type { InfraEdge, InfraNode } from './seed'
import type { NodeKind, ScopeRect } from './types'

export const NODE_W = 224
export const NODE_H = 78

const intersects = (node: InfraNode, rect: ScopeRect): boolean => {
  // v12 splits fixed size (`width`) from rendered size (`measured.width`).
  // Fall back to the design size before the first measurement lands.
  const w = node.measured?.width ?? node.width ?? NODE_W
  const h = node.measured?.height ?? node.height ?? NODE_H
  const nx1 = node.position.x
  const ny1 = node.position.y
  const nx2 = nx1 + w
  const ny2 = ny1 + h
  const rx2 = rect.x + rect.width
  const ry2 = rect.y + rect.height
  return nx1 < rx2 && nx2 > rect.x && ny1 < ry2 && ny2 > rect.y
}

export const nodesInScope = (
  nodes: InfraNode[],
  rect: ScopeRect | null,
): InfraNode[] => (rect ? nodes.filter((n) => intersects(n, rect)) : [])

/**
 * Tools whose target is a node inside the scope. These names must match the
 * registered tool names exactly - the inspector diffs against this set.
 */
export type Capability =
  | 'add_component'
  | 'connect_components'
  | 'detach_dependency'
  | 'remove_component'
  | 'attach_cache'
  | 'attach_consumer'
  | 'route_ingress'
  | 'annotate_component'

const has = (nodes: InfraNode[], ...kinds: NodeKind[]): boolean =>
  nodes.some((n) => kinds.includes(n.data.kind))

const ACTIVE_KINDS: NodeKind[] = ['service', 'worker', 'gateway', 'edge']

/**
 * The capability surface is derived from what the scope actually contains.
 * This is the point of the project: the agent's tool list is a readout of the
 * architecture it has been pointed at, not a fixed menu.
 */
export function capabilitiesFor(scoped: InfraNode[]): Capability[] {
  if (scoped.length === 0) return []

  const caps: Capability[] = ['annotate_component']
  const hasActive = has(scoped, ...ACTIVE_KINDS)

  // Something in scope must be able to initiate a call before any dependency
  // can be drawn from inside it.
  if (hasActive) {
    caps.push('add_component', 'connect_components')
  }

  if (has(scoped, 'service', 'worker')) {
    caps.push('attach_cache')
  }

  // A consumer can only be attached to a queue that is actually in scope.
  if (has(scoped, 'queue')) {
    caps.push('attach_consumer')
  }

  // Ingress routing only exists where the scope owns an entrypoint.
  if (has(scoped, 'edge', 'gateway')) {
    caps.push('route_ingress')
  }

  if (scoped.length > 1) {
    caps.push('detach_dependency')
  }

  // Removal is only offered when the scope holds something removable at all.
  if (scoped.some((n) => n.data.kind !== 'external')) {
    caps.push('remove_component')
  }

  return caps
}

export interface ScopeState {
  rect: ScopeRect | null
  scoped: InfraNode[]
  ids: string[]
  capabilities: Capability[]
  subsystems: string[]
}

export function deriveScope(
  nodes: InfraNode[],
  rect: ScopeRect | null,
): ScopeState {
  const scoped = nodesInScope(nodes, rect)
  return {
    rect,
    scoped,
    ids: scoped.map((n) => n.id),
    capabilities: capabilitiesFor(scoped),
    subsystems: [...new Set(scoped.map((n) => n.data.subsystem))].sort(),
  }
}

/** Edges with both endpoints inside the scope. */
export const edgesInScope = (edges: InfraEdge[], ids: string[]): InfraEdge[] => {
  const set = new Set(ids)
  return edges.filter((e) => set.has(e.source) && set.has(e.target))
}
