// FR-12 daily, weekly, monthly and annual summaries + FR-15 export. Owner: Alyana (summaries), John (export)
import { api, fileUrl } from '../api.js'
import { startPage } from '../app.js'
import { $, busy, esc } from '../ui.js'

await startPage({ roles: ['admin'] })
const form = $('#summary-form')
let chart = null
Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif"
Chart.defaults.color = '#98a09c'

const query = () => ({
  period: form.period.value,
  scope: form.scope.value,
  date_from: form.date_from.value,
  date_to: form.date_to.value,
})

function exportLinks() {
  for (const fmt of ['csv', 'pdf']) {
    $(`#sum-${fmt}`).href = fileUrl('/export/reports.php', { ...query(), type: 'summary', format: fmt })
    $(`#all-${fmt}`).href = fileUrl('/export/reports.php', { format: fmt, official: $('#export-official').checked ? 1 : '', date_from: form.date_from.value, date_to: form.date_to.value })
  }
}

async function load() {
  exportLinks()
  $('#error').innerHTML = ''
  try {
    const d = await api('/dashboard/report-summary.php', { query: query() })
    form.date_from.value = d.date_from === '2000-01-01' ? '' : d.date_from
    form.date_to.value = d.date_to
    exportLinks()
    $('#range').textContent = `${d.scope === 'official' ? 'Verified accident records' : 'All public reports'}, ${d.date_from === '2000-01-01' ? 'all years' : d.date_from} to ${d.date_to}`
    const t = d.totals
    $('#rows').innerHTML =
      d.rows
        .map((r) => `<tr><td>${esc(r.label)}</td><td class="text-end">${r.total}</td><td class="text-end">${r.with_injuries}</td>
          <td class="text-end">${r.fatalities}</td><td class="text-end">${r.no_injuries}</td><td class="text-end">${r.unknown_injuries}</td>
          <td class="text-end">${r.vehicles}</td><td class="text-end">${r.resolved}</td><td>${esc(r.top_type || '')}</td><td>${esc(r.top_municipality || '')}</td></tr>`)
        .join('') +
      `<tr class="fw-bold table-dark"><td>Total</td><td class="text-end">${t.total}</td><td class="text-end">${t.with_injuries}</td><td class="text-end">${t.fatalities}</td>
        <td class="text-end">${t.no_injuries}</td><td class="text-end">${t.unknown_injuries}</td><td class="text-end">${t.vehicles}</td><td class="text-end">${t.resolved}</td><td></td><td></td></tr>`

    const rows = [...d.rows].reverse() // oldest first for the chart
    chart?.destroy()
    chart = new Chart($('#chart'), {
      type: 'bar',
      data: { labels: rows.map((r) => r.label), datasets: [{ label: 'Accidents', data: rows.map((r) => r.total), backgroundColor: '#e4572e', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28 }] },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 60, autoSkip: true } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#2a3236' }, border: { display: false } } },
      },
    })
  } catch (e) {
    $('#error').innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  busy(form.querySelector('button[type=submit]'), 'Loading…', load)
})
form.period.addEventListener('change', () => {
  form.date_from.value = ''
  form.date_to.value = ''
  load()
})
form.scope.addEventListener('change', load)
$('#export-official').addEventListener('change', exportLinks)
$('#print').addEventListener('click', () => window.print())
load()
