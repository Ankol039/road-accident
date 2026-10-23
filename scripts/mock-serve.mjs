/**
 * Serves the html-mockups/ folder on http://127.0.0.1:8080.
 *
 * A plain static server keeps the mockups dependency-free: the design AI only
 * needs the folder, not Node or the app. Used by `npm run mock:serve`.
 *
 *   node scripts/mock-serve.mjs
 *   node scripts/mock-serve.mjs --port 9000 --host 0.0.0.0
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1] ?? fallback
}

const ROOT = resolve(process.cwd(), 'html-mockups')
const HOST = arg('host', '127.0.0.1')
const PORT = Number(arg('port', 8080))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

if (!existsSync(ROOT)) {
  console.error(`No html-mockups folder at ${ROOT}. Run \`npm run mock:export\` first.`)
  process.exit(1)
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || HOST}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname.endsWith('/')) pathname += 'index.html'

  const file = resolve(ROOT, '.' + pathname)
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
})

server.listen(PORT, HOST, () => {
  console.log(`RoadReport mockups: http://${HOST}:${PORT}/`)
  console.log(`Design system:      http://${HOST}:${PORT}/_system/index.html`)
})
