// FR-10 dashboard: summary cards, charts, map of accident locations, recent reports. Owner: Alyana
// Charts use Chart.js (loaded by a <script> tag as `Chart`). Official numbers count only verified records.
import { api } from '../api.js'
import { startPage } from '../app.js'
import { $, esc, formatDate, statusBadge } from '../ui.js'

await startPage({ roles: ['admin'] })

// One hue for every chart: these charts compare amounts, not identities.
const INK = '#f0ece2'
const MUTED = '#98a09c'
const GRID = '#2a3236'
const BAR = '#e4572e' // burnt-orange accent (landing palette)
Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif"
Chart.defaults.color = MUTED
Chart.defaults.plugins.legend.display = false
Chart.defaults.plugins.tooltip.backgroundColor = '#171c1f'
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.maintainAspectRatio = false

const charts = {}
let map = null

function barChart(id, labels, values, { horizontal = false, title = 'Reports' } = {}) {
  charts[id]?.destroy()
  charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ label: title, data: values, backgroundColor: BAR, hoverBackgroundColor: '#c8441f', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      scales: {
        x: { grid: { display: horizontal, color: GRID }, border: { display: false }, ticks: { precision: 0 } },
        y: { grid: { display: !horizontal, color: GRID }, border: { display: false }, ticks: { precision: 0, autoSkip: false } },
      },
    },
  })
}

function lineChart(id, labels, values) {
  charts[id]?.destroy()
  charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Verified accidents', data: values, borderColor: BAR, backgroundColor: BAR, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: GRID }, border: { display: false }, ticks: { precision: 0 } } },
    },
  })
}

/** "Show the numbers" table under each chart (for screen readers and printing). */
function numbers(id, head, rows) {
  document.getElementById(id).innerHTML = `<details class="mt-2"><summary class="small">Show the numbers</summary>
    <table class="table table-sm small mb-0 mt-2"><thead><tr><th>${esc(head[0])}</th><th class="text-end">${esc(head[1])}</th></tr></thead>
    <tbody>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="text-end">${b}</td></tr>`).join('')}</tbody></table></details>`
}

async function load() {
  const range = { date_from: $('#from').value, date_to: $('#to').value }
  try {
    const d = await api('/dashboard/summary.php', { query: range })
    const c = d.cards
    const cards = [
      ['on_scene', 'Officer on scene: check the location', 'admin-reports.php?status=on_scene'],
      ['pending', 'Waiting for review', 'admin-reports.php?status=submitted'],
      ['dispatched', 'Officer on the way', 'admin-reports.php?status=assigned'],
      ['total', 'All reports', 'admin-reports.php'],
      ['verified', 'Verified records', 'admin-reports.php?official=1'],
      ['closed', 'Resolved and closed', 'admin-reports.php?status=resolved'],
      ['duplicates', 'Duplicates disregarded', 'admin-reports.php?status=duplicate'],
      ['today', 'Submitted today', 'admin-reports.php'],
    ]
    $('#cards').innerHTML = cards
      .map(([k, label, href]) => `<a href="${href}" class="stat-card stat-${k} ${k === 'on_scene' && c[k] ? 'has-items' : ''}"><span class="stat-value">${c[k]}</span><span class="stat-label">${label}</span></a>`)
      .join('')

    lineChart('chart-month', d.by_month.map((m) => m.label), d.by_month.map((m) => m.count))
    numbers('num-month', ['Month', 'Verified accidents'], d.by_month.map((m) => [m.label, m.count]))

    barChart('chart-type', d.by_type.map((t) => t.type), d.by_type.map((t) => t.count), { horizontal: true, title: 'Verified accidents' })
    numbers('num-type', ['Type', 'Verified accidents'], d.by_type.map((t) => [t.type, t.count]))

    barChart('chart-town', d.by_municipality.map((m) => m.municipality), d.by_municipality.map((m) => m.count), { horizontal: true, title: 'Verified accidents' })
    numbers('num-town', ['Municipality', 'Verified accidents'], d.by_municipality.map((m) => [m.municipality, m.count]))

    const hours = d.by_hour.map((_, h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`)
    barChart('chart-hour', hours, d.by_hour, { title: 'Verified accidents' })
    numbers('num-hour', ['Hour', 'Verified accidents'], hours.map((h, i) => [h, d.by_hour[i]]))

    barChart('chart-status', d.by_status.map((s) => s.label), d.by_status.map((s) => s.count), { horizontal: true, title: 'Reports' })
    numbers('num-status', ['Status', 'Reports'], d.by_status.map((s) => [s.label, s.count]))

    $('#hotspots').innerHTML = d.hotspots.length
      ? d.hotspots
          .map((h, i) => `<li class="d-flex justify-content-between gap-2 py-1 border-bottom">
            <span><span class="text-secondary me-1">${i + 1}.</span>${esc([h.barangay && `Brgy. ${h.barangay}`, h.municipality].filter(Boolean).join(', ') || 'No location')}</span>
            <strong>${h.count}</strong></li>`)
          .join('')
      : '<li class="text-secondary">No verified records yet.</li>'

    drawMap(d.map_points)

    $('#recent').innerHTML = d.recent
      .map((r) => `<tr class="clickable" onclick="location.href='report.php?id=${r.id}'">
        <td class="code-cell"><a href="report.php?id=${r.id}" class="fw-semibold">${esc(r.report_code)}</a>${r.is_flagged ? '<span class="flag-dot">Flagged</span>' : ''}</td>
        <td>${esc(formatDate(r.accident_date))}</td><td>${esc(r.location_text)}</td><td>${esc(r.accident_type)}</td>
        <td>${statusBadge(r.status, r.status_label)}</td></tr>`)
      .join('')
    $('#official-note').textContent = `${d.official_count} verified accident record(s) in the charts${range.date_from || range.date_to ? ' for the chosen dates' : ''}. Unverified public reports are not counted as accidents.`
  } catch (e) {
    $('#error').innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`
  }
}

function drawMap(points) {
  if (map) map.remove()
  map = L.map('points-map').setView([14.8433, 120.8114], 10)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  const layer = L.featureGroup().addTo(map)
  for (const p of points) {
    const official = p.is_official_record
    L.circleMarker([p.latitude, p.longitude], {
      radius: official ? 8 : 6,
      color: '#fff',
      weight: 2,
      fillColor: official ? BAR : '#98a09c',
      fillOpacity: 0.9,
    })
      .bindPopup(`<strong><a href="report.php?id=${p.id}">${esc(p.report_code)}</a></strong><br>${esc(p.accident_type)}, ${esc(formatDate(p.accident_date))}<br>${esc(p.location_text)}<br>${statusBadge(p.status, p.status_label)}`)
      .addTo(layer)
  }
  if (points.length) map.fitBounds(layer.getBounds().pad(0.1))
  $('#map-count').textContent = `${points.length} report(s) with GPS`
}

$('#range-form').addEventListener('submit', (e) => {
  e.preventDefault()
  load()
})
$('#range-clear').addEventListener('click', () => {
  $('#from').value = ''
  $('#to').value = ''
  load()
})
load()
