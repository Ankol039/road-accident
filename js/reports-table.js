// FR-07 + FR-11: searchable, filterable report list for admins,
// with CSV/PDF export of exactly what the filters show (FR-15).
// The API already limits officers to their assigned reports.
// Owner: Alyana (admin dashboard).
import { api, fileUrl } from './api.js'
import { BULACAN_TOWNS } from './config.js'
import { $, esc, formatDate, loadingRow, pager, statusBadge, statusOptions } from './ui.js'

export async function mountReportsTable(container, { perPage = 15, initial = {} } = {}) {
  const q = new URLSearchParams(location.search)
  const filters = {
    q: q.get('q') || initial.q || '',
    status: q.get('status') || initial.status || '',
    accident_type_id: q.get('accident_type_id') || '',
    municipality: q.get('municipality') || '',
    date_from: q.get('date_from') || '',
    date_to: q.get('date_to') || '',
    flagged: q.get('flagged') === '1' ? '1' : '',
    official: q.get('official') === '1' ? '1' : '',
  }
  let page = Number(q.get('page')) || 1

  container.innerHTML = `
    <form class="filter-bar" data-filters role="search">
      <input type="search" class="form-control" name="q" placeholder="Search report ID, place, description or reporter" aria-label="Search">
      <select class="form-select" name="status" aria-label="Status"><option value="">All statuses</option>${statusOptions()}</select>
      <select class="form-select" name="accident_type_id" aria-label="Accident type"><option value="">All types</option></select>
      <input class="form-control" name="municipality" list="rt-towns" placeholder="Municipality" aria-label="Municipality">
      <datalist id="rt-towns">${BULACAN_TOWNS.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <input type="date" class="form-control" name="date_from" aria-label="Accident date from" title="From">
      <input type="date" class="form-control" name="date_to" aria-label="Accident date to" title="To">
      <label class="form-check d-flex align-items-center gap-2 mb-0"><input type="checkbox" class="form-check-input mt-0" name="flagged" value="1"> Flagged</label>
      <label class="form-check d-flex align-items-center gap-2 mb-0"><input type="checkbox" class="form-check-input mt-0" name="official" value="1"> Verified records</label>
      <button class="btn btn-guide">Search</button>
      <button type="button" class="btn btn-link px-1" data-reset>Clear</button>
    </form>
    <p class="small text-secondary mb-2" data-dup-note>Reports the system marked as duplicates are hidden. Choose the status "Duplicate" to see them.</p>
    <div data-error></div>
    <div class="table-responsive panel p-0">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>Report ID</th><th>Accident date</th><th>Location</th><th>Type</th><th>Officer</th><th>Status</th></tr></thead>
        <tbody data-rows>${loadingRow(6)}</tbody>
      </table>
    </div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <div class="d-flex flex-wrap align-items-center gap-3" data-pager></div>
      <div class="d-flex gap-2">
        <a class="btn btn-sm btn-outline-guide" data-export="csv" href="#">Download CSV</a>
        <a class="btn btn-sm btn-outline-guide" data-export="pdf" href="#">Download PDF</a>
      </div>
    </div>`

  const form = $('[data-filters]', container)
  const rows = $('[data-rows]', container)
  const fillForm = () => {
    for (const [k, v] of Object.entries(filters)) {
      const el = form.elements[k]
      if (!el) continue
      if (el.type === 'checkbox') el.checked = v === '1'
      else el.value = v
    }
  }
  fillForm()

  api('/accident-types/list.php')
    .then((d) => {
      form.elements.accident_type_id.insertAdjacentHTML('beforeend', d.accident_types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join(''))
      form.elements.accident_type_id.value = filters.accident_type_id
    })
    .catch(() => {})

  const updateExportLinks = () => {
    container.querySelectorAll('[data-export]').forEach((a) => (a.href = fileUrl('/export/reports.php', { ...filters, format: a.dataset.export })))
  }

  const load = async () => {
    rows.innerHTML = loadingRow(6)
    $('[data-error]', container).innerHTML = ''
    // Keep the filters in the address bar so Back and refresh keep them
    const shown = new URLSearchParams(Object.entries({ ...filters, page: page > 1 ? page : '' }).filter(([, v]) => v))
    history.replaceState(null, '', location.pathname + (shown.toString() ? '?' + shown : ''))
    updateExportLinks()
    try {
      const data = await api('/reports/list.php', { query: { ...filters, page, per_page: perPage } })
      rows.innerHTML = data.items.length
        ? data.items
            .map(
              (r) => `<tr class="clickable" data-id="${r.id}">
                <td class="code-cell"><a href="report.php?id=${r.id}" class="fw-semibold">${esc(r.report_code)}</a>${r.is_flagged ? `<span class="flag-dot" title="${esc(r.flag_reason)}">Flagged</span>` : ''}</td>
                <td>${esc(formatDate(r.accident_date))}</td>
                <td>${esc([r.location_text, r.municipality].filter(Boolean).join(', '))}</td>
                <td>${esc(r.accident_type)}</td>
                <td>${esc(r.assigned_officer?.name || '')}</td>
                <td>${statusBadge(r.status, r.status_label)}</td>
              </tr>`,
            )
            .join('')
        : loadingRow(6, 'No reports match these filters.')
      rows.querySelectorAll('tr[data-id]').forEach((tr) =>
        tr.addEventListener('click', (e) => {
          if (e.target.closest('a')) return
          location.href = `report.php?id=${tr.dataset.id}`
        }),
      )
      pager($('[data-pager]', container), data, (p) => {
        page = p
        load()
      })
    } catch (e) {
      rows.innerHTML = ''
      $('[data-error]', container).innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    for (const k of Object.keys(filters)) {
      const el = form.elements[k]
      filters[k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value.trim()
    }
    page = 1
    load()
  })
  $('[data-reset]', container).addEventListener('click', () => {
    for (const k of Object.keys(filters)) filters[k] = ''
    fillForm()
    page = 1
    load()
  })
  await load()
}
