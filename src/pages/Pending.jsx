/**
 * Placeholder for screens that are scheduled in HANDOFF.md.
 * Keeps the sidebar navigation usable while the remaining pages are built.
 */
import { useLocation } from 'react-router-dom'

export default function Pending({ title }) {
  const { pathname } = useLocation()
  return (
    <>
      <h1 className="h3">{title}</h1>
      <section className="panel todo-panel">
        <h2 className="h6">Not built yet</h2>
        <p className="mb-2">
          This screen still needs to be ported. Its services and shared components already exist, so
          building it is mostly markup plus wiring.
        </p>
        <p className="small text-secondary mb-0">
          Route: <code>{pathname}</code> — see <code>HANDOFF.md</code> for the plan and the PHP/JS
          files it replaces.
        </p>
      </section>
    </>
  )
}
