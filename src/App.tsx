import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { ToolInspector } from './components/ToolInspector'
import { ActivityLog } from './components/ActivityLog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ChalklineTools } from './webmcp/tools'
import { setDrawing, setScopeRect, scopeToSubsystem, useScope, useStore } from './lib/store'
import { SUBSYSTEMS } from './lib/seed'

function ScopeBar() {
  const scope = useScope()
  const drawing = useStore((s) => s.drawing)

  return (
    <div className="scopebar">
      <div className="presets">
        <span className="presets__label">scope</span>
        {SUBSYSTEMS.map((s) => (
          <button
            key={s}
            className="chip"
            data-active={scope.subsystems.length === 1 && scope.subsystems[0] === s ? 'true' : undefined}
            onClick={() => scopeToSubsystem(s)}
          >
            {s}
          </button>
        ))}
        <button
          className="chip chip--draw"
          data-active={drawing ? 'true' : undefined}
          onClick={() => setDrawing(!drawing)}
        >
          {drawing ? 'drag to draw…' : 'draw'}
        </button>
      </div>

      <div className="scopebar__state">
        {scope.rect ? (
          <>
            <span className="scopebar__dot" />
            <span className="scopebar__text">
              {scope.scoped.length} in scope &middot; {scope.capabilities.length} editing tool
              {scope.capabilities.length === 1 ? '' : 's'}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setScopeRect(null)}>
              Clear
            </button>
          </>
        ) : (
          <span className="scopebar__text scopebar__text--muted">
            No scope &middot; agent has read-only tools
          </span>
        )}
      </div>
    </div>
  )
}

/** Deep link: ?scope=payments preloads a region so a reviewer lands on the point. */
function useScopeDeepLink() {
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('scope')
    if (want && (SUBSYSTEMS as readonly string[]).includes(want)) {
      scopeToSubsystem(want)
    }
  }, [])
}

export default function App() {
  useScopeDeepLink()

  return (
    <ReactFlowProvider>
      <ChalklineTools />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark" />
            <span className="brand__name">chalkline</span>
          </div>
          <p className="tagline">The agent can only touch what is inside the line.</p>
          <ScopeBar />
        </header>

        <main className="layout">
          <Canvas />
          <aside className="rail">
            <ToolInspector />
            <ActivityLog />
          </aside>
        </main>

        <ConfirmDialog />
      </div>
    </ReactFlowProvider>
  )
}
