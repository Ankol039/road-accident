/**
 * Landing page (the public front door).
 *
 * Ported from index.php, which itself came from "RoadReport: Bulacan Admin
 * Portal.html". The markup and its scroll-driven animation are kept as-is; the
 * three inline <script> blocks became a single useEffect so React owns the
 * listeners and can clean them up.
 *
 * Styles live in src/styles/landing.css (loaded by main.jsx).
 */
import { useEffect, useRef } from 'react'
import LandingMap from './LandingMap.jsx'
import { LANDING_HTML } from '../styles/landing-markup.js'

export default function Landing() {
  const root = useRef(null)

  useEffect(() => {
    const cleanups = []
    const root$ = root.current
    if (!root$) return undefined

    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts)
      cleanups.push(() => target.removeEventListener(type, fn, opts))
    }

    /* ---------- 1. reveal-on-scroll ---------- */
    try {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              io.unobserve(e.target)
            }
          }),
        { threshold: 0.15 },
      )
      root$.querySelectorAll('.rv').forEach((el) => io.observe(el))
      cleanups.push(() => io.disconnect())
    } catch {
      root$.querySelectorAll('.rv').forEach((el) => el.classList.add('in'))
    }

    /* ---------- 2. hero collision scene ---------- */
    const tr = root$.querySelector('.track')
    const hint = root$.querySelector('#hint')
    const tri = root$.querySelector('.tri')
    const jeep = root$.querySelector('.jeep')
    const rings = root$.querySelectorAll('.ring')
    const scan = root$.querySelector('.scan')
    const tag = root$.querySelector('.tag')
    const scene = root$.querySelector('.scene')
    const heroIn = root$.querySelector('.hero-in')
    const heroText = heroIn ? [...heroIn.children].filter((e) => e !== scene) : []

    if (tr && tri && jeep) {
      const clamp = (v) => Math.max(0, Math.min(1, v))
      const ease = (t) => 1 - (1 - t) ** 3

      const frame = () => {
        const r = tr.getBoundingClientRect()
        const p = clamp(-r.top / (r.height - window.innerHeight))
        const a = ease(clamp(p / 0.5))
        const m = clamp((p - 0.5) / 0.06)
        tri.style.transform = `translateX(${-460 * (1 - a) - 16 * m}px)`
        jeep.style.transform = `translateX(${460 * (1 - a) + 12 * m}px)`
        tri.style.opacity = clamp(p * 8)
        jeep.style.opacity = tri.style.opacity
        rings.forEach((x, i) => {
          const k = clamp((p - 0.5 - i * 0.04) / 0.25)
          x.style.transform = `scale(${0.1 + k * 3.1})`
          x.style.opacity = k > 0 && k < 1 ? 1 - k : 0
        })
        if (scan) {
          const s = clamp((p - 0.58) / 0.3)
          scan.style.transform = `translateY(${s * 190}px)`
          scan.style.opacity = s > 0 && s < 1 ? 0.9 : 0
        }
        if (tag) {
          const g = clamp((p - 0.72) / 0.1)
          tag.style.opacity = g
          tag.style.transform = `translateY(${(1 - g) * 10}px)`
        }
        heroText.forEach((x) => {
          x.style.opacity = 1 - clamp(p / 0.4)
          x.style.transform = `translateY(${-p * 60}px)`
        })
        if (scene) scene.style.transform = `scale(${1 + p * 0.12})`
        if (hint) hint.textContent = p < 0.5 ? 'Scroll to discover' : p < 0.72 ? 'Impact detected' : 'Report logged'
      }

      on(window, 'scroll', frame, { passive: true })
      on(window, 'resize', frame)
      frame()
    }

    /* ---------- 3. feature cards + heading word reveal ---------- */
    try {
      const feat = root$.querySelector('.feat')
      if (feat) {
        /* The vision list lights up progressively as it scrolls past: a card
           switches on once its top reaches the bottom tenth of the viewport
           and stays on for the rest of the visit. */
        const cards = [...feat.querySelectorAll('div')]
        const lit = new Set()
        const clamp = (v) => Math.max(0, Math.min(1, v))
        const update = () => {
          const vh = window.innerHeight
          cards.forEach((c) => {
            if (lit.has(c)) return
            const r = c.getBoundingClientRect()
            if (r.top < vh * 0.9) {
              lit.add(c)
              c.classList.add('on')
            }
          })
          /* progress rail down the left edge of the list */
          const fr = feat.getBoundingClientRect()
          feat.style.setProperty('--p', clamp((vh * 0.58 - fr.top) / fr.height))
        }
        on(window, 'scroll', update, { passive: true })
        on(window, 'resize', update)
        update()
      }

      let n = 0
      const split = (el) =>
        [...el.childNodes].forEach((node) => {
          if (node.nodeType === 3) {
            const frag = document.createDocumentFragment()
            node.textContent.split(/(\s+)/).forEach((w) => {
              if (!w.trim()) {
                frag.append(' ')
                return
              }
              const s = document.createElement('span')
              s.className = 'w'
              s.style.setProperty('--i', n++)
              s.textContent = w
              frag.append(s)
            })
            node.replaceWith(frag)
          } else if (node.nodeType === 1 && node.tagName !== 'BR') {
            split(node)
          }
        })

      const wo = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              wo.unobserve(e.target)
            }
          }),
        { threshold: 0.2 },
      )
      root$.querySelectorAll('h1,h2').forEach((x) => {
        n = 0
        split(x)
        wo.observe(x)
      })
      cleanups.push(() => wo.disconnect())
    } catch {
      /* decorative only */
    }

    /* ---------- 4. nav shrink + canvases + counters ---------- */
    const nav = root$.querySelector('.nav')
    if (nav) on(window, 'scroll', () => nav.classList.toggle('solid', window.scrollY > 60), { passive: true })

    const trails = (cv) => {
      const ctx = cv.getContext('2d')
      const parts = []
      let W
      let H
      let running = false
      const resize = () => {
        W = cv.width = Math.min(1100, cv.clientWidth)
        H = cv.height = Math.round((W * cv.clientHeight) / cv.clientWidth) || 600
      }
      resize()
      on(window, 'resize', resize)
      for (let i = 0; i < 46; i += 1) {
        parts.push({
          x: Math.random(),
          l: Math.random(),
          s: 0.002 + Math.random() * 0.006,
          r: Math.random() < 0.5,
          w: 0.5 + Math.random() * 1.6,
        })
      }
      const draw = () => {
        if (!running) return
        ctx.fillStyle = 'rgba(14,18,20,.2)'
        ctx.fillRect(0, 0, W, H)
        const hy = H * 0.46
        ctx.strokeStyle = 'rgba(243,239,230,.06)'
        for (let i = -6; i <= 6; i += 1) {
          ctx.beginPath()
          ctx.moveTo(W / 2 + i * 8, hy)
          ctx.lineTo(W / 2 + i * W * 0.16, H)
          ctx.stroke()
        }
        parts.forEach((p) => {
          p.x += p.s * (p.r ? -1 : 1)
          if (p.x > 1.1) p.x = -0.1
          if (p.x < -0.1) p.x = 1.1
          const z = p.l
          const y = hy + z * z * (H - hy) * 0.95 + 4
          const len = 30 + z * 140
          const px = p.x * W
          const c = p.r ? '228,87,46' : '243,239,230'
          const g = ctx.createLinearGradient(px - len * (p.r ? -1 : 1), 0, px, 0)
          g.addColorStop(0, `rgba(${c},0)`)
          g.addColorStop(1, `rgba(${c},${0.35 + z * 0.6})`)
          ctx.strokeStyle = g
          ctx.lineWidth = p.w * (0.6 + z * 2.4)
          ctx.beginPath()
          ctx.moveTo(px - len * (p.r ? -1 : 1), y)
          ctx.lineTo(px, y)
          ctx.stroke()
        })
        requestAnimationFrame(draw)
      }
      const io = new IntersectionObserver((entries) => {
        const visible = entries[0].isIntersecting
        if (visible && !running) {
          running = true
          draw()
        } else if (!visible) {
          running = false
        }
      })
      io.observe(cv)
      cleanups.push(() => io.disconnect())
    }
    root$.querySelectorAll('.cv').forEach(trails)

    const footage = root$.querySelector('#footage')
    if (footage) {
      const counters = footage.querySelectorAll('b')
      let done = 0
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !done) {
            done = 1
            counters.forEach((b) => {
              const target = +b.dataset.n
              const start = performance.now()
              const step = (t) => {
                const k = Math.min(1, (t - start) / 1800)
                b.textContent = Math.round(target * (1 - (1 - k) ** 3))
                if (k < 1) requestAnimationFrame(step)
              }
              step(start)
            })
          }
        },
        { threshold: 0.5 },
      )
      io.observe(footage)
      cleanups.push(() => io.disconnect())

      const cv = footage.querySelector('.cv')
      if (cv) {
        on(
          window,
          'scroll',
          () => {
            const r = footage.getBoundingClientRect()
            const p = Math.max(0, Math.min(1, -r.top / (r.height - window.innerHeight)))
            cv.style.transform = `scale(${1 + p * 0.18})`
          },
          { passive: true },
        )
      }
    }

    /* ---------- 5. progress bar, bars, marquees, lights ---------- */
    const sp = document.createElement('div')
    sp.className = 'sp'
    root$.parentNode?.insertBefore(sp, root$)
    cleanups.push(() => sp.remove())

    const bars = root$.querySelectorAll('.bar')
    bars.forEach((b, i) => b.style.setProperty('--d', `${i * 0.12}s`))

    const dash = root$.querySelector('#dash')
    if (dash) {
      const io = new IntersectionObserver((entries, obs) => {
        if (!entries[0].isIntersecting) return
        obs.disconnect()
        const clamp = (v) => Math.max(0, Math.min(1, v))
        bars.forEach((b, i) => {
          const valueEl = b.lastElementChild
          const v = +valueEl.textContent
          const t0 = performance.now() + i * 120 + 300
          const step = (t) => {
            const k = clamp((t - t0) / 1500)
            valueEl.textContent = Math.round(v * (1 - (1 - k) ** 3))
            if (k < 1) requestAnimationFrame(step)
          }
          step(t0)
        })
      }, { threshold: 0.4 })
      io.observe(dash)
      cleanups.push(() => io.disconnect())
    }

    const onScrollProgress = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      sp.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`
    }
    on(window, 'scroll', onScrollProgress, { passive: true })
    on(window, 'resize', onScrollProgress)
    onScrollProgress()

    const tapes = root$.querySelectorAll('.tape .tt')
    tapes.forEach((t) => {
      t.innerHTML = Array(16)
        .fill(`<span>${t.dataset.t || ''}</span>`)
        .join('')
    })
    try {
      const to = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              to.unobserve(e.target)
            }
          }),
        { threshold: 0.3 },
      )
      root$.querySelectorAll('.tapes').forEach((x) => to.observe(x))
      cleanups.push(() => to.disconnect())
    } catch {
      root$.querySelectorAll('.tapes').forEach((x) => x.classList.add('in'))
    }

    const marquees = [...root$.querySelectorAll('.mq-t')]
    const t0 = performance.now()
    let raf
    marquees.forEach((m) => {
      /* Repeat the word group four times so the strip is wider than the
         viewport; the loop then translates by exactly one group, which
         makes the motion seamless instead of leaving a gap. */
      if (m.dataset.wide !== '1') {
        m.innerHTML = m.innerHTML.repeat(4)
        m.dataset.wide = '1'
      }
      m.style.animation = 'none'
    })
    const loop = (t) => {
      marquees.forEach((m, i) => {
        const w = m.scrollWidth / 4
        const d = (((t - t0) / 1000) * (w / 26)) % w
        m.style.transform = `translateX(${i ? d - w : -d}px)`
      })
      raf = requestAnimationFrame(loop)
    }
    if (marquees.length) raf = requestAnimationFrame(loop)
    cleanups.push(() => raf && cancelAnimationFrame(raf))

    const lights = [...root$.querySelectorAll('.tl i')]
    const colors = ['#3ccf7a', '#f5c518', '#ff4a3d']
    let k = 0
    const tick = () => {
      lights.forEach((l, i) => {
        const active = i === k
        l.style.animation = 'none'
        l.style.background = active ? colors[i] : '#2a3236'
        l.style.boxShadow = active ? `0 0 22px 4px ${colors[i]}` : 'none'
      })
      k = (k + 1) % 3
    }
    let lightTimer
    if (lights.length) {
      tick()
      lightTimer = setInterval(tick, 2000)
    }
    cleanups.push(() => lightTimer && clearInterval(lightTimer))

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return (
    <div ref={root}>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML_BEFORE }} />
      <LandingMap />
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML_AFTER }} />
    </div>
  )
}

/* The static landing markup, taken verbatim from index.php. Split around the
   live-map section so <LandingMap/> can render that part as React. */
const PLACEHOLDER = '<!-- livemap rendered by <LandingMap/> -->'
const [LANDING_HTML_BEFORE, LANDING_HTML_AFTER] = LANDING_HTML.split(PLACEHOLDER)
