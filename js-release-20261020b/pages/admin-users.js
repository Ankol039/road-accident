// FR-13 user management: list, search, add, edit role, activate/deactivate. Owner: Alyana (page) + Juliana (API)
import { api } from '../api.js'
import { startPage } from '../app.js'
import { $, busy, clearErrors, esc, formatDate, formData, loadingRow, pager, showAlert, showErrors, toast } from '../ui.js'

const me = await startPage({ roles: ['admin'] })
const filters = $('#filters')
const form = $('#user-form')
const modal = bootstrap.Modal.getOrCreateInstance($('#user-modal'))
const ROLE = { admin: 'Administrator', officer: 'Traffic officer', reporter: 'Public user' }
let page = 1
let users = []

async function load() {
  const rows = $('#rows')
  rows.innerHTML = loadingRow(6)
  try {
    const d = await api('/users/list.php', { query: { ...formData(filters), page, per_page: 25 } })
    users = d.items
    rows.innerHTML = users.length
      ? users
          .map((u) => `<tr>
            <td><strong>${esc(u.full_name)}</strong>${u.id === me.id ? ' <span class="small text-secondary">(you)</span>' : ''}
              <span class="small text-secondary d-block">${esc(u.email)}</span></td>
            <td>${esc(ROLE[u.role])}${u.badge_no ? `<span class="small text-secondary d-block">Badge ${esc(u.badge_no)}</span>` : ''}</td>
            <td>${esc(u.phone || '')}</td>
            <td>${u.status === 'active' ? '<span class="status-badge status-verified">Active</span>' : '<span class="status-badge status-rejected">Inactive</span>'}
              ${u.role === 'officer' ? `<span class="small text-secondary d-block">${u.open_cases} open case(s)</span>` : ''}</td>
            <td class="small">${esc(formatDate(u.created_at))}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-edit="${u.id}">Edit</button></td></tr>`)
          .join('')
      : loadingRow(6, 'No users match.')
    rows.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(users.find((u) => u.id === Number(b.dataset.edit)))))
    pager($('#pager'), d, (p) => {
      page = p
      load()
    })
  } catch (e) {
    rows.innerHTML = loadingRow(6, e.message)
  }
}

function openForm(u = null) {
  form.reset()
  clearErrors(form)
  showAlert($('#form-alert'), '')
  $('#user-modal-title').textContent = u ? `Edit ${u.full_name}` : 'Add a user'
  form.id.value = u?.id || ''
  form.full_name.value = u?.full_name || ''
  form.email.value = u?.email || ''
  form.phone.value = u?.phone || ''
  form.role.value = u?.role || 'officer'
  form.badge_no.value = u?.badge_no || ''
  form.status.value = u?.status || 'active'
  form.password.required = !u
  $('#password-label').textContent = u ? 'New password (leave empty to keep the current one)' : 'Password'
  const self = u?.id === me.id
  form.role.disabled = self
  form.status.disabled = self
  $('#self-note').hidden = !self
  toggleBadge()
  modal.show()
}
const toggleBadge = () => ($('#badge-row').hidden = form.role.value !== 'officer')
form.role.addEventListener('change', toggleBadge)

$('#save-user').addEventListener('click', async () => {
  clearErrors(form)
  const body = formData(form)
  body.id = body.id ? Number(body.id) : undefined
  body.phone = body.phone || null
  body.badge_no = body.role === 'officer' || form.role.disabled ? body.badge_no || null : null
  if (!body.password) delete body.password
  await busy($('#save-user'), 'Saving…', async () => {
    try {
      await api('/users/save.php', { method: 'POST', body })
      modal.hide()
      toast(api.lastMessage || 'Saved')
      load()
    } catch (err) {
      showErrors(form, err.errors)
      showAlert($('#form-alert'), err.message)
    }
  })
})

$('#add-user').addEventListener('click', () => openForm())
filters.addEventListener('submit', (e) => {
  e.preventDefault()
  page = 1
  load()
})
filters.addEventListener('change', () => {
  page = 1
  load()
})
load()
