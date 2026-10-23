/**
 * Checks a static mockup and (optionally) compares it with the live page.
 *
 *   npm run mock:verify -- --screen reports
 *   npm run mock:verify -- --screen reports --mockup-only
 *
 * What it checks
 *   - every local stylesheet/image/font request resolves
 *   - no console errors or page errors
 *   - the screen has the expected shell and a non-empty main area
 *   - a desktop screenshot can be captured
 *   - with --live, the live route is screenshotted and diffed with pixelmatch
 *
 * The live diff is a design-review signal, not a pass/fail gate: dynamic data,
 * replaced accident photos, map tiles and chart animation can all legitimately
 * differ. The diff image is written next to the mockup.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { DEFAULT_BASE, DEFAULT_EMAIL, DEFAULT_PASSWORD, screenById } from './mock.config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT = resolve(ROOT, 'html-mockups')

const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

const SCREEN = arg('screen')
const BASE = arg('base', DEFAULT_BASE)
const EMAIL = arg('email', DEFAULT_EMAIL)
const PASSWORD = arg('password', DEFAULT_PASSWORD)
const MOCKUP_ONLY = has('mockup-only')
const WIDTH = Number(arg('width', 1440))
const HEIGHT = Number(arg('height', 1000))

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const executablePath = CHROME_PATHS.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Chromium found.')
  process.exit(1)
}

const manifestPath = resolve(OUT, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error('No manifest.json. Run `npm run mock:export` first.')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const screens = SCREEN
  ? manifest.screens.filter((s) => s.id === SCREEN)
  : manifest.screens

if (!screens.length) {
  console.error(`Unknown screen. Available: ${manifest.screens.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
})

const problems = []
let signedIn = false
let livePage = null

async function openLivePage() {
  if (livePage) return livePage
  livePage = await browser.newPage()
  await livePage.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 })
  livePage.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`live console: ${msg.text()}`)
  })
  livePage.on('pageerror', (err) => problems.push(`live pageerror: ${err.message}`))
  return livePage
}

async function signIn(page) {
  if (signedIn) return
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.type('#email', EMAIL)
  await page.type('#password', PASSWORD)
  await Promise.all([
    page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
    page.click('#login-form button[type=submit]'),
  ])
  signedIn = true
}

async function freeze(page) {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await sleep(500)
}

async function captureMockup(screen) {
  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 })
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`mockup console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`mockup pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (url.startsWith('data:')) return
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return
    problems.push(`mockup requestfailed: ${url} (${req.failure()?.errorText})`)
  })
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('fonts.')) {
      problems.push(`mockup HTTP ${res.status()}: ${res.url()}`)
    }
  })

  const file = resolve(OUT, screen.mockup)
  await page.goto(`file://${file}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  await freeze(page)

  const stats = await page.evaluate(() => {
    const main = document.querySelector('.staff-main, .auth-page, .hero, #mock-root')
    return {
      title: document.title,
      main: Boolean(main),
      mainText: (main?.innerText || '').trim().slice(0, 300),
      shell: Boolean(document.querySelector('.staff-shell')),
      sidebar: Boolean(document.querySelector('.sidebar')),
      headings: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).slice(0, 3),
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      viewportWidth: window.innerWidth,
    }
  })

  const buffer = await page.screenshot({ type: 'png' })
  await page.close()
  return { buffer, stats }
}

async function captureLive(screen) {
  const page = await openLivePage()
  const config = screenById(screen.id)
  if (config?.auth) await signIn(page)
  const route = screen.route
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page
    .waitForFunction(() => !document.body.innerText.includes('Loading…'), { timeout: 20000 })
    .catch(() => {})
  await sleep(1800)
  await freeze(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  const buffer = await page.screenshot({ type: 'png' })
  return buffer
}

function diff(before, after, outPath) {
  const a = PNG.sync.read(Buffer.from(before))
  const b = PNG.sync.read(Buffer.from(after))
  const width = Math.min(a.width, b.width)
  const height = Math.min(a.height, b.height)
  const crop = (img) => {
    if (img.width === width && img.height === height) return img
    const out = new PNG({ width, height })
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0)
    return out
  }
  const left = crop(a)
  const right = crop(b)
  const output = new PNG({ width, height })
  const changed = pixelmatch(left.data, right.data, output.data, width, height, {
    threshold: 0.12,
    includeAA: false,
  })
  writeFileSync(outPath, PNG.sync.write(output))
  return { changed, total: width * height, percent: (changed / (width * height)) * 100 }
}

for (const screen of screens) {
  console.log(`\nChecking ${screen.label} (${screen.id})…`)
  problems.length = 0

  let mockup
  try {
    mockup = await captureMockup(screen)
  } catch (error) {
    console.error(`  FAIL could not open mockup: ${error.message}`)
    continue
  }

  const { stats } = mockup
  console.log(`  title:    ${stats.title}`)
  console.log(`  shell:    ${stats.shell ? 'yes' : 'no'} · sidebar: ${stats.sidebar ? 'yes' : 'no'}`)
  console.log(`  headings: ${stats.headings.join(' | ') || '(none)'}`)
  console.log(`  size:     ${stats.bodyWidth}×${stats.bodyHeight} (viewport ${stats.viewportWidth})`)
  if (!stats.main) problems.push('no main content found')
  if (stats.bodyWidth > stats.viewportWidth + 2) {
    problems.push(`horizontal overflow: body is ${stats.bodyWidth}px in a ${stats.viewportWidth}px viewport`)
  }

  if (!MOCKUP_ONLY && !['landing'].includes(screen.id)) {
    try {
      const live = await captureLive(screen)
      const outPath = resolve(OUT, `_screens/${screen.id}/preview-diff.png`)
      const result = diff(mockup.buffer, live, outPath)
      console.log(`  live diff: ${result.percent.toFixed(2)}% (${outPath.replace(ROOT + '/', '')})`)
    } catch (error) {
      problems.push(`live comparison failed: ${error.message}`)
    }
  }

  if (stats.bodyHeight < 300) problems.push('page looks empty (body height < 300px)')

  if (problems.length) {
    console.log('  problems:')
    for (const p of problems) console.log(`    - ${p}`)
  } else {
    console.log('  OK')
  }
}

await browser.close()
console.log('\nDone.')
