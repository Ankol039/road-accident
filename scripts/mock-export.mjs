/**
 * Exports each app screen as a standalone HTML mockup.
 *
 * The output is deliberately self-contained: open the file in a browser and it
 * looks like the real screen, with no Vite, React, Firebase or login.
 *
 * WHAT IT DOES
 *   1. launches Chrome and captures the real rendered DOM
 *   2. freezes landing animations so the page can be edited statically
 *   3. replaces charts and Leaflet maps with screenshots
 *   4. replaces accident photos with a neutral placeholder (no PII leaves the machine)
 *   5. sanitises emails, phone numbers and known user names
 *   6. annotates regions for the HTML -> JSX converter
 *   7. writes index.html, screen.css, notes.md and preview PNGs
 *
 * USAGE
 *   npm run mock:export                 # every screen
 *   npm run mock:export -- --screen reports
 *   npm run mock:export -- --all --no-mobile
 *
 * Options
 *   --screen <id>       export one screen (repeatable)
 *   --all               export every screen (default when no --screen)
 *   --base <url>        running app (default http://127.0.0.1:5173)
 *   --email <address>   admin login
 *   --password <pw>     admin password
 *   --no-mobile         skip the 390px preview
 *   --skip-screenshots  write HTML only
 *   --force             overwrite screen.css and notes.md
 *   --strict            stop on the first screen that fails
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import prettier from 'prettier'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import {
  SCREENS,
  SHARED_SOURCES,
  DEFAULT_BASE,
  DEFAULT_EMAIL,
  DEFAULT_PASSWORD,
} from './mock.config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT = resolve(ROOT, 'html-mockups')
const SHARED = resolve(OUT, '_shared')
const SCREENS_DIR = resolve(OUT, '_screens')

const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)
const argAll = (name) => {
  const values = []
  argv.forEach((value, i) => {
    if (value === `--${name}` && argv[i + 1]) values.push(argv[i + 1])
  })
  return values
}

const BASE = arg('base', DEFAULT_BASE)
const EMAIL = arg('email', DEFAULT_EMAIL)
const PASSWORD = arg('password', DEFAULT_PASSWORD)
const SELECTED = argAll('screen')
const WANT_ALL = has('all') || SELECTED.length === 0
const MOBILE = !has('no-mobile')
const SHOTS = !has('skip-screenshots')
const FORCE = has('force')
const STRICT = has('strict')

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ *
 * Firebase Admin: only used to pick a real report id and collect names
 * so they can be replaced in the mockup. No writes.
 * ------------------------------------------------------------------ */
function serviceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(ROOT, '../private/firebase-service-account.json'),
    resolve(ROOT, 'firebase-service-account.json'),
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p))
}

let db = null
function getDb() {
  if (db) return db
  const keyPath = serviceAccountPath()
  if (!keyPath) throw new Error('No Firebase service-account key found.')
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
  db = getFirestore()
  return db
}

async function exportContext() {
  const context = { reportId: null, names: ['Rina Reyes', 'Miguel Santos', 'RoadReport Admin'] }
  try {
    const firestore = getDb()
    const [reports, users] = await Promise.all([
      firestore.collection('reports').limit(1).get(),
      firestore.collection('users').get(),
    ])
    if (!reports.empty) context.reportId = reports.docs[0].id
    const names = users.docs.map((d) => d.data().full_name).filter(Boolean)
    context.names = [...new Set([...context.names, ...names, 'testAdmin', 'admin'])]
    console.log(`Firebase: report ${context.reportId || '(none)'}, ${context.names.length} names to sanitise`)
  } catch (error) {
    console.warn(`Firebase admin unavailable (${error.message}); using the built-in sample data.`)
  }
  return context
}

/* ------------------------------------------------------------------ *
 * Static assets
 * ------------------------------------------------------------------ */
function prepareShared() {
  mkdirSync(SHARED, { recursive: true })
  mkdirSync(SCREENS_DIR, { recursive: true })

  const copies = [
    ['node_modules/bootstrap/dist/css/bootstrap.min.css', '_shared/bootstrap.min.css'],
    ['node_modules/leaflet/dist/leaflet.css', '_shared/leaflet.css'],
    ['src/styles/app.css', '_shared/app.css'],
    ['src/styles/landing.css', '_shared/landing.css'],
  ]
  for (const [from, to] of copies) {
    const src = resolve(ROOT, from)
    if (!existsSync(src)) throw new Error(`Missing ${from}. Run npm install first.`)
    copyFileSync(src, resolve(OUT, to))
  }

  const leafletImages = resolve(ROOT, 'node_modules/leaflet/dist/images')
  if (existsSync(leafletImages)) {
    /* leaflet.css looks for ./images/... relative to itself. */
    cpSync(leafletImages, resolve(SHARED, 'images'), { recursive: true })
  }
}

/* ------------------------------------------------------------------ *
 * Page capture
 * ------------------------------------------------------------------ */
function sanitizeText(text, names) {
  if (!text) return text
  let out = text
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'admin@example.gov.ph')
  out = out.replace(/(?:\+63|0)\s?\d{2,4}[\s.-]?\d{3}[\s.-]?\d{4}/g, '(044) 000-0000')
  for (const name of names) {
    if (!name || name.length < 3 || name.toLowerCase() === 'admin') continue
    out = out.split(name).join('Demo User')
  }
  return out
}

async function waitForScreen(page, screen) {
  await page.waitForSelector(screen.wait, { timeout: 25000 })
  for (const selector of screen.extraWait || []) {
    await page.waitForSelector(selector, { timeout: 20000 }).catch(() => {})
  }
  await page
    .waitForFunction(() => !document.body.innerText.includes('Loading…'), { timeout: 20000 })
    .catch(() => {})
  await page
    .waitForFunction(
      () => {
        const maps = [...document.querySelectorAll('.leaflet-container')]
        return maps.length === 0 || maps.some((m) => m.querySelector('.leaflet-tile-loaded'))
      },
      { timeout: 15000 },
    )
    .catch(() => {})
  await sleep(1200)
}

async function captureMaps(page) {
  const maps = await page.$$('.leaflet-container')
  const images = []
  for (const [index, map] of maps.entries()) {
    const box = await map.boundingBox()
    if (!box || box.width < 20 || box.height < 20) continue
    const buffer = await map.screenshot({ type: 'png' }).catch(() => null)
    if (!buffer) continue
    images.push({ index, name: `map-${index + 1}.png`, buffer })
  }
  return images
}

function captureEvaluate({ screenId, source, names, mapIndices, captureMode, freezeLanding, linkMap }) {
  /* This function runs inside the browser. Keep it self-contained. */
  const root =
    document.querySelector('#page')?.closest('.staff-shell') ||
    document.querySelector('.staff-shell') ||
    document.querySelector('#root') ||
    document.body

  const sanitize = (text) => {
    if (!text) return text
    let out = text
    out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'admin@example.gov.ph')
    out = out.replace(/(?:\+63|0)\s?\d{2,4}[\s.-]?\d{3}[\s.-]?\d{4}/g, '(044) 000-0000')
    for (const name of names) {
      if (!name || name.length < 3 || name.toLowerCase() === 'admin') continue
      out = out.split(name).join('Demo User')
    }
    return out
  }

  const set = (el, name) => {
    if (!el.hasAttribute('data-rr-region')) el.setAttribute('data-rr-region', name)
  }
  const all = (selector, name) => root.querySelectorAll(selector).forEach((el) => set(el, name))

  /* Freeze scroll-driven landing effects. */
  if (freezeLanding) {
    document.querySelectorAll('.rv, .w, .bar, .dash, .mmap, .steps, .stats, .feat').forEach((el) => {
      el.classList.add('in')
      el.classList.add('on')
    })
    document.querySelectorAll('.feat div').forEach((el) => el.classList.add('on'))
    document.querySelectorAll('.pin').forEach((el) => el.classList.add('show'))
    document.querySelectorAll('.nav').forEach((el) => el.classList.remove('hide'))
    document.querySelectorAll('.hero-in > *').forEach((el) => {
      el.style.opacity = ''
      el.style.transform = ''
    })
    document.querySelectorAll('.feat').forEach((el) => el.style.setProperty('--p', '1'))
  }

  /* Maps: replace with the screenshots captured just before this call. */
  root.querySelectorAll('.leaflet-container').forEach((map, index) => {
    if (!mapIndices.includes(index)) return
    const rect = map.getBoundingClientRect()
    const img = document.createElement('img')
    img.setAttribute('src', `__MAP_${index}__`)
    img.setAttribute('alt', 'Map preview')
    img.setAttribute('data-rr-static', 'map')
    img.className = 'rr-static-map'
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'cover'
    img.setAttribute('width', Math.max(1, Math.round(rect.width)))
    img.setAttribute('height', Math.max(1, Math.round(rect.height)))
    map.replaceWith(img)
  })

  /* All remaining images are accident photos, avatars or remote tiles. */
  root.querySelectorAll('img:not([data-rr-static])').forEach((img) => {
    img.setAttribute('src', '../../_shared/photo-placeholder.svg')
    img.removeAttribute('srcset')
    img.setAttribute('alt', 'Photo placeholder')
  })

  /* Charts: freeze the current frame as a PNG. */
  const charts = []
  root.querySelectorAll('canvas').forEach((canvas, index) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 10 || rect.height < 10) return
    let dataUrl = ''
    try {
      dataUrl = canvas.toDataURL('image/png')
    } catch {
      return
    }
    const img = document.createElement('img')
    img.setAttribute('src', `__CHART_${index}__`)
    img.setAttribute('alt', 'Chart preview')
    img.setAttribute('data-rr-static', 'chart')
    img.className = 'rr-static-canvas'
    img.setAttribute('width', Math.max(1, Math.round(rect.width)))
    img.setAttribute('height', Math.max(1, Math.round(rect.height)))
    canvas.replaceWith(img)
    charts.push({ index, dataUrl })
  })

  /* Sanitise text nodes and the few attributes that can hold PII. */
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)
  for (const node of textNodes) node.nodeValue = sanitize(node.nodeValue)

  for (const el of root.querySelectorAll('[title], [placeholder], [aria-label], [alt], [value]')) {
    for (const attr of ['title', 'placeholder', 'aria-label', 'alt', 'value']) {
      if (!el.hasAttribute(attr)) continue
      const value = el.getAttribute(attr)
      const clean = sanitize(value)
      if (clean !== value) el.setAttribute(attr, clean)
    }
  }

  /* Region metadata for the manifest and the converter report. */
  root.setAttribute('data-rr-screen', screenId)
  root.setAttribute('data-rr-source', source)
  all('.sidebar', 'shell/sidebar')
  all('.side-nav', 'shell/nav')
  all('.staff-main', 'page/root')
  all('h1', 'page/title')
  all('form.filter-bar', 'filter-bar')
  all('.table-responsive', 'table')
  all('tbody tr', 'table-row')
  all('.stat-grid', 'stat-grid')
  all('.stat-card', 'stat-card')
  all('section.panel', 'panel')
  all('.btn-group', 'pager')
  all('.modal.show', 'modal')
  all('.notif-row', 'notification-row')
  all('.timeline', 'timeline')
  all('.photo-section', 'photo-section')
  all('.arrival-check', 'arrival-check')
  all('.chart-box', 'chart')
  all('.map-box', 'map')

  root.querySelectorAll('tbody tr').forEach((row) => row.setAttribute('data-rr-repeat', 'rows'))
  root.querySelectorAll('.stat-card').forEach((card) => card.setAttribute('data-rr-repeat', 'stats'))
  root.querySelectorAll('.notif-row').forEach((row) => row.setAttribute('data-rr-repeat', 'notifications'))
  root.querySelectorAll('.status-badge').forEach((badge) => {
    badge.setAttribute('data-rr-component', 'StatusBadge')
    const statusClass = [...badge.classList].find((c) => c.startsWith('status-') && c !== 'status-badge')
    if (statusClass) badge.setAttribute('data-status', statusClass.slice('status-'.length))
  })

  /* Keep the mockup navigable, but remember the real SPA destination. */
  root.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:|data:)/.test(href)) return
    const target = href.startsWith('/admin/reports/')
      ? '../report-detail/index.html'
      : linkMap[href] || (href.startsWith('/admin') ? '../dashboard/index.html' : null)
    link.setAttribute('data-rr-href', href)
    link.setAttribute('href', target || '#')
  })

  const regions = [
    ...new Set([...root.querySelectorAll('[data-rr-region]')].map((el) => el.getAttribute('data-rr-region'))),
  ]

  return {
    html: captureMode === 'inner' ? root.innerHTML : root.outerHTML,
    regions,
    charts,
    title: document.title,
  }
}

function standaloneDocument({ screen, captured }) {
  const landing = screen.id === 'landing'
  const html = captured.html
    .replace(/__MAP_(\d+)__/g, (_, i) => `./assets/map-${Number(i) + 1}.png`)
    .replace(/__CHART_(\d+)__/g, (_, i) => `./assets/chart-${Number(i) + 1}.png`)

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0e1214" />
  <title>${screen.label} — RoadReport mockup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../../_shared/bootstrap.min.css" />
  <link rel="stylesheet" href="../../_shared/leaflet.css" />
  <link rel="stylesheet" href="../../_shared/app.css" />
${landing ? '  <link rel="stylesheet" href="../../_shared/landing.css" />\n' : ''}  <link rel="stylesheet" href="../../_shared/mock.css" />
  <link rel="stylesheet" href="./screen.css" />
</head>
<body${landing ? ' class="rr-frozen"' : ''}>
<!--
  ROADREPORT UI MOCKUP — ${screen.label}
  Route: ${screen.route}
  Source: ${screen.source[0]}

  This file is a static visual reference. Edit this file and ./screen.css ONLY.
  Do not edit _shared/app.css, other screens, or add new frameworks/fonts.
  Read ../../README.md before changing anything.
  Preserve data-rr-* attributes and {{ ... }} expressions.
  Links point at the sibling mockups; data-rr-href remembers the real SPA route.
${screen.note ? `\n  ${screen.note}\n` : ''}-->
<div id="mock-root">
${html}
</div>
</body>
</html>
`
}

function screenCss(screen) {
  return `/*
 * ${screen.label} — screen-specific styles.
 *
 * This is the only CSS file to edit for this screen.
 * Shared styles live in ../../_shared/app.css and are READ-ONLY.
 * Prefix new classes with \`rr-${screen.id}-\` so they cannot collide.
 */

/* Add screen overrides below this line. */
`
}

function notesTemplate(screen) {
  return `# ${screen.label} — change notes

Route: \`${screen.route}\`
Mockup: \`html-mockups/_screens/${screen.id}/index.html\`
Editable CSS: \`html-mockups/_screens/${screen.id}/screen.css\`

## What changed
- 

## Structural changes
- 

## New classes
- 

## States covered
- [ ] Default
- [ ] Empty
- [ ] Loading
- [ ] Error
- [ ] Mobile (390px)
- [ ] Keyboard focus
- [ ] Reduced motion

## Anything the integrator must know
- 
`
}

async function screenshotMockup(screenDir, outputPath, viewport) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
    const url = `file://${resolve(screenDir, 'index.html')}`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
    await page.evaluate(() => document.fonts?.ready).catch(() => {})
    await sleep(800)
    await page.screenshot({ path: outputPath, fullPage: true })
  } finally {
    await browser.close()
  }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
const CHROME_EXECUTABLE = CHROME_PATHS.find((p) => existsSync(p))
if (!CHROME_EXECUTABLE) {
  console.error('No Chrome/Chromium found. Checked:\n  ' + CHROME_PATHS.join('\n  '))
  process.exit(1)
}

prepareShared()
const context = await exportContext()

const wanted = WANT_ALL ? SCREENS : SCREENS.filter((s) => SELECTED.includes(s.id))
if (!wanted.length) {
  console.error(`Unknown screen. Choose one of: ${SCREENS.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: CHROME_EXECUTABLE,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.warn(`pageerror: ${err.message}`))

let signedIn = false
async function ensureSignedIn() {
  if (signedIn) return
  console.log(`Signing in as ${EMAIL}…`)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.type('#email', EMAIL)
  await page.type('#password', PASSWORD)
  await Promise.all([
    page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
    page.click('#login-form button[type=submit]'),
  ])
  signedIn = true
  console.log('Signed in.')
}

const manifestScreens = []

for (const screen of wanted) {
  const screenDir = resolve(SCREENS_DIR, screen.id)
  const assetsDir = resolve(screenDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  try {
    if (screen.auth) await ensureSignedIn()

    let route = screen.route
    if (screen.resolveRoute && context.reportId) route = `/admin/reports/${context.reportId}`

    console.log(`Exporting ${screen.id} (${route})…`)
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitForScreen(page, screen)

    if (screen.id === 'landing') {
      await page.evaluate(async () => {
        const step = Math.max(320, window.innerHeight * 0.7)
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 80))
        }
        window.scrollTo(0, 0)
      })
      await sleep(600)
    }

    const maps = await captureMaps(page)
    const captured = await page.evaluate(captureEvaluate, {
      screenId: screen.id,
      source: screen.source[0],
      names: context.names,
      mapIndices: maps.map((m) => m.index),
      captureMode: screen.captureMode,
      freezeLanding: Boolean(screen.freezeLanding),
      linkMap: {
        '/': '../landing/index.html',
        '/login': '../login/index.html',
        '/admin': '../dashboard/index.html',
        '/admin/reports': '../reports/index.html',
        '/admin/summaries': '../summaries/index.html',
        '/admin/users': '../users/index.html',
        '/admin/settings': '../settings/index.html',
        '/admin/audit': '../audit/index.html',
        '/admin/notifications': '../notifications/index.html',
        '/admin/account': '../account/index.html',
      },
    })

    /* Write the frozen maps and charts next to the HTML. */
    for (const map of maps) {
      writeFileSync(resolve(assetsDir, map.name), map.buffer)
    }
    for (const chart of captured.charts) {
      const base64 = chart.dataUrl.replace(/^data:image\/png;base64,/, '')
      writeFileSync(resolve(assetsDir, `chart-${chart.index + 1}.png`), Buffer.from(base64, 'base64'))
    }

    let document = standaloneDocument({ screen, captured })
    try {
      document = await prettier.format(document, { parser: 'html', printWidth: 100 })
    } catch (error) {
      console.warn(`  prettier could not format ${screen.id}: ${error.message}`)
    }
    writeFileSync(resolve(screenDir, 'index.html'), document)
    writeFileSync(resolve(screenDir, 'screen.css'), FORCE ? screenCss(screen) : existsSync(resolve(screenDir, 'screen.css')) ? readFileSync(resolve(screenDir, 'screen.css'), 'utf8') : screenCss(screen))
    writeFileSync(resolve(screenDir, 'notes.md'), FORCE ? notesTemplate(screen) : existsSync(resolve(screenDir, 'notes.md')) ? readFileSync(resolve(screenDir, 'notes.md'), 'utf8') : notesTemplate(screen))

    const previews = {}
    if (SHOTS) {
      console.log(`  previews…`)
      previews.desktop = `_screens/${screen.id}/preview-desktop.png`
      await screenshotMockup(screenDir, resolve(screenDir, 'preview-desktop.png'), { width: 1440, height: 1000 })
      if (MOBILE) {
        previews.mobile = `_screens/${screen.id}/preview-mobile.png`
        await screenshotMockup(screenDir, resolve(screenDir, 'preview-mobile.png'), { width: 390, height: 844 })
      }
    }

    manifestScreens.push({
      id: screen.id,
      label: screen.label,
      route,
      mockup: `_screens/${screen.id}/index.html`,
      css: `_screens/${screen.id}/screen.css`,
      notes: `_screens/${screen.id}/notes.md`,
      previews,
      source: screen.source,
      regions: captured.regions,
      note: screen.note || null,
    })
    console.log(`  wrote ${screenDir}`)
  } catch (error) {
    console.error(`FAILED ${screen.id}: ${error.message}`)
    if (STRICT) {
      await browser.close()
      process.exit(1)
    }
  }
}

await browser.close()

/* Manifest + gallery.
 *
 * Exporting one screen must not hide the rest: merge the fresh entries into
 * the existing manifest, then render them in the canonical navigation order.
 */
const manifestPath = resolve(OUT, 'manifest.json')
let previousScreens = []
if (existsSync(manifestPath)) {
  try {
    previousScreens = JSON.parse(readFileSync(manifestPath, 'utf8')).screens || []
  } catch {
    previousScreens = []
  }
}
const byId = new Map(previousScreens.map((screen) => [screen.id, screen]))
for (const screen of manifestScreens) byId.set(screen.id, screen)

const manifest = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  note: 'Static visual mockups. Edit index.html + screen.css only. See README.md.',
  shared: SHARED_SOURCES,
  screens: SCREENS.map((screen) => byId.get(screen.id)).filter(Boolean),
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

writeFileSync(resolve(OUT, 'index.html'), galleryHtml(manifest))

console.log(`\nExported ${manifestScreens.length} screen(s); manifest now lists ${manifest.screens.length}.`)
console.log('Open html-mockups/index.html or run: npm run mock:serve')

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */
function galleryHtml(data) {
  const cards = data.screens
    .map((screen) => {
      const img = screen.previews.desktop
        ? `<img src="${screen.previews.desktop}" alt="${screen.label} desktop preview" loading="lazy" />`
        : '<div class="noimg">no preview</div>'
      return `<article class="card">
  <a class="shot" href="${screen.mockup}" target="_blank" rel="noreferrer">${img}</a>
  <div class="body">
    <div class="head"><h2>${screen.label}</h2><code>${screen.route}</code></div>
    <p>${screen.note || '&nbsp;'}</p>
    <div class="actions">
      <a href="${screen.mockup}" target="_blank" rel="noreferrer">Open mockup</a>
      <a href="${screen.css}" target="_blank" rel="noreferrer">screen.css</a>
      <a href="${screen.notes}" target="_blank" rel="noreferrer">notes.md</a>
      ${screen.previews.desktop ? `<a href="${screen.previews.desktop}" target="_blank" rel="noreferrer">desktop</a>` : ''}
      ${screen.previews.mobile ? `<a href="${screen.previews.mobile}" target="_blank" rel="noreferrer">mobile</a>` : ''}
    </div>
    <details><summary>Source files</summary><ul>${screen.source.map((s) => `<li><code>${s}</code></li>`).join('')}</ul></details>
  </div>
</article>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RoadReport UI mockups</title>
<style>
  :root { color-scheme: dark; --bg:#0e1214; --card:#171c1f; --line:#2a3236; --ink:#f0ece2; --mut:#98a09c; --acc:#e4572e; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 Inter, system-ui, sans-serif; }
  header { padding:48px max(24px, calc((100vw - 1180px)/2)) 24px; border-bottom:1px solid var(--line); }
  h1 { font:500 40px/1.1 Jost, system-ui, sans-serif; margin:0 0 10px; }
  p { color:var(--mut); max-width:70ch; margin:0 0 10px; }
  a { color:var(--acc); }
  .wrap { max-width:1180px; margin:0 auto; padding:24px; }
  .toolbar { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px; }
  .toolbar a { text-decoration:none; border:1px solid var(--line); padding:8px 12px; border-radius:999px; font-size:13px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
  .shot { display:block; aspect-ratio:16/10; overflow:hidden; background:#0a0c0d; border-bottom:1px solid var(--line); }
  .shot img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
  .noimg { display:grid; place-items:center; height:100%; color:var(--mut); font-size:13px; }
  .body { padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; flex:1; }
  .head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
  h2 { font-size:17px; margin:0; }
  code { color:var(--mut); font-size:12px; }
  .card p { font-size:13px; margin:0; }
  .actions { display:flex; gap:10px; flex-wrap:wrap; font-size:13px; }
  details { font-size:12px; color:var(--mut); }
  summary { cursor:pointer; }
  ul { margin:8px 0 0; padding-left:18px; }
  footer { padding:30px 24px 50px; text-align:center; color:var(--mut); font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>RoadReport UI mockups</h1>
  <p>Static, standalone snapshots of every screen. Open a screen, edit its <code>index.html</code> and <code>screen.css</code>, then hand it back. Read <a href="README.md">README.md</a> first.</p>
  <div class="toolbar">
    <a href="_system/index.html">Design system</a>
    <a href="README.md">Handoff rules</a>
    <a href="manifest.json">manifest.json</a>
  </div>
</header>
<main class="wrap">
  <div class="grid">
<article class="card">
  <a class="shot" href="_system/index.html" target="_blank" rel="noreferrer" style="display:grid;place-items:center;height:100%;color:var(--ink);text-decoration:none;font:500 26px Jost,system-ui,sans-serif;background:radial-gradient(60% 70% at 50% 50%,rgba(228,87,46,.18),transparent)">Design system &amp; shell</a>
  <div class="body">
    <div class="head"><h2>Design system</h2><code>_system/index.html</code></div>
    <p>Buttons, forms, badges, tables, cards, alerts, modal, pager and shell. Design this first, then the screens.</p>
    <div class="actions"><a href="_system/index.html" target="_blank" rel="noreferrer">Open style guide</a><a href="_system/system.css" target="_blank" rel="noreferrer">system.css</a></div>
  </div>
</article>
${cards}
  </div>
</main>
<footer>Generated ${new Date(data.generatedAt).toLocaleString()} · ${data.screens.length} screens</footer>
</body>
</html>
`
}
