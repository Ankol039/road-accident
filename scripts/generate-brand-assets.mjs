/** Generate only icon/share derivatives; copy supplied brand PNGs byte-for-byte.
 * Uses the project's existing puppeteer-core and pngjs. No network requests.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

export async function generateBrandAssets() {
  const source = path.resolve('logo-source')
  const target = path.resolve('public/brand')
  fs.mkdirSync(target, { recursive: true })
  for (const variant of ['horizontal', 'stacked', 'mark']) {
    for (const theme of ['dark', 'light']) {
      const name = `logo-${variant}-on-${theme}.png`
      fs.copyFileSync(path.join(source, name), path.join(target, name))
    }
  }
  const mark = fs.readFileSync(path.join(source, 'logo-mark-on-dark.png')).toString('base64')
  const stacked = fs.readFileSync(path.join(source, 'logo-stacked-on-dark.png')).toString('base64')
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    userDataDir: path.resolve('tmp/brand-logo/asset-generator'), args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', req => req.url().startsWith('data:') ? req.continue() : req.abort())
    const images = await page.evaluate(async ({ mark, stacked }) => {
      const load = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode(); return img }
      const icon = await load(mark), stack = await load(stacked)
      const result = {}
      const canvas = (width, height) => {
        const cv = document.createElement('canvas'); cv.width = width; cv.height = height
        const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
        return { cv, ctx }
      }
      for (const size of [16, 32, 48, 180, 192, 512]) {
        const { cv, ctx } = canvas(size, size)
        const app = size >= 180
        if (app) { ctx.fillStyle = '#0e1214'; ctx.fillRect(0, 0, size, size) }
        // Never enlarge the supplied mark, including on the larger app canvases.
        const scale = Math.min(1, size * (app ? .7 : 1) / Math.max(icon.width, icon.height))
        const w = icon.width * scale, h = icon.height * scale
        ctx.drawImage(icon, (size - w) / 2, (size - h) / 2, w, h)
        const name = size <= 48 ? `favicon-${size}.png` : size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
        result[name] = cv.toDataURL('image/png').split(',')[1]
      }
      {
        const { cv, ctx } = canvas(512, 512)
        ctx.fillStyle = '#0e1214'; ctx.fillRect(0, 0, 512, 512)
        const scale = Math.min(1, 512 * .6 / Math.max(icon.width, icon.height))
        const w = icon.width * scale, h = icon.height * scale
        ctx.drawImage(icon, (512 - w) / 2, (512 - h) / 2, w, h)
        result['icon-maskable-512.png'] = cv.toDataURL('image/png').split(',')[1]
      }
      {
        const { cv, ctx } = canvas(1200, 630)
        ctx.fillStyle = '#0e1214'; ctx.fillRect(0, 0, 1200, 630)
        const glow = ctx.createRadialGradient(600, 315, 0, 600, 315, 310)
        glow.addColorStop(0, 'rgba(228,87,46,0.18)'); glow.addColorStop(1, 'rgba(228,87,46,0)')
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 1200, 630)
        ctx.drawImage(stack, (1200 - stack.width) / 2, (630 - stack.height) / 2)
        result['og-image.png'] = cv.toDataURL('image/png').split(',')[1]
      }
      return result
    }, { mark, stacked })
    const sizes = [16, 32, 48]
    // ICO embeds the three PNG sizes without altering the transparent images.
    const header = Buffer.alloc(6 + sizes.length * 16)
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
    let offset = header.length
    const payloads = sizes.map((size, index) => {
      const png = Buffer.from(images[`favicon-${size}.png`], 'base64')
      const entry = 6 + index * 16
      header[entry] = size; header[entry + 1] = size
      header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6)
      header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12)
      offset += png.length
      return png
    })
    fs.writeFileSync('public/favicon.ico', Buffer.concat([header, ...payloads]))
    for (const [name, data] of Object.entries(images)) {
      if (name === 'favicon-48.png') continue // 48px is required only inside the ICO.
      const png = Buffer.from(data, 'base64')
      const info = PNG.sync.read(png)
      fs.writeFileSync(path.join('public', name), png)
      console.log(`${name}: ${info.width}×${info.height}`)
    }
  } finally { await browser.close() }
}

if (process.argv[1] === new URL(import.meta.url).pathname) await generateBrandAssets()
