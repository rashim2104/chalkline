import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow, ViewportPortal } from '@xyflow/react'
import { setScopeRect, useStore } from '../lib/store'
import type { ScopeRect } from '../lib/types'

type Draft = { x0: number; y0: number; x1: number; y1: number }

const toRect = (d: Draft): ScopeRect => ({
  x: Math.min(d.x0, d.x1),
  y: Math.min(d.y0, d.y1),
  width: Math.abs(d.x1 - d.x0),
  height: Math.abs(d.y1 - d.y0),
})

/**
 * Drawing is an explicit armed mode rather than a modifier-drag: React Flow
 * already owns shift-drag for box selection, and a hidden gesture is not
 * something a first-time visitor will discover.
 */
export function ScopeRegion({ rect }: { rect: ScopeRect | null }) {
  const { screenToFlowPosition } = useReactFlow()
  const drawing = useStore((s) => s.drawing)
  const [draft, setDraft] = useState<Draft | null>(null)
  const active = useRef(false)

  const onDown = useCallback(
    (event: PointerEvent) => {
      if (!drawing || event.button !== 0) return
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      active.current = true
      setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    },
    [drawing, screenToFlowPosition],
  )

  const onMove = useCallback(
    (event: PointerEvent) => {
      if (!active.current) return
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d))
    },
    [screenToFlowPosition],
  )

  const onUp = useCallback(() => {
    if (!active.current) return
    active.current = false
    setDraft((d) => {
      if (d) {
        const r = toRect(d)
        setScopeRect(r.width > 24 && r.height > 24 ? r : null)
      }
      return null
    })
  }, [])

  useEffect(() => {
    if (!drawing) return
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drawing, onDown, onMove, onUp])

  const live = draft ? toRect(draft) : rect

  return (
    <>
      {drawing && <div className="scope-arm" />}
      {live && (
        <ViewportPortal>
          <div
            className="scope-region"
            data-drafting={draft !== null ? 'true' : undefined}
            style={{
              transform: `translate(${live.x}px, ${live.y}px)`,
              width: live.width,
              height: live.height,
            }}
          >
            <span className="scope-region__tag">agent scope</span>
          </div>
        </ViewportPortal>
      )}
    </>
  )
}
