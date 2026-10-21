/**
 * The "live map" section of the landing page: the Bulacan municipality SVG
 * with pins that appear as you scroll, filterable by severity.
 *
 * Ported from the inline script in index.php. Sample data is intentional —
 * this is a marketing page, and it must render without a Firebase session.
 */
import { useEffect, useRef, useState } from 'react'
import { BULACAN_PATHS } from '../styles/landing-markup.js'

/* Projection from the source map, unchanged. */
const G = { x0: 120.68703221300007, y1: 15.268369465000033, k: 0.9663760793213293, S: 939.5481923313982, H: 525 }
const X = (g) => (g - G.x0) * G.k * G.S
const Y = (a) => (G.y1 - a) * G.S

const SEVERITY = { Fatal: '#e4572e', Serious: '#f2a93b', Slight: '#5fb7a5' }

const SAMPLE = [
  ['Meycauayan', 'MacArthur Hwy', 14.7366, 120.9606, 'Tricycle vs. jeepney', 'Fatal', 'Assigned', '07:42'],
  ['DRT', 'DRT Highway', 15.066, 121.1673, 'Truck rollover', 'Serious', 'New', '08:10'],
  ['Hagonoy', 'Hagonoy–Malolos Rd', 14.8314, 120.7427, 'Tricycle rollover', 'Slight', 'New', '09:05'],
  ['Norzagaray', 'Norzagaray–Angat Rd', 14.8892, 121.1458, 'Motorcycle collision', 'Fatal', 'Verified', '10:20'],
  ['San Miguel', 'Maharlika Hwy', 15.1962, 121.0284, 'Bus sideswipe', 'Slight', 'Resolved', '11:30'],
  ['San Jose del Monte', 'Quirino Hwy', 14.8166, 121.0824, 'Hit and run', 'Serious', 'Assigned', '12:45'],
  ['Calumpit', 'MacArthur Hwy', 14.8966, 120.7798, 'Truck vs. motorcycle', 'Fatal', 'Verified', '14:02'],
  ['Baliuag', 'Maharlika Hwy', 14.9509, 120.8895, 'Skid on wet road', 'Slight', 'Resolved', '15:18'],
  ['Malolos', 'Paseo del Congreso', 14.8382, 120.8179, 'Pedestrian struck', 'Serious', 'New', '16:40'],
  ['San Ildefonso', 'San Ildefonso–Baliuag Rd', 15.0725, 121.0078, 'Car vs. tricycle', 'Slight', 'Verified', '17:55'],
].map((r, i) => ({
  id: `RR-${2401 + i}`,
  town: r[0],
  road: r[1],
  lat: r[2],
  lng: r[3],
  type: r[4],
  sv: r[5],
  st: r[6],
  t: r[7],
}))

export default function LandingMap() {
  const section = useRef(null)
  const [visible, setVisible] = useState(0)
  const [off, setOff] = useState(() => new Set())

  const shown = SAMPLE.slice(0, visible).filter((r) => !off.has(r.sv))
  const feed = shown.slice(-3).reverse()

  useEffect(() => {
    const el = section.current
    if (!el) return undefined
    let last = -1
    const update = () => {
      const r = el.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, -r.top / (r.height - window.innerHeight)))
      const n = Math.min(SAMPLE.length, Math.ceil(p * 1.1 * SAMPLE.length))
      if (n === last) return
      last = n
      setVisible(n)
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const toggle = (key) => {
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mtrack" id="livemap" ref={section}>
      <div className="mstick">
        <div className="mmap rv">
          <svg id="msvg" viewBox="0 0 600 525" role="img" aria-label="Map of Bulacan municipalities with accident pins">
            <g id="mm" dangerouslySetInnerHTML={{ __html: BULACAN_PATHS }} />
            <g id="mpins">
              {SAMPLE.map((r, i) => {
                const on = i < visible && !off.has(r.sv)
                return (
                  <g
                    key={r.id}
                    transform={`translate(${X(r.lng).toFixed(1)} ${Y(r.lat).toFixed(1)})`}
                    className={`${on ? 'pin show' : 'pin'}${i === visible - 1 && on ? ' new' : ''}${off.has(r.sv) ? ' off' : ''}`}
                  >
                    <circle r="6" fill={SEVERITY[r.sv]} stroke="#0e1214" strokeWidth="2" />
                    <title>{`${r.id} · ${r.type} · ${r.town}`}</title>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        <div className="mside">
          <small>Live map · sample data</small>
          <h2 className="serif">Every report, pinned where it happened</h2>
          <div className="cnt">
            <b>{shown.length}</b>
            <span>
              of <em>{SAMPLE.length}</em> reports plotted
            </span>
          </div>

          <div className="chips">
            {Object.keys(SEVERITY).map((key) => (
              <button
                key={key}
                type="button"
                className={`chip${off.has(key) ? ' x' : ''}`}
                style={{ '--c': SEVERITY[key] }}
                onClick={() => toggle(key)}
              >
                <i />
                {key}
              </button>
            ))}
          </div>

          <div className="feed">
            {feed.length === 0 && (
              <div className="rep">
                <p>Scroll to start logging reports…</p>
              </div>
            )}
            {feed.map((r) => (
              <div key={r.id} className="rep" style={{ '--c': SEVERITY[r.sv] }}>
                <span className="st">{`${r.sv} · ${r.st}`}</span>
                <b>{`${r.id} · ${r.type}`}</b>
                <p>{`${r.road}, ${r.town} · ${r.t}`}</p>
              </div>
            ))}
          </div>

          <div className="mhint">Keep scrolling to log more reports</div>
        </div>
      </div>
    </div>
  )
}
