import { resolvePending, useStore } from '../lib/store'

/**
 * The agent's tool call is suspended on an unresolved promise until a human
 * answers here. A server-side MCP can propose this change; it cannot wait.
 */
export function ConfirmDialog() {
  const pending = useStore((s) => s.pending)
  if (!pending) return null

  return (
    <div className="confirm">
      <div className="confirm__card" role="alertdialog" aria-modal="true">
        <div className="confirm__badge">agent is waiting</div>
        <h3 className="confirm__title">{pending.summary}</h3>
        <p className="confirm__body">{pending.consequence}</p>
        <div className="confirm__actions">
          <button className="btn btn--ghost" onClick={() => resolvePending(false)}>
            Decline
          </button>
          <button className="btn btn--danger" onClick={() => resolvePending(true)}>
            Approve
          </button>
        </div>
        <p className="confirm__note">
          <code>remove_component</code> has not returned. It resolves only when you choose.
        </p>
      </div>
    </div>
  )
}
