// One report, for administrators (review, verify, edit, assign, flag, remarks).
// Owner: Alyana (admin dashboard).
// Public users and traffic officers see reports in the mobile app.
import { api } from '../api.js'
import { startPage } from '../app.js'
import { mountArrivalMap, mountMapView } from '../map.js'
import {
  $, busy, clearErrors, esc, formatDate, formatDateTime, formatTime, formData, param, place,
  showAlert, showErrors, statusBadge, STATUS_HELP, STATUS_LABELS, todayISO, toast,
} from '../ui.js'

await startPage({ roles: ['admin'], active: 'admin-reports.php' })
const root = $('#report')
const back = 'admin-reports.php'

let r = null
let options = null
let officers = null

async function load() {
  try {
    r = await api('/reports/view.php', { query: { id: param('id'), code: param('code') } })
    render()
  } catch (e) {
    root.innerHTML = `<a href="${back}" class="small">Back to reports</a><div class="alert alert-danger mt-3">${esc(e.message)}</div>`
  }
}

const REMARK_LABELS = { remark: 'Remark', finding: 'Finding', action: 'Action taken', reporter_info: 'Information from the reporter (mobile app)' }
const meters = (m) => (m == null ? 'unknown' : `${Math.round(m)} m`)

function render() {
  document.title = `${r.report_code} · RoadReport`
  const vehicles = r.vehicles.map((v) => `${v.quantity} ${v.type}`).join(', ') || 'None listed'
  const a = r.officer_arrival
  root.innerHTML = `
    <a href="${back}" class="small">Back to reports</a>
    <div class="d-flex flex-wrap align-items-center gap-3 mt-2 mb-1">
      <h1 class="h3 mb-0">${esc(r.report_code)}</h1>
      ${statusBadge(r.status, r.status_label)}
      <span class="record-kind ${r.is_official_record ? 'is-official' : ''}">
        ${r.is_official_record ? 'Verified accident record' : 'Public report, not yet verified'}</span>
    </div>
    <p class="text-secondary mb-1">Submitted ${esc(formatDateTime(r.date_submitted))} from the ${esc(r.source)} app</p>
    <p class="status-help">${esc(STATUS_HELP[r.status] || '')}</p>
    <a href="#status-slot" class="btn btn-sm btn-outline-guide d-lg-none mb-3">Update this report</a>
    ${r.status === 'rejected' && r.rejection_reason ? `<div class="alert alert-danger">Rejected: ${esc(r.rejection_reason)}</div>` : ''}
    ${r.status === 'duplicate' ? `<div class="alert alert-secondary">
        <strong>Automatically disregarded as a duplicate</strong> of
        <a href="report.php?id=${r.duplicate_of}">${esc(r.duplicate_of_code || 'the earlier report')}</a>:
        that report was received first and is still open, and this pin is ${meters(r.duplicate_distance_m)} away.
        The reporter was told it was already reported.</div>` : ''}
    ${r.is_flagged ? `<div class="alert alert-warning">Flagged: ${esc(r.flag_reason)}
        ${r.duplicate_of && r.status !== 'duplicate' ? ` (<a href="report.php?id=${r.duplicate_of}">see the earlier report</a>)` : ''}</div>` : ''}
    ${r.duplicate_reports?.length ? `<div class="alert alert-info">
        <strong>Also reported by ${r.duplicate_reports.length} other ${r.duplicate_reports.length === 1 ? 'person' : 'people'}</strong>
        (disregarded as duplicates):
        ${r.duplicate_reports.map((d) => `<a href="report.php?id=${d.id}">${esc(d.report_code)}</a> (${esc(d.reporter || '')}, ${meters(d.distance_m)} away, ${d.photo_count} photo(s))`).join('; ')}</div>` : ''}

    <div class="row g-4">
      <div class="col-lg-7 stack">
        <section class="panel">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <h2 class="h5">Accident details</h2>
            <button class="btn btn-sm btn-outline-secondary" id="edit-btn">Edit details</button>
          </div>
          <dl class="review-list">
            <dt>Date and time</dt><dd>${esc(formatDate(r.accident_date))} at ${esc(formatTime(r.accident_time))}</dd>
            <dt>Type</dt><dd>${esc(r.accident_type)}</dd>
            <dt>Injuries</dt><dd>${esc(r.injury_label)}</dd>
            <dt>Vehicles</dt><dd>${esc(vehicles)}</dd>
            <dt>Location</dt><dd>${esc(place(r))}</dd>
            ${r.latitude != null ? `<dt>Reporter's pin</dt><dd>${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}
              ${r.gps_accuracy_m != null ? `<span class="small text-secondary">(phone GPS ±${Math.round(r.gps_accuracy_m)} m)</span>` : ''}
              <a class="small ms-1" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}">open map</a></dd>` : ''}
            <dt>What happened</dt><dd class="pre-wrap">${esc(r.description)}</dd>
            ${r.reporter ? `<dt>Reporter</dt><dd>${esc(r.reporter.name)}${r.reporter.contact ? `, <a href="${/^[0-9+]/.test(r.reporter.contact) ? 'tel:' : 'mailto:'}${esc(r.reporter.contact)}">${esc(r.reporter.contact)}</a>` : ''}</dd>` : ''}
            ${r.assigned_officer ? `<dt>Assigned officer</dt><dd>${esc(r.assigned_officer.name)}</dd>` : ''}
            ${a ? `<dt>Officer arrival</dt><dd>${esc(formatDateTime(a.date))}, ${meters(a.distance_m)} from the pin${r.arrival_count > 1 ? ` (arrival #${r.arrival_count})` : ''}</dd>` : ''}
            ${r.verified_by ? `<dt>Verified by</dt><dd>${esc(r.verified_by)}, ${esc(formatDateTime(r.verified_at))}</dd>` : ''}
          </dl>
        </section>
        ${r.latitude != null ? `<section class="panel"><h2 class="h5">${a ? 'Map: reporter pin and officer arrival' : 'Map'}</h2>
          <div class="map-box" id="map" style="height:${a ? 320 : 260}px"></div>
          ${a ? `<p class="small text-secondary mt-2 mb-0">Blue pin: reporter. Round marker: officer's "I've arrived" location.
            Dashed circle: match distance (${Math.round(r.arrival_match_radius_m)} m).</p>` : ''}</section>` : ''}
        ${photoSections()}
      </div>
      <div class="col-lg-5 stack">
        <div id="check-slot"></div>
        <div id="status-slot"></div>
        <div id="assign-slot"></div>
        <div id="remark-slot"></div>
        <div id="flag-slot"></div>
        <section class="panel">
          <h2 class="h5">Status history</h2>
          ${timeline(r.history)}
        </section>
        ${r.remarks.length ? `<section class="panel">
          <h2 class="h5">Remarks and findings</h2>
          <ul class="list-plain mb-0">${r.remarks.map((m) => `
            <li class="py-2 border-bottom">
              <span class="small text-secondary">${esc(REMARK_LABELS[m.type] || m.type)}${m.is_internal ? ', internal (reporter cannot see it)' : ''}</span>
              <p class="mb-0 pre-wrap">${esc(m.content)}</p>
              <span class="small text-secondary">${esc(m.officer || '')}, ${esc(formatDateTime(m.date))}</span>
            </li>`).join('')}</ul></section>` : ''}
      </div>
    </div>`

  if (r.latitude != null) {
    if (a) mountArrivalMap($('#map'), r, a, r.arrival_match_radius_m)
    else mountMapView($('#map'), r.latitude, r.longitude)
  }
  root.querySelectorAll('[data-reveal]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const box = btn.closest('.photo-section')
      box.classList.toggle('is-revealed')
      btn.textContent = box.classList.contains('is-revealed') ? 'Hide sensitive photos' : 'Show sensitive photos'
    }),
  )
  if (r.status === 'on_scene') arrivalCheckPanel()
  statusPanel()
  assignPanel()
  remarkPanel()
  flagPanel()
  $('#edit-btn').addEventListener('click', openEdit)
}

// ---------- photo evidence, one section per kind of proof ----------
function photoSections() {
  const sections = r.photo_sections || []
  const html = sections.map((sec) => {
    const list = r.photos.filter((p) => p.category === sec.key)
    if (!list.length && !sec.required) return ''
    const tiles = list.map((p, i) => `
      <figure class="photo-item">
        <a href="${esc(p.url)}" target="_blank" rel="noopener" class="photo-tile" title="Open full size">
          <img src="${esc(p.url)}" alt="${esc(sec.label)}, photo ${i + 1}" loading="lazy"></a>
        <figcaption>${p.source === 'camera' ? '<span class="src-badge src-camera">Taken with camera</span>'
          : p.source === 'gallery' ? '<span class="src-badge src-gallery">From gallery</span>' : ''}</figcaption>
      </figure>`).join('')
    return `
      <div class="photo-section ${sec.sensitive ? 'is-sensitive' : ''}">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
          <h3 class="h6 mb-1">${esc(sec.label)} ${sec.required ? '<span class="small text-secondary fw-normal">required</span>' : '<span class="small text-secondary fw-normal">optional</span>'}</h3>
          <span class="small text-secondary">${list.length} photo(s)</span>
        </div>
        ${sec.sensitive ? `<p class="privacy-note">${esc(sec.privacy_note || '')}</p>
          ${list.length ? '<button type="button" class="btn btn-sm btn-outline-secondary mb-2" data-reveal>Show sensitive photos</button>' : ''}` : ''}
        ${list.length ? `<div class="photo-grid">${tiles}</div>`
          : `<p class="missing-photo mb-0">No photo was sent for this section.</p>`}
      </div>`
  }).join('')
  return `<section class="panel"><h2 class="h5">Photo evidence</h2>${html || '<p class="text-secondary mb-0">No photos were attached.</p>'}</section>`
}

function timeline(history) {
  if (!history.length) return '<p class="text-secondary">No status changes yet.</p>'
  return `<ol class="timeline">${history.map((h, i) => `
    <li class="${i === history.length - 1 ? 'is-current' : ''}">
      <div class="d-flex flex-wrap gap-2 align-items-center">${statusBadge(h.status, h.status_label)}
        <time class="small text-secondary">${esc(formatDateTime(h.date))}</time></div>
      ${h.note ? `<p class="mb-0 mt-1">${esc(h.note)}</p>` : ''}
      ${h.changed_by ? `<p class="small text-secondary mb-0">by ${esc(h.changed_by)}</p>` : '<p class="small text-secondary mb-0">by the system</p>'}
    </li>`).join('')}</ol>`
}

/** Run an API action, then redraw with the report it returns. */
async function act(form, label, path, body) {
  clearErrors(form)
  const alertEl = form.querySelector('[data-alert]')
  if (alertEl) showAlert(alertEl, '')
  await busy(form.querySelector('button[type=submit]'), label, async () => {
    try {
      r = await api(path, { method: 'POST', body })
      toast(api.lastMessage || 'Saved')
      await load()
    } catch (err) {
      if (Object.keys(err.errors).length) showErrors(form, err.errors)
      if (alertEl) showAlert(alertEl, err.message)
    }
  })
}

// ---------- the officer has arrived: compare his GPS with the reporter's pin ----------
function arrivalCheckPanel() {
  const a = r.officer_arrival
  const slot = $('#check-slot')
  if (!a) return
  const radius = Math.round(r.arrival_match_radius_m)
  slot.innerHTML = `
    <section class="panel arrival-check ${a.matches ? 'is-match' : 'is-mismatch'}" id="arrival-check">
      <h2 class="h5">Officer arrival check</h2>
      ${a.review_required ? '<p class="small">GPS readings need evidence review; distance alone does not verify an accident.</p>' : ''}
      <p class="verdict">${a.matches ? 'Pins are within the configured radius' : 'Pins need review'}</p>
      <p class="mb-1">${esc(a.officer || 'The officer')} is <strong>${meters(a.distance_m)}</strong> from the reporter's pin
        (match distance: ${radius} m).</p>
      <p class="small text-secondary">GPS accuracy: officer ${a.accuracy_m != null ? '±' + Math.round(a.accuracy_m) + ' m' : 'not sent'},
        reporter ${r.gps_accuracy_m != null ? '±' + Math.round(r.gps_accuracy_m) + ' m' : 'not sent'}.
        Arrived ${esc(formatDateTime(a.date))}${r.arrival_count > 1 ? `, arrival #${r.arrival_count}` : ''}. Compare the photos with the map before you decide.</p>

      <form id="approve-form" class="mb-3" novalidate>
        <div data-alert></div>
        ${a.matches ? '' : `<p class="small mb-2">The pins are outside ${radius} m. Review the GPS accuracy and evidence, then record your reason to approve or request a new arrival.</p>`}
        <label class="form-label small" for="approve-note">${a.review_required ? 'Evidence checked and approval reason (required)' : 'Review note (optional)'}</label>
        <input id="approve-note" name="note" class="form-control mb-2" placeholder="Plate and vehicles match the photos">
        <button class="btn btn-guide w-100" type="submit" >Approve: officer may clear the site</button>
      </form>

      <form id="resend-form" class="mb-3" novalidate>
        <div data-alert></div>
        <label class="form-label small" for="resend-note">Ask the officer to resend his arrival</label>
        <textarea id="resend-note" name="note" rows="2" class="form-control mb-2" placeholder="Go to the pinned spot near the market entrance, then tap I've arrived again."></textarea>
        <button class="btn btn-outline-guide w-100" type="submit">Ask officer to resend</button>
      </form>

      <form id="false-form" novalidate>
        <div data-alert></div>
        <label class="form-label small" for="false-reason">Reject report after evidence review</label>
        <input id="false-reason" name="note" class="form-control mb-2" placeholder="Explain the evidence supporting rejection">
        <button class="btn btn-outline-danger w-100" type="submit">Reject as false report</button>
      </form>
    </section>`
  $('#approve-form').addEventListener('submit', (e) => {
    e.preventDefault()
    if (a.review_required && !e.target.note.value.trim()) return showErrors(e.target, { note: 'Describe the evidence checked' })
    act(e.target, 'Approving…', '/reports/update-status.php', { id: r.id, status: 'verified', note: e.target.note.value.trim() || null })
  })
  $('#resend-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const note = e.target.note.value.trim()
    if (!note) return showErrors(e.target, { note: 'Tell the officer what to fix' })
    act(e.target, 'Sending…', '/reports/update-status.php', { id: r.id, status: 'assigned', note })
  })
  $('#false-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const reason = e.target.note.value.trim()
    if (!reason) return showErrors(e.target, { note: 'Enter the reason' })
    if (!confirm('Reject this report as false? The reporter and the officer will be told. This cannot be undone.')) return
    act(e.target, 'Rejecting…', '/reports/update-status.php', { id: r.id, status: 'rejected', reason })
  })
}

// ---------- status workflow (FR-07, FR-08) ----------
function statusPanel() {
  const slot = $('#status-slot')
  if (r.status === 'on_scene') return // handled by the arrival check above
  if (r.status === 'duplicate') {
    slot.innerHTML = `
      <form class="panel" id="restore-form" novalidate>
        <h2 class="h5">Not a duplicate?</h2>
        <div data-alert></div>
        <p class="small text-secondary">If this is a different accident (for example another crash at the same corner),
          put it back in the queue as a new report.</p>
        <label class="form-label" for="restore-note">Why it is not a duplicate</label>
        <textarea id="restore-note" name="note" rows="2" class="form-control mb-3"></textarea>
        <button class="btn btn-outline-guide" type="submit">Restore as a new report</button>
      </form>`
    $('#restore-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const note = e.target.note.value.trim()
      if (!note) return showErrors(e.target, { note: 'Say why it is not a duplicate' })
      act(e.target, 'Restoring…', '/reports/update-status.php', { id: r.id, status: 'submitted', note })
    })
    return
  }
  // assigned and on_scene have their own steps (dispatch, arrival)
  const opts = (r.allowed_next_statuses || []).filter((s) => !['assigned', 'on_scene', 'verified'].includes(s))
  const waiting = r.status === 'assigned'
    ? `<p class="small">Waiting for <strong>${esc(r.assigned_officer?.name || 'the officer')}</strong> to reach the pin and tap
        "I've arrived" in the app. You will get a notification.</p>` : ''
  const clearing = ['verified', 'in_progress'].includes(r.status)
    ? `<p class="small">${esc(r.assigned_officer?.name || 'The officer')} clears the site and closes the report in the app.
        You can also close it here.</p>` : ''
  if (!opts.length) {
    slot.innerHTML = `<section class="panel"><h2 class="h5">Update status</h2>${waiting}${clearing}
      <p class="text-secondary mb-0">${waiting || clearing ? '' : 'No further status changes on this report.'}</p></section>`
    return
  }
  slot.innerHTML = `
    <form class="panel" id="status-form" novalidate>
      <h2 class="h5">Update status</h2>
      ${waiting}${clearing}
      ${['submitted', 'under_review'].includes(r.status) ? '<p class="small text-secondary">Next step: send the pin to a traffic officer (Dispatch an officer, below).</p>' : ''}
      <div data-alert></div>
      <label class="form-label" for="next-status">Change to</label>
      <select id="next-status" name="status" class="form-select mb-2" required>
        <option value="">Choose…</option>
        ${opts.map((s) => `<option value="${s}">${esc(STATUS_LABELS[s])}</option>`).join('')}
      </select>
      <label class="form-label" for="status-note" id="note-label">Note (optional)</label>
      <textarea id="status-note" name="note" rows="2" class="form-control mb-3"></textarea>
      <button class="btn btn-guide" type="submit" disabled>Save status</button>
    </form>`
  const form = $('#status-form')
  const labels = {
    duplicate: 'Reason both reports describe the same accident (link the original using Flag first)',
    rejected: 'Reason for rejecting (the reporter sees this)',
    info_required: 'What information is missing? (the reporter sees this)',
    resolved: 'Closing note (optional)',
  }
  form.status.addEventListener('change', () => {
    $('#note-label').textContent = labels[form.status.value] || 'Note (optional)'
    form.querySelector('button[type=submit]').disabled = !form.status.value
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const to = form.status.value
    const note = form.note.value.trim()
    const errors = {}
    if (to === 'rejected' && !note) errors.note = 'Enter the reason'
    if (to === 'duplicate' && !note) errors.note = 'Explain why this is a duplicate'
    if (to === 'info_required' && !note) errors.note = 'Say what is missing'
    if (Object.keys(errors).length) return showErrors(form, errors)
    if (to === 'rejected' && !confirm('Reject this report? This cannot be undone.')) return
    act(form, 'Saving…', '/reports/update-status.php', { id: r.id, status: to, note: note || null, reason: to === 'rejected' ? note : null })
  })
}

// ---------- dispatch: send the pin to a traffic officer ----------
async function assignPanel() {
  const slot = $('#assign-slot')
  const dispatch = ['submitted', 'under_review'].includes(r.status)
  const reassign = ['assigned', 'verified', 'in_progress'].includes(r.status)
  if (!dispatch && !reassign) return
  officers ??= (await api('/users/list.php', { query: { role: 'officer', status: 'active' } }).catch(() => ({ items: [] }))).items
  slot.innerHTML = `
    <form class="panel" id="assign-form" novalidate>
      <h2 class="h5">${dispatch ? 'Dispatch an officer' : 'Change the assigned officer'}</h2>
      ${dispatch ? '<p class="small text-secondary">The officer gets the pin in the app, goes to the scene and taps "I\'ve arrived".</p>' : ''}
      <div data-alert></div>
      <label class="form-label" for="officer">Traffic officer</label>
      <select id="officer" name="officer_id" class="form-select mb-2" required>
        <option value="">Choose…</option>
        ${officers.filter((o) => o.id !== r.assigned_officer?.id).map((o) => `<option value="${o.id}">${esc(o.full_name)} (${esc(o.badge_no || 'no badge')}) - ${o.open_cases} open</option>`).join('')}
      </select>
      <label class="form-label" for="assign-note">Instructions for the officer (optional)</label>
      <textarea id="assign-note" name="note" rows="2" class="form-control mb-3"></textarea>
      <button class="btn btn-guide" type="submit">${dispatch ? 'Send the pin to this officer' : 'Change officer'}</button>
    </form>`
  const form = $('#assign-form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!form.officer_id.value) return showErrors(form, { officer_id: 'Choose an officer' })
    act(form, 'Sending…', '/reports/assign.php', { id: r.id, officer_id: Number(form.officer_id.value), note: form.note.value.trim() || null })
  })
}

// ---------- remarks, findings, actions taken ----------
function remarkPanel() {
  const slot = $('#remark-slot')
  slot.innerHTML = `
    <form class="panel" id="remark-form" novalidate>
      <h2 class="h5">Add a remark, finding or action</h2>
      <div data-alert></div>
      <div class="choice-row mb-2" role="radiogroup" aria-label="Kind">
        <label class="choice is-picked"><input type="radio" name="type" value="remark" checked> Remark</label>
        <label class="choice"><input type="radio" name="type" value="finding"> Finding</label>
        <label class="choice"><input type="radio" name="type" value="action"> Action taken</label>
      </div>
      <textarea name="content" rows="3" class="form-control mb-2" aria-label="Text" placeholder="Example: Plate in the photo matches the vehicle at the scene."></textarea>
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" name="is_internal" id="is-internal" checked>
        <label class="form-check-label" for="is-internal">Internal only (the reporter will not see it)</label>
      </div>
      <button class="btn btn-guide" type="submit">Add</button>
    </form>`
  const form = $('#remark-form')
  form.addEventListener('change', () =>
    form.querySelectorAll('.choice').forEach((l) => l.classList.toggle('is-picked', l.querySelector('input').checked)),
  )
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = formData(form)
    if (f.content.length < 3) return showErrors(form, { content: 'Write the remark' })
    act(form, 'Adding…', '/reports/add-remark.php', { id: r.id, type: f.type, content: f.content, is_internal: f.is_internal })
  })
}

// ---------- flag incomplete or duplicate by hand ----------
function flagPanel() {
  const slot = $('#flag-slot')
  if (['duplicate', 'resolved', 'rejected'].includes(r.status) && !r.is_flagged) return
  slot.innerHTML = r.is_flagged
    ? `<form class="panel" id="flag-form"><h2 class="h5">Flag</h2><div data-alert></div>
        <p class="mb-2">This report is flagged: ${esc(r.flag_reason)}</p>
        <button class="btn btn-outline-secondary" type="submit">Remove flag</button></form>`
    : `<form class="panel" id="flag-form" novalidate><h2 class="h5">Flag as incomplete or duplicate</h2><div data-alert></div>
        <p class="small text-secondary">Flag a possible duplicate for review. Link the original report here, then use Update status to confirm Duplicate with a reason.</p>
        <label class="form-label" for="flag-reason">Reason</label>
        <input id="flag-reason" name="reason" class="form-control mb-2" list="flag-reasons" placeholder="Incomplete details">
        <datalist id="flag-reasons"><option value="Incomplete details"><option value="Duplicate of another report"><option value="Location cannot be confirmed"></datalist>
        <label class="form-label" for="flag-dup">Duplicate of (report ID, optional)</label>
        <input id="flag-dup" name="duplicate_of" class="form-control mb-3" placeholder="RA-2026-000012">
        <button class="btn btn-outline-danger" type="submit">Flag report</button></form>`
  const form = $('#flag-form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const body = r.is_flagged
      ? { id: r.id, flagged: false }
      : { id: r.id, flagged: true, reason: form.reason.value.trim() || null, duplicate_of: form.duplicate_of.value.trim() || null }
    act(form, 'Saving…', '/reports/flag.php', body)
  })
}

// ---------- admin: edit report details (modal) ----------
async function openEdit() {
  options ??= await api('/accident-types/list.php', { query: { all: 1 } })
  const modalEl = $('#edit-modal')
  const form = $('#edit-form')
  form.innerHTML = `
    <div data-alert></div>
    <div class="row g-3">
      <div class="col-sm-6"><label class="form-label" for="e-date">Accident date</label>
        <input id="e-date" type="date" name="accident_date" class="form-control" max="${todayISO()}" value="${esc(r.accident_date)}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-time">Time</label>
        <input id="e-time" type="time" name="accident_time" class="form-control" value="${esc(r.accident_time)}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-type">Type</label>
        <select id="e-type" name="accident_type_id" class="form-select">${options.accident_types.filter((t) => t.is_active || t.id === r.accident_type_id)
          .map((t) => `<option value="${t.id}" ${t.id === r.accident_type_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="col-sm-6"><label class="form-label" for="e-injury">Injuries</label>
        <select id="e-injury" name="injury_status" class="form-select">${options.injury_options
          .map((o) => `<option value="${o.value}" ${o.value === r.injury_status ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
      <div class="col-12"><label class="form-label" for="e-loc">Road, street or landmark</label>
        <input id="e-loc" name="location_text" class="form-control" value="${esc(r.location_text)}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-brgy">Barangay</label>
        <input id="e-brgy" name="barangay" class="form-control" value="${esc(r.barangay || '')}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-mun">Municipality</label>
        <input id="e-mun" name="municipality" class="form-control" value="${esc(r.municipality || '')}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-lat">Latitude</label>
        <input id="e-lat" name="latitude" class="form-control" inputmode="decimal" value="${r.latitude ?? ''}"></div>
      <div class="col-sm-6"><label class="form-label" for="e-lng">Longitude</label>
        <input id="e-lng" name="longitude" class="form-control" inputmode="decimal" value="${r.longitude ?? ''}"></div>
      <div class="col-12"><label class="form-label" for="e-veh">Vehicles (one per line, e.g. "2 Car")</label>
        <textarea id="e-veh" name="vehicles" rows="2" class="form-control">${esc(r.vehicles.map((v) => `${v.quantity} ${v.type}`).join('\n'))}</textarea></div>
      <div class="col-12"><label class="form-label" for="e-desc">What happened</label>
        <textarea id="e-desc" name="description" rows="4" class="form-control">${esc(r.description)}</textarea></div>
    </div>
    <p class="small text-secondary mt-2 mb-0">The old and new values are saved in the audit trail.</p>`
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl)
  modal.show()
  $('#edit-save').onclick = async () => {
    const f = formData(form)
    f.vehicles = f.vehicles
      .split('\n')
      .map((line) => line.trim().match(/^(\d+)\s+(.+)$/) || (line.trim() ? [null, '1', line.trim()] : null))
      .filter(Boolean)
      .map(([, q, t]) => ({ type: t, quantity: Number(q) }))
    f.id = r.id
    clearErrors(form)
    await busy($('#edit-save'), 'Saving…', async () => {
      try {
        r = await api('/reports/edit.php', { method: 'POST', body: f })
        modal.hide()
        toast(api.lastMessage || 'Saved')
        await load()
      } catch (err) {
        showErrors(form, err.errors)
        showAlert(form.querySelector('[data-alert]'), err.message)
      }
    })
  }
}

load()
