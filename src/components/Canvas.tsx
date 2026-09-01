import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import { InfraNode } from './InfraNode'
import { InfraEdge } from './InfraEdge'
import { ScopeRegion } from './ScopeRegion'
import { useScope, useStore } from '../lib/store'
import type { NodeKind } from '../lib/types'

const nodeTypes: NodeTypes = { infra: InfraNode as never }
const edgeTypes: EdgeTypes = { infra: InfraEdge as never }

const KIND_COLOR: Record<NodeKind, string> = {
  edge: '#60a5fa',
  gateway: '#818cf8',
  service: '#34d399',
  worker: '#2dd4bf',
  database: '#f472b6',
  cache: '#fb923c',
  queue: '#c084fc',
  storage: '#94a3b8',
  external: '#64748b',
}

export function Canvas() {
  const rawNodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const scope = useScope()

  // Scope state is painted on, not stored: the architecture does not know
  // about the region, only the presentation layer does.
  const nodes = useMemo(() => {
    const active = scope.rect !== null
    const inScope = new Set(scope.ids)
    return rawNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        scopeState: !active ? 'neutral' : inScope.has(n.id) ? 'in-scope' : 'out-of-scope',
      },
    }))
  }, [rawNodes, scope])

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        zIndexMode="auto"
        proOptions={{ hideAttribution: true }}
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={1.6}
      >
        <Background id="fine" variant={BackgroundVariant.Dots} gap={16} size={1} color="#1c212b" />
        <Background id="coarse" variant={BackgroundVariant.Lines} gap={160} color="#12161d" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => KIND_COLOR[(n.data as { kind: NodeKind }).kind]}
          nodeStrokeColor={(n) => KIND_COLOR[(n.data as { kind: NodeKind }).kind]}
          nodeStrokeWidth={3}
          nodeBorderRadius={3}
          maskColor="#08090ccc"
          className="canvas__minimap"
        />
        <ScopeRegion rect={scope.rect} />
      </ReactFlow>
    </div>
  )
}
