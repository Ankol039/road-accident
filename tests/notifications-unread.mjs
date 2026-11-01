/** Offline browser regression. Start Vite, then run `node tests/notifications-unread.mjs`.
 * Notification fixtures persist only in this isolated browser's localStorage.
 * All external requests are blocked. The real notification service and provider run unchanged.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.APP_BASE || 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('tmp/notifications-unread')
fs.mkdirSync(output, { recursive: true })
let firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
firestoreMock = firestoreMock.replace('export async function getDocs(q)', 'async function otherGetDocs(q)')
firestoreMock = firestoreMock.replace('export const setDoc = deny, addDoc = deny, patchDoc = deny, removeDoc = deny, createDoc = deny;', 'export const setDoc = deny, addDoc = deny, removeDoc = deny, createDoc = deny;')
firestoreMock = firestoreMock.replace('export const writeBatch = deny, runTransaction = deny;', 'export const runTransaction = deny;')
firestoreMock += `
export async function getDocs(q) {
  if (q.name !== 'notifications') return otherGetDocs(q);
  let rows = [...window.__notifications];
  for (const p of q.parts || []) {
    if (p.kind === 'where') rows = rows.filter((r) => r[p.field] === p.value);
    if (p.kind === 'limit') rows = rows.slice(0, p.value);
  }
  const docs = rows.map((r) => ({ id: r.id, ref: docRef('notifications', r.id), data: () => ({ ...r }) }));
  if (q.parts.some((p) => p.kind === 'limit' && p.value === 99)) {
    window.__countReads += 1;
    if (window.__holdCounts) await new Promise((resolve) => window.__countWaiters.push(resolve));
  }
  return { docs, size: docs.length };
}
function validate(id, data) {
  if (Object.keys(data).join(',') !== 'read' || data.read !== true) throw new Error('Forbidden notification fields');
  if (window.__notifications.find((r) => r.id === id)?.user_id !== 'offline-admin') throw new Error('Not the recipient');
}
async function gate() {
  if (window.__holdWrites) await new Promise((resolve) => window.__writeWaiters.push(resolve));
}
function apply(id, data) {
  validate(id, data);
  window.__writes.push({ id, data });
  Object.assign(window.__notifications.find((r) => r.id === id), data);
  window.__save();
}
export async function patchDoc(name, id, data) {
  if (name !== 'notifications') throw new Error('Unexpected write');
  validate(id, data);
  window.__singleCalls += 1;
  await gate();
  if (window.__failSingle === id) throw new Error('Fixture permission denied');
  apply(id, data);
}
export function writeBatch() {
  const ops = [];
  return {
    update(ref, data) { validate(ref.id, data); ops.push({ id: ref.id, data }); },
    async commit() {
      const call = ++window.__batchCalls;
      if (ops.length > 500) throw new Error('Batch limit exceeded');
      await gate();
      if (window.__failBatchAt === call) throw new Error('Fixture batch denied');
      ops.forEach(({ id, data }) => apply(id, data));
    },
  };
}
`

const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.join(output, 'browser-profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.evaluateOnNewDocument(() => {
    window.__key = 'rr-offline-notification-fixtures'
    window.__seed = (count, reportCode = false) => [
      ...Array.from({ length: count }, (_, i) => ({
        id: `n${i + 1}`, user_id: 'offline-admin', title: `Unread fixture ${i + 1}`,
        message: 'Offline notification fixture', created_at: '2026-11-01T06:30:00Z', read: false,
        report_code: reportCode && i === 0 ? 'RA-FIXTURE' : null,
      })),
      { id: 'read', user_id: 'offline-admin', title: 'Already read fixture', read: true },
      { id: 'other', user_id: 'someone-else', title: 'Other recipient', read: false },
    ]
    window.__notifications = JSON.parse(localStorage.getItem(window.__key) || 'null') || window.__seed(3)
    window.__save = () => localStorage.setItem(window.__key, JSON.stringify(window.__notifications))
    window.__save()
    window.__fixtures = []
    window.__queryLog = []
    window.__mode = 'normal'
    window.__queryDelay = 0
    window.__countReads = 0
    window.__singleCalls = 0
    window.__batchCalls = 0
    window.__writes = []
    window.__writeWaiters = []
    window.__countWaiters = []
    window.__intervals = new Map()
    const interval = window.setInterval, clear = window.clearInterval
    window.setInterval = (fn, ms, ...args) => {
      const id = interval(fn, ms, ...args)
      if (ms === 60000) window.__intervals.set(id, fn)
      return id
    }
    window.clearInterval = (id) => { window.__intervals.delete(id); return clear(id) }
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['data:', 'blob:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: { uid: 'offline-admin' }, profile: { role: 'admin', status: 'active', full_name: 'Offline Admin' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  const pill = async (expected) => page.waitForFunction((expected) => {
    const el = document.querySelector('.side-nav .count-pill')
    return expected === 0 ? !el : el?.textContent === String(expected)
  }, {}, expected)
  const row = (id) => `.notif-row[data-id="${id}"]`
  const read = (id, value) => page.waitForFunction((id, value) => document.querySelector(`.notif-row[data-id="${id}"]`)?.dataset.read === (value ? '1' : '0'), {}, id, value)
  const reset = async (count = 3, reportCode = false) => {
    await page.evaluate((count, reportCode) => localStorage.setItem(window.__key, JSON.stringify(window.__seed(count, reportCode))), count, reportCode)
    await page.goto(`${base}/admin/notifications`)
    await page.waitForSelector(row('n1'))
    await pill(count >= 99 ? '99+' : count)
  }
  const releaseWrites = () => page.evaluate(() => {
    window.__holdWrites = false
    window.__writeWaiters.splice(0).forEach((resolve) => resolve())
  })
  await page.goto(`${base}/admin/notifications`)
  await reset()
  assert.equal(await page.evaluate(() => window.__intervals.size), 1, 'Only one 60-second poll should exist')
  const styles = await page.evaluate(() => ['n1', 'read'].map((id) => {
    const el = document.querySelector(`.notif-row[data-id="${id}"]`), css = getComputedStyle(el)
    return { color: css.color, border: css.borderLeftColor, background: css.backgroundColor, weight: getComputedStyle(el.querySelector('strong')).fontWeight }
  }))
  assert.ok(Number(styles[0].weight) > Number(styles[1].weight))
  assert.notEqual(styles[0].border, styles[1].border)
  assert.notEqual(styles[0].background, styles[1].background)

  // Hold an old count query across a click: it must not undo the optimistic decrement.
  await page.evaluate(() => {
    window.__holdCounts = true
    window.__holdWrites = true
    window.__poll = [...window.__intervals.values()][0]()
  })
  await page.waitForFunction(() => window.__countWaiters.length === 1)
  await page.click(row('n1'))
  await read('n1', true)
  await pill(2)
  await page.click(row('n1'))
  assert.equal(await page.evaluate(() => window.__singleCalls), 1)
  await page.evaluate(async () => {
    window.__holdCounts = false
    window.__countWaiters.splice(0).forEach((resolve) => resolve())
    await window.__poll
  })
  await pill(2)
  const reads = await page.evaluate(() => window.__countReads)
  await page.evaluate(async () => { await [...window.__intervals.values()][0]() })
  assert.equal(await page.evaluate(() => window.__countReads), reads, 'Polling should defer while writing')
  await releaseWrites()
  await page.waitForFunction(() => window.__notifications.find((n) => n.id === 'n1').read)
  await page.reload()
  await read('n1', true)
  await pill(2)
  await page.click(row('n1'))
  assert.equal(await page.evaluate(() => window.__singleCalls), 0, 'Read rows must not write or decrement again')
  await pill(2)

  await page.evaluate(() => { window.__holdWrites = true })
  await page.click('#mark-all')
  await pill(0)
  await read('n2', true)
  await read('n3', true)
  await releaseWrites()
  await page.waitForFunction(() => window.__notifications.filter((n) => n.user_id === 'offline-admin').every((n) => n.read))
  await page.reload()
  await read('n1', true)
  await read('n2', true)
  await read('n3', true)
  await pill(0)

  // Two writes may settle differently; rollback only the failed row and its decrement.
  await reset()
  await page.evaluate(() => { window.__holdWrites = true; window.__failSingle = 'n1' })
  await page.click(row('n1'))
  await page.click(row('n2'))
  await pill(1)
  await page.evaluate(() => window.__writeWaiters.shift()())
  await read('n1', false)
  await pill(2)
  await read('n2', true)
  await page.waitForFunction(() => document.querySelector('.toast-error')?.textContent.includes('Could not mark the notification'))
  await releaseWrites()
  await page.waitForFunction(() => window.__notifications.find((n) => n.id === 'n2').read)
  await pill(2)

  await reset()
  await page.evaluate(() => { window.__holdWrites = true; window.__failBatchAt = 1 })
  await page.click('#mark-all')
  await pill(0)
  await releaseWrites()
  await page.waitForFunction(() => document.querySelector('.toast-error')?.textContent.includes('Could not mark all'))
  await pill(3)
  for (const id of ['n1', 'n2', 'n3']) await read(id, false)
  await read('read', true)

  await reset(600)
  await page.click('#mark-all')
  await pill(0)
  await page.waitForFunction(() => window.__notifications.filter((n) => n.user_id === 'offline-admin').every((n) => n.read))
  assert.equal(await page.evaluate(() => window.__batchCalls), 2)
  assert.equal(await page.evaluate(() => window.__notifications.find((n) => n.id === 'other').read), false)
  assert.ok(await page.evaluate(() => window.__writes.every((w) => Object.keys(w.data).join(',') === 'read' && w.data.read === true)))

  await reset(600)
  await page.evaluate(() => { window.__failBatchAt = 2 })
  await page.click('#mark-all')
  await page.waitForFunction(() => document.querySelector('.toast-error')?.textContent.includes('Could not mark all'))
  await pill('99+')
  await read('n1', true)
  await page.waitForSelector('#mark-all:not([disabled])')
  await page.click('#mark-all')
  await page.waitForFunction(() => window.__notifications.filter((n) => n.user_id === 'offline-admin').every((n) => n.read))
  await pill(0)

  await reset(3, true)
  await page.click(row('n1'))
  await page.waitForFunction(() => location.pathname === '/admin/reports')
  await pill(2)
  await page.click('.side-nav a[href="/admin/notifications"]')
  await read('n1', true)
  await pill(2)
  assert.equal(await page.evaluate(() => window.__intervals.size), 1)
  assert.deepEqual(errors, [])
  console.log('PASS: shared immediate count/row updates, no duplicate decrements, single/bulk rollback toasts, stale poll protection, 60-second shared polling, reload persistence, 99+ cap, batches over 500, recipient-only read:true writes, and report navigation.')
} finally { await browser.close() }
