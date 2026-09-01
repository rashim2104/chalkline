import { useStore } from '../lib/store'

export function ActivityLog() {
  const activity = useStore((s) => s.activity)

  return (
    <section className="panel panel--grow">
      <header className="panel__head">
        <h2>Activity</h2>
        <span className="panel__count">{activity.length}</span>
      </header>
      {activity.length === 0 ? (
        <p className="panel__empty">
          Nothing yet. Every call, accepted or refused, is recorded here with the rule that decided
          it.
        </p>
      ) : (
        <ul className="activity">
          {activity.map((a) => (
            <li key={a.id} className="activity__row" data-status={a.status}>
              <div className="activity__line">
                <span className="activity__actor">{a.actor}</span>
                <code className="activity__tool">{a.tool}</code>
                <span className="activity__status">{a.status}</span>
              </div>
              <div className="activity__title">{a.title}</div>
              {a.detail && <div className="activity__detail">{a.detail}</div>}
              {a.unblock && <div className="activity__unblock">{a.unblock}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
