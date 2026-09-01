import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import type { InfraEdge as InfraEdgeType } from '../lib/seed'

function InfraEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<InfraEdgeType>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  })

  return (
    <>
      <BaseEdge id={id} path={path} className="infra-edge" />
      <EdgeLabelRenderer>
        <div
          className="infra-edge__label nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data?.protocol}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const InfraEdge = memo(InfraEdgeComponent)
