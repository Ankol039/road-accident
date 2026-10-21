/**
 * Leaflet map wrappers (react-leaflet).
 *
 * Replaces js/map.js, which drew coloured circle markers and popups. Pin
 * colours still come from STATUS_COLORS.
 */
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { MAP_CENTER, STATUS_COLORS, STATUS_LABELS } from '../lib/constants.js'
import { formatDate } from '../utils/date.js'
import { place } from '../utils/format.js'

/** Keep the map sized correctly when it mounts inside a flex/grid panel. */
function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function ReportPopup({ report }) {
  return (
    <Popup>
      <strong>{report.report_code || 'Report'}</strong>
      <br />
      {formatDate(report.accident_date)} · {STATUS_LABELS[report.status] || report.status}
      <br />
      {place(report)}
    </Popup>
  )
}

/**
 * All report pins for the dashboard map.
 * @param {{reports:Array, height?:number, center?:[number,number]}} props
 */
export function PointsMap({ reports = [], height = 380, center }) {
  const pts = reports.filter((r) => r.latitude && r.longitude)
  const middle = center || (pts[0] ? [pts[0].latitude, pts[0].longitude] : MAP_CENTER)

  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={middle} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateOnMount />
        {pts.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.latitude, r.longitude]}
            radius={8}
            pathOptions={{
              color: STATUS_COLORS[r.status] || '#6c757d',
              fillColor: STATUS_COLORS[r.status] || '#6c757d',
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <ReportPopup report={r} />
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

/** Single-pin map for the report detail page. */
export function OnePinMap({ report, height = 300 }) {
  if (!report?.latitude || !report?.longitude) {
    return <p className="text-secondary">No location was pinned for this report.</p>
  }
  return (
    <div className="map-box" style={{ height }}>
      <MapContainer
        center={[report.latitude, report.longitude]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateOnMount />
        <CircleMarker
          center={[report.latitude, report.longitude]}
          radius={10}
          pathOptions={{
            color: STATUS_COLORS[report.status] || '#e4572e',
            fillColor: STATUS_COLORS[report.status] || '#e4572e',
            fillOpacity: 0.9,
            weight: 3,
          }}
        >
          <ReportPopup report={report} />
        </CircleMarker>
        {report.arrival_latitude && (
          <CircleMarker
            center={[report.arrival_latitude, report.arrival_longitude]}
            radius={9}
            pathOptions={{ color: '#f2b705', fillColor: '#f2b705', fillOpacity: 0.85, weight: 2 }}
          >
            <Popup>Officer arrival point</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}

/** Colour legend under the dashboard map. */
export function MapLegend() {
  const keys = ['submitted', 'on_scene', 'verified', 'in_progress', 'resolved', 'duplicate']
  return (
    <p className="small text-secondary mt-2 mb-0">
      {keys.map((k) => (
        <span key={k} className="me-3">
          <span className="legend-dot" style={{ background: STATUS_COLORS[k] }} />
          {STATUS_LABELS[k]}
        </span>
      ))}
    </p>
  )
}
