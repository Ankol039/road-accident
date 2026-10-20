// FR-02 login for administrators. Owner: Jan Russel
// Public users and traffic officers log in on the mobile app; the API refuses their login here.
import { api, saveSession } from '../api.js'
import { homeFor, redirectIfLoggedIn } from '../app.js'
import { $, busy, showAlert } from '../ui.js'

if (!redirectIfLoggedIn()) {
  const form = $('#login-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    showAlert($('#message'), '')
    const email = form.email.value.trim()
    const password = form.password.value
    if (!email || !password) return showAlert($('#message'), 'Enter your email and password')
    await busy(form.querySelector('button[type=submit]'), 'Logging in…', async () => {
      try {
        const data = await api('/auth/login.php', { method: 'POST', body: { email, password, device: 'web' } })
        saveSession(data.token, data.user)
        // Only go back to pages of this site (never to another website)
        const next = param('next')
        const safe = next && /^[a-z0-9-]+\.php(\?[^#]*)?$/i.test(next) && next !== 'login.php'
        location.replace(safe ? next : homeFor())
      } catch (err) {
        showAlert($('#message'), err.message)
      }
    })
  })
}

function param(name) {
  return new URLSearchParams(location.search).get(name)
}
