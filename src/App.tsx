import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { ToolInspector } from './components/ToolInspector'
import { ActivityLog } from './components/ActivityLog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ChalklineTools } from './webmcp/tools'
import {
  loadArchitecture,
  setDrawing,
  setScopeRect,
  scopeToSubsystem,
  useScope,
  useStore,
} from './lib/store'
import { ARCHITECTURES } from './lib/architectures'

function ScopeBar() {
  const scope = useScope()
  const drawing = useStore((s) => s.drawing)
  const archId = useStore((s) => s.architectureId)
  const subsystems = ARCHITECTURES[archId].subsystems

  return (
    <div className="scopebar">
      <div className="presets">
        <span className="presets__label">scope</span>
        {subsystems.map((s) => (
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

/** Deep links: ?arch=k8s&scope=control-plane so a reviewer lands on the point. */
function useDeepLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const arch = params.get('arch')
    if (arch && ARCHITECTURES[arch]) loadArchitecture(arch)

    const want = params.get('scope')
    if (want) scopeToSubsystem(want)
  }, [])
}

function CanvasForCurrentArchitecture() {
  const archId = useStore((s) => s.architectureId)
  return <Canvas key={archId} />
}

function ArchitectureSwitch() {
  const archId = useStore((s) => s.architectureId)
  return (
    <div className="presets">
      <span className="presets__label">system</span>
      {Object.values(ARCHITECTURES).map((a) => (
        <button
          key={a.id}
          className="chip"
          title={a.blurb}
          data-active={a.id === archId ? 'true' : undefined}
          onClick={() => loadArchitecture(a.id)}
        >
          {a.name}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  useDeepLink()

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
          <ArchitectureSwitch />
          <ScopeBar />
        </header>

        <main className="layout">
          {/* Remount on architecture change so the camera refits the new graph. */}
          <CanvasForCurrentArchitecture />
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
