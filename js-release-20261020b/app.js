// Login check + the page frame (sidebar menu) for the admin website.
// This website is only for administrators.
// Public users (reporters) and traffic officers use the Flutter mobile app.
// Every logged-in page starts with:   const user = await startPage({ roles: ['admin'] })
// Owner: Jan Russel
import { api, clearSession, getSavedUser, getToken, saveSession } from './api.js'
import { APP_NAME } from './config.js'
import { $, esc } from './ui.js'

export const STAFF_ROLES = ['admin']

/** Where an admin lands after logging in. */
export const homeFor = () => 'admin.php'

const BRAND_SVG = `<svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><rect x="10" y="10" width="44" height="44" rx="6" transform="rotate(45 32 32)" fill="#F2B705" stroke="#23272B" stroke-width="4"/><rect x="29" y="18" width="6" height="18" rx="3" fill="#23272B"/><circle cx="32" cy="43" r="3.5" fill="#23272B"/></svg>`
export const brand = (light = false) => `<span class="brand ${light ? 'brand-light' : ''}">${BRAND_SVG}<span>${APP_NAME}</span></span>`

const ADMIN_LINKS = [
  ['admin.php', 'Dashboard'],
  ['admin-reports.php', 'Accident reports'],
  ['admin-summaries.php', 'Summaries and export'],
  ['admin-users.php', 'Users'],
  ['admin-settings.php', 'Categories and settings'],
  ['admin-audit.php', 'Audit trail'],
  ['notifications.php', 'Notifications'],
  ['account.php', 'My account'],
]

export async function logout() {
  try {
    await api('/auth/logout.php', { method: 'POST' })
  } catch {
    /* token may already be expired */
  }
  clearSession()
  location.href = 'login.php'
}

function goLogin() {
  const next = location.pathname.split('/').pop() + location.search
  location.replace('login.php?next=' + encodeURIComponent(next))
}

/** A saved session that belongs to the website (admins only). */
function savedStaffUser() {
  const user = getSavedUser()
  if (!getToken() || !user) return null
  if (!STAFF_ROLES.includes(user.role)) {
    clearSession() // an officer's or public user's login from before the split: not valid here
    return null
  }
  return user
}

/**
 * Check the login, draw the frame around <main id="page">, and return the user.
 * roles: who may open the page (omit = any admin).
 * active: which menu link to highlight (default: this file).
 */
export async function startPage({ roles, active } = {}) {
  const user = savedStaffUser()
  if (!user) {
    goLogin()
    return new Promise(() => {}) // stop the page script here
  }
  if (roles && !roles.includes(user.role)) {
    location.replace(homeFor(user.role))
    return new Promise(() => {})
  }
  window.addEventListener('auth:expired', goLogin)

  // Refresh the saved user in the background (role or name may have changed)
  api('/auth/me.php')
    .then((fresh) => {
      if (!STAFF_ROLES.includes(fresh.role)) return logout()
      saveSession(null, fresh)
      if (fresh.role !== user.role) location.replace(homeFor(fresh.role))
      document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = fresh.full_name))
    })
    .catch(() => {})

  drawFrame(user, active || location.pathname.split('/').pop() || homeFor(user.role))
  refreshUnread()
  return user
}

function drawFrame(user, active) {
  const page = $('#page')
  const nav = ADMIN_LINKS
    .map(([href, label]) => `<a href="${href}" class="${href === active ? 'active' : ''}" ${href === active ? 'aria-current="page"' : ''}>${label}${href === 'notifications.php' ? '<span class="count-pill d-none" data-unread></span>' : ''}</a>`)
    .join('')

  const shell = document.createElement('div')
  shell.className = 'staff-shell'
  shell.innerHTML = `
    <a class="skip-link" href="#page">Skip to content</a>
    <aside class="sidebar">
      <div class="px-3 pt-3 pb-4">
        <a href="${homeFor(user.role)}" class="text-decoration-none">${brand(true)}</a>
        <div class="small text-white-50 mt-2">Administrator</div>
      </div>
      <nav class="side-nav" aria-label="Main">${nav}</nav>
      <div class="sidebar-foot">
        <div class="small text-white mb-2 text-truncate" data-user-name>${esc(user.full_name)}</div>
        <button class="btn btn-sm btn-outline-light w-100" data-logout>Log out</button>
      </div>
    </aside>`
  page.classList.add('staff-main')
  page.parentNode.insertBefore(shell, page)
  shell.append(page)
  page.hidden = false
  page.tabIndex = -1
  shell.querySelector('[data-logout]').addEventListener('click', logout)
}

/** Unread notification count in the menu. Pages can call it again after marking items read. */
export async function refreshUnread() {
  try {
    const d = await api('/notifications/list.php', { query: { unread: 1 } })
    document.querySelectorAll('[data-unread]').forEach((el) => {
      el.textContent = d.unread_count
      el.classList.toggle('d-none', !d.unread_count)
    })
  } catch {
    /* not important */
  }
}

/** For the login and landing pages: skip them if already logged in. */
export function redirectIfLoggedIn() {
  const user = savedStaffUser()
  if (user) {
    location.replace(homeFor(user.role))
    return true
  }
  return false
}
