// Accident categories, emergency contacts and system settings. Owner: Alyana (page) + Juliana (API)
import { api } from '../api.js'
import { startPage } from '../app.js'
import { $, busy, clearErrors, esc, formData, loadingRow, showAlert, showErrors, toast } from '../ui.js'

await startPage({ roles: ['admin'] })

// ---------- categories ----------
const typeForm = $('#type-form')
async function loadTypes() {
  const d = await api('/accident-types/list.php', { query: { all: 1 } })
  $('#types').innerHTML = d.accident_types
    .map((t) => `<tr class="${t.is_active ? '' : 'text-secondary'}">
      <td><strong>${esc(t.name)}</strong><span class="small text-secondary d-block">${esc(t.description || '')}</span></td>
      <td class="text-end">${t.report_count}</td>
      <td>${t.is_active ? 'Shown on the form' : 'Hidden'}</td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-edit-type='${esc(JSON.stringify(t))}'>Edit</button>
        <button class="btn btn-sm btn-outline-secondary" data-toggle-type='${esc(JSON.stringify(t))}'>${t.is_active ? 'Hide' : 'Show'}</button>
      </td></tr>`)
    .join('')
  document.querySelectorAll('[data-edit-type]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = JSON.parse(b.dataset.editType)
      typeForm.id.value = t.id
      typeForm.name.value = t.name
      typeForm.description.value = t.description || ''
      $('#type-submit').textContent = 'Save category'
      $('#type-cancel').hidden = false
      typeForm.name.focus()
    }),
  )
  document.querySelectorAll('[data-toggle-type]').forEach((b) =>
    b.addEventListener('click', async () => {
      const t = JSON.parse(b.dataset.toggleType)
      try {
        await api('/accident-types/save.php', { method: 'POST', body: { id: t.id, name: t.name, description: t.description, is_active: !t.is_active } })
        toast(t.is_active ? `${t.name} is hidden from the report form` : `${t.name} is shown again`)
        loadTypes()
      } catch (e) {
        toast(e.message, 'error')
      }
    }),
  )
}
const resetTypeForm = () => {
  typeForm.reset()
  typeForm.id.value = ''
  clearErrors(typeForm)
  $('#type-submit').textContent = 'Add category'
  $('#type-cancel').hidden = true
}
$('#type-cancel').addEventListener('click', resetTypeForm)
typeForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  clearErrors(typeForm)
  const body = formData(typeForm)
  body.id = body.id ? Number(body.id) : undefined
  await busy($('#type-submit'), 'Saving…', async () => {
    try {
      await api('/accident-types/save.php', { method: 'POST', body })
      toast(api.lastMessage)
      resetTypeForm()
      loadTypes()
    } catch (err) {
      showErrors(typeForm, Object.keys(err.errors).length ? err.errors : { name: err.message })
    }
  })
})

// ---------- emergency contacts ----------
const contactForm = $('#contact-form')
async function loadContacts() {
  const list = await api('/emergency-contacts/list.php', { query: { all: 1 } })
  $('#contacts').innerHTML = list.length
    ? list
        .map((c) => `<tr class="${c.is_active ? '' : 'text-secondary'}">
          <td>${c.sort_order}</td><td><strong>${esc(c.name)}</strong><span class="small text-secondary d-block">${esc(c.category || '')}</span></td>
          <td>${esc(c.phone)}</td><td>${c.is_active ? 'Shown' : 'Hidden'}</td>
          <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-edit-contact='${esc(JSON.stringify(c))}'>Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-del-contact="${c.id}" aria-label="Remove ${esc(c.name)}">Remove</button></td></tr>`)
        .join('')
    : loadingRow(5, 'No contacts yet.')
  document.querySelectorAll('[data-edit-contact]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = JSON.parse(b.dataset.editContact)
      for (const k of ['id', 'name', 'phone', 'category', 'sort_order']) contactForm[k].value = c[k] ?? ''
      contactForm.is_active.checked = c.is_active
      $('#contact-submit').textContent = 'Save contact'
      $('#contact-cancel').hidden = false
      contactForm.name.focus()
    }),
  )
  document.querySelectorAll('[data-del-contact]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Remove this contact from the apps?')) return
      await api('/emergency-contacts/save.php', { method: 'POST', body: { id: Number(b.dataset.delContact), delete: true } })
      toast('Contact removed')
      loadContacts()
    }),
  )
}
const resetContactForm = () => {
  contactForm.reset()
  contactForm.id.value = ''
  contactForm.is_active.checked = true
  clearErrors(contactForm)
  $('#contact-submit').textContent = 'Add contact'
  $('#contact-cancel').hidden = true
}
$('#contact-cancel').addEventListener('click', resetContactForm)
contactForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  clearErrors(contactForm)
  const body = formData(contactForm)
  body.id = body.id ? Number(body.id) : undefined
  body.sort_order = Number(body.sort_order || 0)
  await busy($('#contact-submit'), 'Saving…', async () => {
    try {
      await api('/emergency-contacts/save.php', { method: 'POST', body })
      toast(api.lastMessage)
      resetContactForm()
      loadContacts()
    } catch (err) {
      showErrors(contactForm, Object.keys(err.errors).length ? err.errors : { name: err.message })
    }
  })
})

// ---------- system settings ----------
const settingsForm = $('#settings-form')
async function loadSettings() {
  const s = await api('/settings/get.php')
  for (const [k, v] of Object.entries(s)) if (settingsForm[k]) settingsForm[k].value = v
}
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  clearErrors(settingsForm)
  showAlert($('#settings-alert'), '')
  await busy(settingsForm.querySelector('button[type=submit]'), 'Saving…', async () => {
    try {
      await api('/settings/save.php', { method: 'POST', body: formData(settingsForm) })
      toast(api.lastMessage)
    } catch (err) {
      showErrors(settingsForm, err.errors)
      showAlert($('#settings-alert'), err.message)
    }
  })
})

Promise.all([loadTypes(), loadContacts(), loadSettings()]).catch((e) => showAlert($('#error'), e.message))
