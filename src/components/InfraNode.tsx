import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { InfraNode as InfraNodeType } from '../lib/seed'
import type { NodeKind } from '../lib/types'

const GLYPH: Record<NodeKind, string> = {
  edge: 'M2 8h12M8 2v12',
  gateway: 'M3 3h10v10H3z M3 8h10',
  service: 'M3 4h10v8H3z M6 4v8',
  worker: 'M8 3l5 3v4l-5 3-5-3V6z',
  database: 'M3 4c0-1 2-2 5-2s5 1 5 2v8c0 1-2 2-5 2s-5-1-5-2z M3 8c0 1 2 2 5 2s5-1 5-2',
  cache: 'M2 5h12v6H2z M5 5v6M11 5v6',
  queue: 'M2 6h3v4H2z M6.5 6h3v4h-3z M11 6h3v4h-3z',
  storage: 'M2 4h12v3H2z M2 9h12v3H2z',
  external: 'M6 3h7v7 M13 3L6 10 M3 6v7h7',
}

const TIER_LABEL: Record<string, string> = {
  tier0: 'T0',
  tier1: 'T1',
  tier2: 'T2',
}

export type InfraNodeState = 'neutral' | 'in-scope' | 'out-of-scope'

function InfraNodeComponent({ data, selected }: NodeProps<InfraNodeType>) {
  const state = (data.scopeState ?? 'neutral') as InfraNodeState

  return (
    <div
      className="infra-node"
      data-kind={data.kind}
      data-tier={data.criticality}
      data-state={state}
      data-selected={selected ? 'true' : undefined}
    >
      <Handle type="target" position={Position.Left} className="infra-handle" />

      <span className="infra-node__accent" aria-hidden />

      <div className="infra-node__glyph" aria-hidden>
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d={GLYPH[data.kind]} fill="none" strokeWidth="1.25" />
        </svg>
      </div>

      <div className="infra-node__body">
        <div className="infra-node__title">
          <span className="infra-node__label">{data.label}</span>
          <span className="infra-node__tier">{TIER_LABEL[data.criticality]}</span>
        </div>
        <div className="infra-node__detail">{data.detail}</div>
      </div>

      <Handle type="source" position={Position.Right} className="infra-handle" />
    </div>
  )
}

export const InfraNode = memo(InfraNodeComponent)
