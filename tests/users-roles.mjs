/** Offline Users regression. Start Vite, then run `node tests/users-roles.mjs`.
 * Auth and Firestore are browser-only fixtures; every external request is blocked.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.APP_BASE || 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('tmp/users-roles')
fs.mkdirSync(output, { recursive: true })
let firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
firestoreMock = firestoreMock.replace("if (q.name !== 'reports')", `if (q.name === 'users') {
  let rows = [...window.__users];
  for (const p of q.parts || []) if (p.kind === 'where') rows = rows.filter((r) => r[p.field] === p.value);
  const docs = rows.map((r) => ({ id: r.id, data: () => ({ ...r }) }));
  return { docs, size: docs.length };
}
if (q.name !== 'reports')`)
firestoreMock = firestoreMock.replace('export const setDoc = deny, addDoc = deny, patchDoc = deny, removeDoc = deny, createDoc = deny;', `
export const setDoc = async (ref, data) => { window.__writes.push({ id: ref.id, data }); };
export const addDoc = async () => ({ id: 'fixture-audit' });
export const patchDoc = async (_name, id, data) => {
  window.__writes.push({ id, data });
  const row = window.__users.find((r) => r.id === id);
  if (row) Object.assign(row, data);
};
export const removeDoc = deny, createDoc = deny;`)

const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.join(output, 'browser-profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.evaluateOnNewDocument(() => {
    window.__users = [
      { id: 'offline-admin', full_name: 'Fixture Admin', role: 'admin' },
      { id: 'officer', full_name: 'Fixture Officer', role: 'officer', badge_no: 'TEST-1' },
      { id: 'public-officer', full_name: 'Public Officer Promotion', role: 'reporter' },
      { id: 'public-admin', full_name: 'Public Admin Promotion', role: 'reporter' },
      { id: 'public-keep', full_name: 'Public Keep Role', role: 'reporter' },
    ].map((r) => ({ ...r, status: 'active', email: `${r.id}@example.invalid` }))
    window.__fixtures = []
    window.__queryLog = []
    window.__queryDelay = 0
    window.__mode = 'normal'
    window.__writes = []
    window.__authCalls = 0
    const originalFetch = window.fetch
    window.fetch = (url, options) => {
      if (String(url).startsWith('https://identitytoolkit.googleapis.com/')) {
        window.__authCalls += 1
        return Promise.resolve(new Response(JSON.stringify({ localId: `created-${window.__authCalls}` }), { status: 200 }))
      }
      return originalFetch(url, options)
    }
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: { uid: 'offline-admin' }, profile: { role: 'admin', full_name: 'Fixture Admin' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  const clickText = (text) => page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
    if (!button) throw new Error(`Button not found: ${text}`)
    button.click()
  }, text)
  const roleOptions = () => page.$$eval('#u-role option', (options) => options.map((o) => ({ value: o.value, label: o.textContent })))
  const editUser = async (name) => {
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.table tbody tr')].find((r) => r.textContent.includes(name))
      row.querySelector('button').click()
    }, name)
    await page.waitForSelector('#u-role')
  }

  await page.goto(`${base}/admin/users`)
  await page.waitForFunction(() => document.querySelector('.table tbody')?.textContent.includes('Public Keep Role'))
  const filter = await page.$$eval('form[role="search"] select[name="role"] option', (options) => options.map((o) => o.value))
  assert.ok(filter.includes('reporter'))
  await clickText('Add a user')
  await page.waitForSelector('#u-role')
  assert.deepEqual(await roleOptions(), [{ value: 'admin', label: 'Administrator' }, { value: 'officer', label: 'Traffic officer' }])
  assert.ok(await page.$eval('.modal', (el) => el.textContent.includes('Public users register themselves in the mobile app.')))
  await clickText('Cancel')
  await page.waitForSelector('#u-role', { hidden: true })
  for (const [name, id, role] of [['Public Officer Promotion', 'public-officer', 'officer'], ['Public Admin Promotion', 'public-admin', 'admin']]) {
    await editUser(name)
    assert.deepEqual((await roleOptions()).map((o) => o.value), ['admin', 'officer', 'reporter'])
    assert.equal(await page.$eval('#u-role', (el) => el.value), 'reporter')
    await page.select('#u-role', role)
    if (role === 'officer') await page.type('#u-badge', 'TEST-PROMOTED')
    await clickText('Save')
    await page.waitForFunction((id, role) => window.__writes.some((w) => w.id === id && w.data.role === role), {}, id, role)
    await page.waitForSelector('#u-role', { hidden: true })
  }
  await editUser('Fixture Officer')
  assert.deepEqual((await roleOptions()).map((o) => o.value), ['admin', 'officer'])
  await clickText('Cancel')

  const serviceResult = await page.evaluate(async () => {
    const service = await import('/src/services/users.service.js')
    const { ValidationError } = await import('/src/lib/errors.js')
    const { ADMIN_CREATABLE_ROLES } = await import('/src/lib/constants.js')
    const actor = { uid: 'offline-admin', role: 'admin' }
    const fields = { full_name: 'Fixture Staff', email: 'new@example.invalid', password: 'Fixture12345', status: 'active', badge_no: 'TEST-NEW' }
    const rejected = []
    const beforeWrites = window.__writes.length
    for (const role of ['reporter', 'guest', '', null, undefined, {}, ['admin']]) {
      try { await service.createStaffUser({ ...fields, role }, actor); throw new Error('Creation unexpectedly succeeded') }
      catch (error) {
        if (!(error instanceof ValidationError) || !error.errors.role) throw error
        rejected.push(true)
      }
    }
    if (window.__authCalls !== 0 || window.__writes.length !== beforeWrites) throw new Error('Invalid roles reached Auth or a write')
    try { await service.updateStaffUser('officer', { role: 'reporter' }, actor, { role: 'officer' }); throw new Error('Reporter conversion unexpectedly succeeded') }
    catch (error) { if (!(error instanceof ValidationError) || !error.errors.role) throw error }
    await service.updateStaffUser('public-keep', { full_name: 'Public Edited', role: 'reporter' }, actor, { full_name: 'Public Keep Role', role: 'reporter' })
    const invalidMessage = (await service.validateUserFields({ role: 'guest' })).role
    for (const role of ADMIN_CREATABLE_ROLES) await service.createStaffUser({ ...fields, role }, actor)
    return { rejected: rejected.length, authCalls: window.__authCalls, invalidMessage }
  })
  assert.equal(serviceResult.rejected, 7)
  assert.equal(serviceResult.authCalls, 2)
  assert.equal(serviceResult.invalidMessage, 'Choose Administrator or Traffic officer')
  assert.deepEqual(errors, [])
  console.log('PASS: Add offers only admin/officer; reporter filter preserved; existing public users display correctly and promote to either staff role; existing reporters remain editable; invalid creation roles throw ValidationError before any Auth call or write; staff-to-reporter conversion rejected.')
} finally { await browser.close() }
