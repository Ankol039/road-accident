/**
 * Drives the Settings screen: adds a category, hides it, renames it, changes
 * the arrival radius, adds an emergency contact, edits it and removes it.
 *
 * Afterwards each change is read back with the Admin SDK, so "it looked right
 * in the UI" is not enough to pass. The check puts everything back the way it
 * found it.
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises Firebase needs. Puppeteer waits on real events instead.
 *
 * USAGE
 *   node scripts/check-settings.mjs
 */
import { readServiceAccount } from './service-account.mjs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

const BASE = arg('base', process.env.APP_BASE || 'http://localhost:5173')
const EMAIL = arg('email', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')
const PROBE_CATEGORY = 'Probe category'
const PROBE_CONTACT = 'Probe contact'

const here = dirname(fileURLToPath(import.meta.url))
const keyCandidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(here, '../../private/firebase-service-account.json'),
  resolve(here, '../firebase-service-account.json'),
].filter(Boolean)
const keyPath = keyCandidates.find((p) => existsSync(p))
if (!keyPath) {
  console.error('Could not find a service-account key. Looked in:\n  ' + keyCandidates.join('\n  '))
  process.exit(1)
}
initializeApp({ credential: cert(readServiceAccount(keyPath)) })
const db = getFirestore()

const executablePath = CHROME_PATHS.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Chromium found. Checked:\n  ' + CHROME_PATHS.join('\n  '))
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1200 })

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms))
const fail = []

/** The text of the newest toast, '' when there is none. */
const lastToast = () =>
  page.evaluate(() => {
    const all = document.querySelectorAll('.toast-msg')
    return all.length ? all[all.length - 1].innerText.trim() : ''
  })

/**
 * Wait for a toast that is not the one we saw before.
 *
 * Counting the toasts does not work: they disappear again after five
 * seconds, so the count can go down while we are waiting.
 */
const waitForNewToast = async (before) => {
  await page.waitForFunction(
    (old) => {
      const all = document.querySelectorAll('.toast-msg')
      const now = all.length ? all[all.length - 1].innerText.trim() : ''
      return Boolean(now) && now !== old
    },
    { timeout: 20000 },
    before,
  )
}

/** The newest toast — the toasts stack, so the last one is the freshest. */
const toastText = () =>
  page.evaluate(() => {
    const all = document.querySelectorAll('.toast-msg')
    return all.length ? all[all.length - 1].innerText.trim() : ''
  })

/**
 * Put a value into a controlled React input.
 *
 * A triple click plus page.type() does not work here: the focus() that
 * page.type() does collapses the selection, and the text ends up in the
 * middle of the old value. Setting the value through the native setter and
 * firing an "input" event is what React listens to.
 */
const setInput = async (selector, value) => {
  await page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`no element matches ${sel}`)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    selector,
    value,
  )
}

/** Tick or untick a checkbox. */
const setChecked = async (selector, checked) => {
  await page.evaluate(
    (sel, want) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`no element matches ${sel}`)
      if (el.checked !== want) el.click()
    },
    selector,
    checked,
  )
}
const clickByText = async (label, tag = 'button') =>
  page.evaluate(
    (l, t) => {
      const el = [...document.querySelectorAll(t)].find((b) => b.innerText.trim() === l)
      if (!el) throw new Error(`no ${t} says "${l}"`)
      el.click()
    },
    label,
    tag,
  )

/** Click a button inside the row that contains the given text. */
const clickInRow = async (rowText, buttonText) =>
  page.evaluate(
    (row, btn) => {
      const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(row))
      if (!tr) throw new Error(`no row contains "${row}"`)
      const button = [...tr.querySelectorAll('button')].find((b) => b.innerText.trim() === btn)
      if (!button) throw new Error(`the row has no "${btn}" button`)
      button.click()
    },
    rowText,
    buttonText,
  )

let probeCategoryId = null
let probeContactId = null
let originalRadius = null
/* When the probe settings edit happened, so cleanup can drop exactly the
   audit rows it caused without touching an operator's real entries. */
let settingsEditAt = null

const cleanup = async () => {
  /* The app wrote an audit entry for every probe change. Deleting the probe
     entities would leave those entries pointing at nothing, so drop them too.
     Only entries naming one of our probe ids are touched. */
  const probeIds = [probeCategoryId, probeContactId].filter(Boolean)
  for (const entityId of probeIds) {
    try {
      const entries = await db.collection('audit_logs').where('entity_id', '==', entityId).get()
      for (const doc of entries.docs) await doc.ref.delete()
      if (entries.size) console.log(`Cleaned up ${entries.size} audit entries for ${entityId}`)
    } catch (error) {
      console.error(`Could not clean up the audit entries: ${error.message}`)
    }
  }
  if (probeCategoryId) {
    try {
      await db.collection('accident_types').doc(probeCategoryId).delete()
      console.log(`Cleaned up the category ${probeCategoryId}`)
    } catch (error) {
      console.error(`Could not clean up the category: ${error.message}`)
    }
  }
  // A run that stops halfway can leave a probe contact behind.
  try {
    const leftovers = await db
      .collection('emergency_contacts')
      .where('name', '>=', PROBE_CONTACT)
      .where('name', '<=', `${PROBE_CONTACT}z`)
      .get()
    for (const doc of leftovers.docs) {
      /* Sweep the audit entries of anything this catch-all finds too. */
      const entries = await db.collection('audit_logs').where('entity_id', '==', doc.id).get()
      for (const entry of entries.docs) await entry.ref.delete()
      await doc.ref.delete()
      console.log(`Cleaned up the contact ${doc.data().name}`)
    }
  } catch (error) {
    console.error(`Could not clean up the contacts: ${error.message}`)
  }
  if (originalRadius !== null) {
    try {
      await db.collection('settings').doc('arrival_match_radius_m').set({ value: originalRadius })
      console.log(`Restored arrival_match_radius_m to ${originalRadius}`)
    } catch (error) {
      console.error(`Could not restore the setting: ${error.message}`)
    }
  }
  /* The "Save settings" click logged a settings.update row on the fixed
     `system` scope. It names a live scope, so it is not an orphan and the
     orphan sweep keeps it — but the value was restored, so the run left no
     real change behind. Drop the rows this run wrote.
     The boundary is taken from the SERVER clock, because created_at is a
     server timestamp; a client clock running behind would otherwise miss the
     very row we are looking for. The few seconds of slack only ever widen the
     window back over this run, which is seconds long. */
  if (settingsEditAt) {
    try {
      /* Query on entity_id only: the action and the timestamp are filtered in
         JS, so this needs no composite index. */
      const entries = await db.collection('audit_logs').where('entity_id', '==', 'system').get()
      const mine = entries.docs.filter((doc) => {
        const x = doc.data()
        return (
          x.action === 'settings.update' &&
          x.created_at?.toMillis?.() != null &&
          x.created_at.toMillis() >= settingsEditAt.toMillis()
        )
      })
      for (const doc of mine) await doc.ref.delete()
      if (mine.length) console.log(`Cleaned up ${mine.length} settings.update audit entries`)
    } catch (error) {
      console.error(`Could not clean up the settings audit entries: ${error.message}`)
    }
  }
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.type('#email', EMAIL)
  await page.type('#password', PASSWORD)
  await Promise.all([
    page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
    page.click('#login-form button[type=submit]'),
  ])
  console.log(`Signed in as ${EMAIL}`)

  await page.goto(`${BASE}/admin/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#t-name', { timeout: 20000 })
  await settle(1200)

  /* ---------- a category ---------- */
  console.log('\nAdding a category…')
  await setInput('#t-name', PROBE_CATEGORY)
  await setInput('#t-desc', 'A category the check adds and removes again.')
  let toasts = await lastToast()
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Add category').click()
  })
  await waitForNewToast(toasts)
  console.log(`Toast: ${await toastText()}`)
  await settle(1500)

  const typeSnap = await db.collection('accident_types').where('name', '==', PROBE_CATEGORY).get()
  if (typeSnap.empty) {
    fail.push('the category was not written to Firestore')
  } else {
    probeCategoryId = typeSnap.docs[0].id
    const type = typeSnap.docs[0].data()
    console.log(`Firestore accident_types/${probeCategoryId}: ${JSON.stringify(type)}`)
    if (type.description !== 'A category the check adds and removes again.') {
      fail.push('the description was not saved')
    }
    if (type.active !== true) fail.push('a new category should be active')
  }

  // ---- the same name twice is refused ----
  await setInput('#t-name', PROBE_CATEGORY)
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Add category').click()
  })
  await settle(1200)
  const typeErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.invalid-feedback.d-block')].map((e) => e.innerText.trim()),
  )
  console.log(`Field errors: ${JSON.stringify(typeErrors)}`)
  if (!typeErrors.includes('A category with this name already exists')) {
    fail.push('the screen did not refuse a duplicate category name')
  }
  await setInput('#t-name', '')

  // ---- hide it ----
  console.log('\nHiding the category…')
  await clickInRow(PROBE_CATEGORY, 'Hide')
  await settle(1500)
  const hidden = await db.collection('accident_types').doc(probeCategoryId).get()
  if (hidden.data().active !== false) fail.push('the category was not hidden')
  else console.log('  active: false')

  // ---- show it again and rename it ----
  console.log('\nRenaming the category…')
  await clickInRow(PROBE_CATEGORY, 'Show')
  await settle(1500)
  await clickInRow(PROBE_CATEGORY, 'Edit')
  await page.waitForSelector('#t-name', { timeout: 10000 })
  await setInput('#t-name', 'Probe category renamed')
  toasts = await lastToast()
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save category').click()
  })
  await waitForNewToast(toasts)
  await settle(1500)
  const renamed = await db.collection('accident_types').doc(probeCategoryId).get()
  console.log(`  name: ${renamed.data().name}, active: ${renamed.data().active}`)
  if (renamed.data().name !== 'Probe category renamed') fail.push('the category was not renamed')
  if (renamed.data().active !== true) fail.push('the category was not shown again')

  /* ---------- the system settings ---------- */
  console.log('\nChanging the arrival radius…')
  const before = await db.collection('settings').doc('arrival_match_radius_m').get()
  originalRadius = before.data()?.value ?? null
  /* Anchor to the SERVER clock (created_at is a server timestamp), backed off
     a little so ordering within the same second cannot slip the row before
     the boundary. */
  settingsEditAt = Timestamp.fromMillis((before.updateTime?.toMillis() ?? Date.now()) - 3000)
  await setInput('#s-match', '95')
  toasts = await lastToast()
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save settings').click()
  })
  await waitForNewToast(toasts)
  console.log(`Toast: ${await toastText()}`)
  await settle(1500)
  const after = await db.collection('settings').doc('arrival_match_radius_m').get()
  console.log(`  arrival_match_radius_m: ${after.data()?.value}`)
  if (Number(after.data()?.value) !== 95) fail.push('the arrival radius was not saved')

  // ---- a number out of range is refused ----
  await setInput('#s-match', '900')
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save settings').click()
  })
  await settle(1200)
  const settingErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.invalid-feedback.d-block')].map((e) => e.innerText.trim()),
  )
  console.log(`Field errors: ${JSON.stringify(settingErrors)}`)
  if (!settingErrors.includes('Enter a number from 5 to 500')) {
    fail.push('the screen did not refuse a radius of 900')
  }
  const stillThere = await db.collection('settings').doc('arrival_match_radius_m').get()
  if (Number(stillThere.data()?.value) !== 95) fail.push('the refused value was written anyway')

  /* ---------- an emergency contact ---------- */
  console.log('\nAdding an emergency contact…')
  await setInput('#c-name', PROBE_CONTACT)
  await setInput('#c-phone', '(044) 555 0100')
  await setInput('#c-cat', 'Rescue')
  await setInput('#c-order', '9')
  toasts = await lastToast()
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Add contact').click()
  })
  await waitForNewToast(toasts)
  console.log(`Toast: ${await toastText()}`)
  await settle(1500)

  const contactSnap = await db
    .collection('emergency_contacts')
    .where('name', '==', PROBE_CONTACT)
    .get()
  if (contactSnap.empty) {
    fail.push('the contact was not written to Firestore')
  } else {
    probeContactId = contactSnap.docs[0].id
    const contact = contactSnap.docs[0].data()
    console.log(`Firestore emergency_contacts: ${JSON.stringify(contact)}`)
    if (contact.phone !== '(044) 555 0100') fail.push('the phone was not saved')
    if (contact.category !== 'Rescue') fail.push('the category was not saved')
    if (Number(contact.sort_order) !== 9) fail.push('the order was not saved')
    if (contact.is_active !== true) fail.push('the contact should be shown')
  }

  // ---- edit it ----
  console.log('\nEditing the contact…')
  await clickInRow(PROBE_CONTACT, 'Edit')
  await page.waitForSelector('#c-name', { timeout: 10000 })
  await setInput('#c-name', 'Probe contact renamed')
  await setChecked('#c-active', false)
  toasts = await lastToast()
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save contact').click()
  })
  await waitForNewToast(toasts)
  await settle(1500)
  const edited = await db
    .collection('emergency_contacts')
    .where('name', '==', 'Probe contact renamed')
    .get()
  if (edited.empty) fail.push('the contact was not renamed')
  else if (edited.docs[0].data().is_active !== false) fail.push('the contact was not hidden')

  // ---- remove it ----
  console.log('\nRemoving the contact…')
  await clickInRow('Probe contact renamed', 'Remove')
  await page.waitForSelector('.modal.show', { timeout: 10000 })
  await page.evaluate(() => {
    const modal = document.querySelector('.modal.show')
    ;[...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Remove').click()
  })
  await settle(1800)
  const gone = await db
    .collection('emergency_contacts')
    .where('name', '==', 'Probe contact renamed')
    .get()
  if (!gone.empty) fail.push('the contact was not removed')

  /* ---------- the audit trail ---------- */
  const audit = await db.collection('audit_logs').get()
  const actions = audit.docs.map((d) => d.data().action)
  const wanted = ['type.create', 'type.toggle', 'type.update', 'settings.update', 'contact.create', 'contact.update', 'contact.delete']
  const missing = wanted.filter((a) => !actions.includes(a))
  if (missing.length) fail.push(`no audit entry for: ${missing.join(', ')}`)

  if (problems.length) {
    console.log('\n--- console problems ---')
    for (const p of [...new Set(problems)]) console.log('  ' + p)
  }

  if (fail.length) {
    console.log('\nSETTINGS CHECK FAILED')
    for (const f of fail) console.log('  - ' + f)
    await browser.close()
    await cleanup()
    process.exit(1)
  }

  console.log('\nSETTINGS CHECK PASSED')
  await browser.close()
  await cleanup()
  process.exit(0)
} catch (error) {
  console.error('\nCHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error('  ' + p)
  }
  await browser.close()
  await cleanup()
  process.exit(1)
}
