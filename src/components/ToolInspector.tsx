import { useEffect, useState } from 'react'

type RegisteredTool = {
  name: string
  description: string
  annotations?: { readOnlyHint?: boolean }
}

/**
 * Reads the live tool list back out of the browser. This is not our own
 * bookkeeping - it is what the agent would actually discover, which is the
 * point: when the scope region changes, this list changes with it.
 */
export function ToolInspector() {
  const [tools, setTools] = useState<RegisteredTool[]>([])
  // Derived at init rather than set from inside the effect. The extension that
  // provides modelContext may inject it after mount, so this is re-checked
  // below and only written when it actually changes.
  const [supported, setSupported] = useState(
    () => typeof document !== 'undefined' && Boolean(document.modelContext),
  )

  useEffect(() => {
    let alive = true
    let mc = document.modelContext

    const read = async () => {
      if (!mc) return
      const list = (await mc.getTools()) as unknown as RegisteredTool[]
      if (alive) setTools(list)
    }

    if (mc) {
      read()
      mc.addEventListener('toolchange', read)
      return () => {
        alive = false
        mc?.removeEventListener('toolchange', read)
      }
    }

    // Poll briefly for a late-injected API instead of reporting unsupported
    // forever. Gives up after ten seconds.
    let attempts = 0
    const timer = setInterval(() => {
      if (document.modelContext) {
        clearInterval(timer)
        mc = document.modelContext
        setSupported(true)
        read()
        mc.addEventListener('toolchange', read)
      } else if (++attempts >= 20) {
        clearInterval(timer)
      }
    }, 500)

    return () => {
      alive = false
      clearInterval(timer)
      mc?.removeEventListener('toolchange', read)
    }
  }, [])

  const read = tools.filter((t) => t.annotations?.readOnlyHint)
  const write = tools.filter((t) => !t.annotations?.readOnlyHint)

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Registered tools</h2>
        <span className="panel__count">{tools.length}</span>
      </header>

      {!supported && (
        <p className="panel__empty">
          This browser does not expose <code>document.modelContext</code>. Open in ChatGPT&rsquo;s
          built-in browser, or Chrome with the WebMCP flag enabled.
        </p>
      )}

      {supported && (
        <>
          <ToolGroup label="read-only" tools={read} tone="read" />
          <ToolGroup label="scoped, mutating" tools={write} tone="write" />
          {write.length === 0 && (
            <p className="panel__empty">
              No editing tools are registered. Shift-drag on the canvas to draw a scope region.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function ToolGroup({
  label,
  tools,
  tone,
}: {
  label: string
  tools: RegisteredTool[]
  tone: 'read' | 'write'
}) {
  if (tools.length === 0) return null
  return (
    <div className="tool-group">
      <div className="tool-group__label">{label}</div>
      <ul className="tool-list">
        {tools.map((t) => (
          <li key={t.name} className="tool" data-tone={tone}>
            <code>{t.name}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}
