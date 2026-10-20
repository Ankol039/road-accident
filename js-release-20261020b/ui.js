// Small helpers used by every page. Owner: Jan Russel

/** Escape text before putting it in HTML (stops people from injecting code in report text). */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
export const param = (name) => new URLSearchParams(location.search).get(name)

// Labels match api/core/status.php exactly
export const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  info_required: 'Additional Information Required',
  assigned: 'Assigned',
  on_scene: 'Officer On Scene',
  verified: 'Verified',
  in_progress: 'In Progress',
  resolved: 'Resolved / Closed',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
}

// What each status means in this workflow (shown on the report page)
export const STATUS_HELP = {
  submitted: 'New report from a public reporter.',
  under_review: 'The administrator is checking the report.',
  info_required: 'Waiting for the reporter to send missing information.',
  assigned: 'Officer dispatched: on the way to the pin.',
  on_scene: 'The officer says he has arrived. Check that his location matches the reporter\'s pin.',
  verified: 'Locations matched and approved. The officer may clear the site.',
  in_progress: 'The officer is clearing the site and removing the vehicles.',
  resolved: 'Site cleared. The report is closed.',
  rejected: 'Closed without action (reason recorded).',
  duplicate: 'Disregarded automatically: an earlier open report exists at the same spot.',
}

export const statusBadge = (status, label) =>
  `<span class="status-badge status-${esc(status)}">${esc(label || STATUS_LABELS[status] || status)}</span>`

export const statusOptions = (selected = '') =>
  Object.entries(STATUS_LABELS)
    .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')

// ---------- dates (the API sends Philippine time, e.g. "2026-10-14 14:35:00") ----------
const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const parse = (s) => (s ? new Date(s.replace(' ', 'T') + (s.length <= 10 ? 'T00:00:00' : '')) : null)

export const formatDate = (s) => (s ? dateFmt.format(parse(s)) : '')
export const formatDateTime = (s) => (s ? dateTimeFmt.format(parse(s)) : '')
export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const pad = (n) => String(n).padStart(2, '0')
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const daysAgoISO = (n) => {
  const d = new Date(Date.now() - n * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const nowHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const place = (r) => [r.location_text, r.barangay, r.municipality].filter(Boolean).join(', ')

// ---------- forms ----------
/** Show the API's field errors under each input (inputs are found by name). */
export function showErrors(form, errors = {}) {
  clearErrors(form)
  let first = null
  for (const [name, message] of Object.entries(errors)) {
    const input = form.querySelector(`[name="${name}"]`)
    if (!input) continue
    input.classList.add('is-invalid')
    const fb = document.createElement('div')
    fb.className = 'invalid-feedback d-block'
    fb.dataset.error = name
    fb.textContent = message
    const anchor = input.closest('.choice-row, .input-group') || input
    anchor.insertAdjacentElement('afterend', fb)
    first ??= input
  }
  first?.focus()
}
export function clearErrors(form) {
  $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'))
  $$('[data-error]', form).forEach((el) => el.remove())
}
/** Form fields as an object (checkboxes become true/false). */
export function formData(form) {
  const out = {}
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue
    if (el.type === 'checkbox') out[el.name] = el.checked
    else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value
    } else out[el.name] = el.value.trim()
  }
  return out
}

/** Put a dismissible alert inside `el` (or clear it with message = ''). */
export function showAlert(el, message, type = 'danger') {
  el.innerHTML = message
    ? `<div class="alert alert-${type} py-2 d-flex justify-content-between align-items-start gap-2" role="alert">
         <span>${esc(message)}</span>
         <button type="button" class="btn-close btn-sm" aria-label="Close"></button>
       </div>`
    : ''
  el.querySelector('.btn-close')?.addEventListener('click', () => (el.innerHTML = ''))
}

/** Disable a button while an action runs and show a busy label. */
export async function busy(button, label, fn) {
  const old = button.innerHTML
  button.disabled = true
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${esc(label)}`
  try {
    return await fn()
  } finally {
    button.disabled = false
    button.innerHTML = old
  }
}

/** Short message in the corner that disappears by itself. */
export function toast(message, type = 'success') {
  let box = $('#toast-box')
  if (!box) {
    box = document.createElement('div')
    box.id = 'toast-box'
    box.className = 'toast-box'
    box.setAttribute('aria-live', 'polite')
    document.body.append(box)
  }
  const t = document.createElement('div')
  t.className = `toast-msg toast-${type}`
  t.textContent = message
  box.append(t)
  setTimeout(() => t.classList.add('is-leaving'), 3200)
  setTimeout(() => t.remove(), 3700)
}

export const loadingRow = (cols, text = 'Loading…') => `<tr><td colspan="${cols}" class="text-secondary">${esc(text)}</td></tr>`

/** Simple Previous / Next pager. */
export function pager(el, data, onPage) {
  if (!data || data.total_pages <= 1) {
    el.innerHTML = data ? `<span class="small text-secondary">${data.total} total</span>` : ''
    return
  }
  el.innerHTML = `
    <span class="small text-secondary">${data.total} total, page ${data.page} of ${data.total_pages}</span>
    <div class="btn-group">
      <button class="btn btn-sm btn-outline-secondary" data-p="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
      <button class="btn btn-sm btn-outline-secondary" data-p="${data.page + 1}" ${data.page >= data.total_pages ? 'disabled' : ''}>Next</button>
    </div>`
  $$('[data-p]', el).forEach((b) => b.addEventListener('click', () => onPage(Number(b.dataset.p))))
}
