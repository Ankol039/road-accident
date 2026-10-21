// Maps with Leaflet + OpenStreetMap (free, no API key). Leaflet is loaded by a <script> tag as `L`.
import { MAP_CENTER } from './config.js'
import { esc, formatDate, statusBadge } from './ui.js'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function baseMap(el, center, zoom, options = {}) {
  const map = L.map(el, options).setView(center, zoom)
  L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)
  return map
}

/** Read-only map with one pin (report details). */
export function mountMapView(el, lat, lng) {
  const map = baseMap(el, [lat, lng], 16, { scrollWheelZoom: false })
  L.marker([lat, lng]).addTo(map)
  return map
}

/**
 * Arrival check map: the reporter's pin, the officer's "I've arrived" location, a line between them,
 * and the match circle around the reporter's pin. Returns the map.
 */
export function mountArrivalMap(el, report, arrival, matchRadius) {
  const rep = [report.latitude, report.longitude]
  const off = [arrival.latitude, arrival.longitude]
  const map = baseMap(el, rep, 18, { scrollWheelZoom: false })
  const group = L.featureGroup().addTo(map)
  L.circle(rep, { radius: matchRadius, color: '#0f6b4c', weight: 1, fillOpacity: 0.08, dashArray: '4 4' }).addTo(group)
  L.polyline([rep, off], { color: arrival.matches ? '#0f6b4c' : '#c8322b', weight: 3, dashArray: '6 6' }).addTo(group)
  L.marker(rep, { title: 'Reporter pin' }).bindTooltip('Reporter pin', { permanent: true, direction: 'top', offset: [-15, -12] }).addTo(group)
  L.circleMarker(off, { radius: 9, color: '#23272b', weight: 2, fillColor: '#0b6e8a', fillOpacity: 1 })
    .bindTooltip('Officer', { permanent: true, direction: 'bottom' }).addTo(group)
  if (arrival.accuracy_m) L.circle(off, { radius: arrival.accuracy_m, color: '#0b6e8a', weight: 1, fillOpacity: 0.1 }).addTo(group)
  map.fitBounds(group.getBounds().pad(0.35), { maxZoom: 19 })
  return map
}

const STATUS_COLORS = {
  submitted: '#6c757d', under_review: '#1f4f8a', info_required: '#b38600', verified: '#0b5039',
  assigned: '#43378c', on_scene: '#0b6e8a', in_progress: '#c4610f', resolved: '#0f6b4c', rejected: '#c8322b',
  duplicate: '#a0a5aa',
}

/** Dashboard map: one colored dot per report. */
export function mountPointsMap(el, points) {
  const map = baseMap(el, MAP_CENTER, 10)
  const layer = L.featureGroup().addTo(map)
  for (const p of points) {
    L.circleMarker([p.latitude, p.longitude], {
      radius: p.is_official_record ? 8 : 6,
      color: '#23272b',
      weight: 1,
      fillColor: STATUS_COLORS[p.status] || '#6c757d',
      fillOpacity: 0.85,
    })
      .bindPopup(
        `<strong><a href="report.php?id=${p.id}">${esc(p.report_code)}</a></strong><br>${esc(p.accident_type)}, ${esc(formatDate(p.accident_date))}<br>${esc(p.location_text)}<br>${statusBadge(p.status, p.status_label)}`,
      )
      .addTo(layer)
  }
  if (points.length) map.fitBounds(layer.getBounds().pad(0.15))
  return map
}

export { STATUS_COLORS }
