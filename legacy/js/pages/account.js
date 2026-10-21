// Account page for every role: edit name, email, phone, password.
import { api, saveSession } from '../api.js'
import { startPage } from '../app.js'
import { $, busy, clearErrors, formData, showErrors, toast } from '../ui.js'

let user = await startPage()
const profile = $('#profile-form')
const password = $('#password-form')
const roleLabel = { admin: 'Administrator', officer: 'Traffic officer' }

function fill() {
  profile.full_name.value = user.full_name
  profile.email.value = user.email
  profile.phone.value = user.phone || ''
  $('#role').textContent = roleLabel[user.role] + (user.badge_no ? `, badge ${user.badge_no}` : '')
}
fill()

profile.addEventListener('submit', async (e) => {
  e.preventDefault()
  clearErrors(profile)
  const body = formData(profile)
  body.phone = body.phone || null
  if (body.email.toLowerCase() === user.email) delete body.email
  if (!body.current_password) delete body.current_password
  await busy(profile.querySelector('button[type=submit]'), 'Saving…', async () => {
    try {
      user = await api('/auth/update-profile.php', { method: 'POST', body })
      saveSession(null, user)
      document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = user.full_name))
      profile.current_password.value = ''
      fill()
      toast(api.lastMessage || 'Profile saved')
    } catch (err) {
      showErrors(profile, Object.keys(err.errors).length ? err.errors : { full_name: err.message })
    }
  })
})
profile.email.addEventListener('input', () => {
  $('#email-password').hidden = profile.email.value.trim().toLowerCase() === user.email
})

password.addEventListener('submit', async (e) => {
  e.preventDefault()
  clearErrors(password)
  const body = formData(password)
  await busy(password.querySelector('button[type=submit]'), 'Saving…', async () => {
    try {
      await api('/auth/update-profile.php', { method: 'POST', body })
      password.reset()
      toast('Password changed. Your other devices were logged out.')
    } catch (err) {
      showErrors(password, Object.keys(err.errors).length ? err.errors : { password: err.message })
    }
  })
})
