export type NodeKind =
  | 'edge'
  | 'gateway'
  | 'service'
  | 'worker'
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'external'

export type Env = 'prod' | 'staging'

export type Criticality = 'tier0' | 'tier1' | 'tier2'

/**
 * Node data must be a `type`, not an `interface` - an interface does not
 * satisfy React Flow v12's `Record<string, unknown>` constraint.
 */
export type ScopeState = 'neutral' | 'in-scope' | 'out-of-scope'

export type InfraNodeData = {
  label: string
  kind: NodeKind
  subsystem: string
  env: Env
  criticality: Criticality
  detail: string
  /** Painted onto the node by the scope layer; not part of the architecture. */
  scopeState?: ScopeState
}

export type InfraEdgeData = {
  protocol: 'http' | 'grpc' | 'sql' | 'redis' | 'amqp' | 's3'
  note?: string
}

export type ScopeRect = {
  x: number
  y: number
  width: number
  height: number
}
