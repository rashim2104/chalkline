import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { setScopeRect } from '../lib/store'
import type { ScopeRect } from '../lib/types'

type Draft = { x0: number; y0: number; x1: number; y1: number }

const toRect = (d: Draft): ScopeRect => ({
  x: Math.min(d.x0, d.x1),
  y: Math.min(d.y0, d.y1),
  width: Math.abs(d.x1 - d.x0),
  height: Math.abs(d.y1 - d.y0),
})

/**
 * Drag on empty canvas to draw the scope region. Held in flow coordinates so
 * it stays pinned to the architecture through pan and zoom.
 */
export function ScopeRegion({ rect }: { rect: ScopeRect | null }) {
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow()
  const [draft, setDraft] = useState<Draft | null>(null)
  const drafting = useRef(false)

  const onDown = useCallback(
    (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!target.classList.contains('react-flow__pane')) return
      if (!event.shiftKey) return
      event.preventDefault()
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      drafting.current = true
      setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    },
    [screenToFlowPosition],
  )

  const onMove = useCallback(
    (event: PointerEvent) => {
      if (!drafting.current) return
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d))
    },
    [screenToFlowPosition],
  )

  const onUp = useCallback(() => {
    if (!drafting.current) return
    drafting.current = false
    setDraft((d) => {
      if (d) {
        const r = toRect(d)
        setScopeRect(r.width > 24 && r.height > 24 ? r : null)
      }
      return null
    })
  }, [])

  useEffect(() => {
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onDown, onMove, onUp])

  const live = draft ? toRect(draft) : rect
  if (!live) return null

  const tl = flowToScreenPosition({ x: live.x, y: live.y })
  const br = flowToScreenPosition({ x: live.x + live.width, y: live.y + live.height })

  return (
    <div
      className="scope-region"
      data-drafting={draft ? 'true' : undefined}
      style={{
        left: tl.x,
        top: tl.y,
        width: Math.max(0, br.x - tl.x),
        height: Math.max(0, br.y - tl.y),
      }}
    >
      <span className="scope-region__tag">agent scope</span>
    </div>
  )
}
