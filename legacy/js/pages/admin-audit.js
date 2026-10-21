// FR-14 audit trail viewer. Owner: Alyana (page) + Juliana (API)
import { api } from '../api.js'
import { startPage } from '../app.js'
import { $, daysAgoISO, esc, formatDateTime, loadingRow, pager, todayISO } from '../ui.js'

await startPage({ roles: ['admin'] })
const form = $('#audit-form')
form.date_from.value = daysAgoISO(30)
form.date_to.value = todayISO()
let page = 1
let actionsLoaded = false

function details(a) {
  const d = a.details || {}
  if (d.changed) {
    return Object.entries(d.changed)
      .map(([k, v]) => (v && typeof v === 'object' && 'to' in v ? `${k}: ${short(v.from)} → ${short(v.to)}` : `${k}: ${short(v)}`))
      .join('; ')
  }
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${short(v)}`)
    .join('; ')
}
const short = (v) => {
  const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 80 ? s.slice(0, 77) + '…' : s
}

async function load() {
  const rows = $('#rows')
  rows.innerHTML = loadingRow(5)
  try {
    const d = await api('/audit/list.php', {
      query: { date_from: form.date_from.value, date_to: form.date_to.value, action: form.action.value, q: form.q.value.trim(), page, per_page: 50 },
    })
    if (!actionsLoaded) {
      form.action.insertAdjacentHTML('beforeend', d.actions.map((a) => `<option value="${a.value}">${esc(a.label)}</option>`).join(''))
      actionsLoaded = true
    }
    rows.innerHTML = d.items.length
      ? d.items
          .map((a) => `<tr>
            <td class="text-nowrap small">${esc(formatDateTime(a.created_at))}</td>
            <td>${esc(a.user_name || 'System')}<span class="small text-secondary d-block">${esc(a.user_role || '')}</span></td>
            <td>${esc(a.action_label)}</td>
            <td>${a.entity_type === 'report' && a.entity_id ? `<a href="report.php?id=${a.entity_id}">Report #${a.entity_id}</a>` : esc(a.entity_type ? `${a.entity_type} ${a.entity_id ?? ''}` : '')}</td>
            <td class="small text-secondary">${esc(details(a))}</td></tr>`)
          .join('')
      : loadingRow(5, 'Nothing was recorded for these filters.')
    pager($('#pager'), d, (p) => {
      page = p
      load()
    })
  } catch (e) {
    rows.innerHTML = loadingRow(5, e.message)
  }
}
form.addEventListener('submit', (e) => {
  e.preventDefault()
  page = 1
  load()
})
load()
