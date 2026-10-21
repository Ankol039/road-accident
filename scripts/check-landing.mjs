/**
 * Browser check for the public landing page.
 *
 * Proves the things that are easy to get wrong and invisible in the diff:
 *   1. nothing spills outside the page horizontally (marquee / caution tape)
 *   2. the live-map pins land inside the municipality they belong to
 *   3. the "Our vision" list lights up progressively and stays lit
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises the page needs (fonts, React) and the scroll effects never run.
 *
 * USAGE
 *   node scripts/check-landing.mjs
 *   node scripts/check-landing.mjs --shot landing.png
 */
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

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
const SHOT = arg('shot', null)

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
await page.setViewport({ width: 1440, height: 900 })

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))

const settle = (ms = 800) => new Promise((r) => setTimeout(r, ms))
let failed = false
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failed = true
}

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('#livemap svg', { timeout: 20000 })
  await settle(1500)

  /* ---------- 1. horizontal overflow ---------- */
  const overflow = await page.evaluate(() => {
    const de = document.documentElement
    const vw = de.clientWidth
    const wide = []
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (r.right > vw + 1 || r.left < -1) {
        /* ignore anything inside a clipping ancestor */
        let p = el.parentElement
        let clipped = false
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX
          if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') {
            clipped = true
            break
          }
          p = p.parentElement
        }
        if (!clipped) {
          wide.push(`${el.tagName.toLowerCase()}.${el.className || '-'} left=${r.left.toFixed(0)} right=${r.right.toFixed(0)}`)
        }
      }
    })
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: vw,
      bodyScrollWidth: document.body.scrollWidth,
      wide: wide.slice(0, 12),
    }
  })
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    'page does not scroll sideways',
    `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  )
  check(overflow.wide.length === 0, 'no unclipped element spills past the viewport', overflow.wide.join(' | '))

  /* the marquee and the caution tape must stay inside their own boxes */
  const strips = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('.mq, .tapes').forEach((box) => {
      const b = box.getBoundingClientRect()
      const cs = getComputedStyle(box)
      const inner = box.querySelector('.mq-t, .tt')
      const ir = inner ? inner.getBoundingClientRect() : null
      out.push({
        box: box.className,
        overflowX: cs.overflowX,
        left: b.left,
        right: b.right,
        stripLeft: ir ? ir.left : null,
        stripRight: ir ? ir.right : null,
      })
    })
    return out
  })
  for (const s of strips) {
    const clips = s.overflowX === 'hidden' || s.overflowX === 'clip'
    const boxInside = s.left >= -1 && s.right <= 1441
    check(
      clips && boxInside,
      `${s.box} clips its scrolling text inside the page`,
      `overflow-x=${s.overflowX} box=[${s.left.toFixed(0)}..${s.right.toFixed(0)}] strip=[${s.stripLeft?.toFixed(0)}..${s.stripRight?.toFixed(0)}]`,
    )
  }

  /* the marquee strip must be wide enough that the loop has no gap */
  const marquee = await page.evaluate(() => {
    const m = document.querySelector('.mq-t')
    if (!m) return null
    const spans = m.querySelectorAll('span').length
    const group = [...m.children].slice(0, spans / 4)
    const groupWidth = group.reduce((sum, s) => sum + s.getBoundingClientRect().width, 0)
    return { spans, strip: m.scrollWidth, groupWidth }
  })
  check(
    marquee && marquee.spans % 4 === 0 && marquee.strip >= marquee.groupWidth * 3.5,
    'marquee word group is repeated so the scroll is seamless',
    marquee ? `spans=${marquee.spans} strip=${Math.round(marquee.strip)} group=${Math.round(marquee.groupWidth)}` : 'no marquee',
  )

  /* ---------- 3. "Our vision" lights up progressively and stays lit ---------- */
  /* Done before anything else scrolls past the section, otherwise every row
     is already lit when the check starts. */
  const featTop = await page.evaluate(() => {
    const f = document.querySelector('.feat')
    return f.getBoundingClientRect().top + window.scrollY
  })
  const steps = []
  for (const frac of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, featTop - 700 + frac * 1400))
    await settle(400)
    const n = await page.evaluate(
      () => document.querySelectorAll('.feat div.on').length,
    )
    steps.push(n)
  }
  const grew = steps.every((v, i) => i === 0 || v >= steps[i - 1])
  const distinct = new Set(steps).size
  check(grew && distinct >= 3, 'vision list lights up progressively', `on-count per step: ${steps.join(' -> ')}`)

  /* scrolling back up must not switch the lights off again */
  await page.evaluate(() => window.scrollTo(0, 0))
  await settle(600)
  const after = await page.evaluate(() => document.querySelectorAll('.feat div.on').length)
  check(after === steps[steps.length - 1], 'lit vision rows stay lit', `on=${after}`)

  /* ---------- 2. live-map pins land on the right municipality ---------- */
  await page.evaluate(() => {
    const t = document.querySelector('#livemap')
    const r = t.getBoundingClientRect()
    window.scrollTo(0, r.top + window.scrollY + r.height * 0.6)
  })
  await settle(1200)

  const pins = await page.evaluate(() => {
    const svg = document.querySelector('#livemap svg')
    const paths = [...svg.querySelectorAll('#mm path')]
    const inv = svg.getScreenCTM().inverse()
    const pt = svg.createSVGPoint()
    const out = []
    svg.querySelectorAll('#mpins > g').forEach((g) => {
      const pin = g.querySelector('.pin')
      const circle = g.querySelector('circle:not(.sw)')
      const cr = circle.getBoundingClientRect()
      pt.x = cr.left + cr.width / 2
      pt.y = cr.top + cr.height / 2
      const local = pt.matrixTransform(inv)
      const hit = paths.find((p) => p.isPointInFill(local))
      out.push({
        town: (pin.querySelector('title')?.textContent || '').split('·').pop().trim(),
        on: pin.classList.contains('show'),
        inside: hit ? hit.querySelector('title').textContent : null,
      })
    })
    return out
  })
  check(pins.length === 10, 'all ten sample reports are plotted', `found ${pins.length}`)
  const wrong = pins.filter((p) => p.inside && p.inside !== p.town)
  check(wrong.length === 0, 'every pin lands inside its own municipality', wrong.map((p) => `${p.town}->${p.inside}`).join(', '))
  const shown = pins.filter((p) => p.on).length
  check(shown > 0, 'pins appear while scrolling the map section', `${shown} visible`)

  /* the live map must stick to the viewport while the section scrolls */
  const sticky = await page.evaluate(() => {
    const stick = document.querySelector('.mstick')
    const r = stick.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })
  check(
    sticky.top >= -1 && sticky.top < 200,
    'live map section stays stuck to the viewport',
    `sticky top=${sticky.top.toFixed(0)}`,
  )

  /* ---------- 4. fonts ---------- */
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    display: getComputedStyle(document.querySelector('.serif')).fontFamily,
    loaded: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
  }))
  check(/Inter/i.test(fonts.body), 'body font is Inter', fonts.body)
  check(/Jost/i.test(fonts.display), 'display font is Jost', fonts.display)
  check(
    fonts.loaded.some((f) => /^Inter/.test(f) && /loaded/.test(f)) &&
      fonts.loaded.some((f) => /^Jost/.test(f) && /loaded/.test(f)),
    'both web fonts actually loaded',
    fonts.loaded.join(', '),
  )

  if (SHOT) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(400)
    await page.screenshot({ path: SHOT, fullPage: true })
    console.log(`\nscreenshot -> ${SHOT}`)
  }

  if (problems.length) {
    console.log('\n--- problems ---')
    for (const p of [...new Set(problems)]) console.log(`  ${p}`)
  } else {
    console.log('\nno console errors')
  }

  await browser.close()
  process.exit(failed ? 1 : 0)
} catch (error) {
  console.error('\nLANDING CHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error(`  ${p}`)
  }
  try {
    await page.screenshot({ path: 'landing-check-failure.png', fullPage: true })
    console.error('screenshot -> landing-check-failure.png')
  } catch { /* ignore */ }
  await browser.close()
  process.exit(1)
}
