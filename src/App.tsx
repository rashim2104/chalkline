import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { ToolInspector } from './components/ToolInspector'
import { ActivityLog } from './components/ActivityLog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ChalklineTools } from './webmcp/tools'
import { setScopeRect, useScope } from './lib/store'

function ScopeBar() {
  const scope = useScope()
  return (
    <div className="scopebar">
      {scope.rect ? (
        <>
          <span className="scopebar__dot" />
          <span className="scopebar__text">
            {scope.scoped.length} component{scope.scoped.length === 1 ? '' : 's'} in scope
            {scope.subsystems.length > 0 && <> &middot; {scope.subsystems.join(', ')}</>}
          </span>
          <button className="btn btn--ghost btn--sm" onClick={() => setScopeRect(null)}>
            Clear
          </button>
        </>
      ) : (
        <span className="scopebar__text scopebar__text--muted">
          Shift-drag on the canvas to draw the agent&rsquo;s scope
        </span>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <ChalklineTools />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark" />
            <span className="brand__name">chalkline</span>
          </div>
          <p className="tagline">
            The agent can only touch what is inside the line.
          </p>
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
