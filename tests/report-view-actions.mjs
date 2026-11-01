/** Offline regression: all external traffic is blocked and fixture writes throw. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.APP_BASE || 'http://127.0.0.1:5184'
const origin = new URL(base).origin
const output = path.resolve('output/report-view-actions')
fs.mkdirSync(output, { recursive: true })
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
let firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
firestoreMock = firestoreMock.replace("if (q.name !== 'reports') {", `if (q.name === 'notifications') return {docs: [], size: 0};
  if (q.name !== 'reports') {`)
// Apply real cursor pagination so the Back test distinguishes pages by report ID.
firestoreMock = firestoreMock.replace("if (p.kind === 'limit')", "if (p.kind === 'cursor') { const i = rows.findIndex(r => r.id === p.value.id); rows = rows.slice(i + 1); }\n    if (p.kind === 'limit')")
firestoreMock = firestoreMock.replace('export const getDoc = async () => ({ exists: () => false });', `export const getDoc = async (ref) => ({ id: ref.id, exists: () => ref.name === 'reports', data: () => window.__fixtures.find(r => r.id === ref.id) });`)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.resolve('tmp/report-view-actions/browser-profile'), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] })
const results = { layouts: [], interactions: [], runtimeErrors: [] }
try {
  const page = await browser.newPage()
  page.on('pageerror', error => results.runtimeErrors.push(error.message))
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__fixtures = Array.from({ length: 60 }, (_, i) => ({
      id: `fixture-${i}`, report_code: `RA-2026-${String(i + 1).padStart(6, '0')}`,
      accident_date: '2026-11-01', accident_time: '10:30', municipality: 'Malolos', barangay: 'Centro',
      location_text: 'Provincial road near the public market', accident_type_name: 'Single vehicle',
      accident_type_id: 'collision', injury_status: 'none', vehicles: [], status: i === 0 ? 'info_required' : 'submitted',
      officer_name: 'Test Officer With A Long Name', flagged: i % 3 === 0,
      status_history: [], description: 'Offline fixture',
    }))
    window.__mode = 'normal'; window.__queryDelay = 40; window.__queryLog = []
    window.__navigations = []
    const push = history.pushState.bind(history)
    history.pushState = (...args) => { window.__navigations.push(args[2]); return push(...args) }
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = new URL(req.url())
    if (['data:', 'blob:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.respond({ status: 200, body: '' })
    const respond = body => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider=({children})=>children;
      export const useAuth=()=>({user:{uid:'offline-admin'},profile:{role:'admin',status:'active',full_name:'Offline Admin'},loading:false,signOut:async()=>{}});
      export const useActor=()=>({uid:'offline-admin',role:'admin'});
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth={},db={},apiKey='offline-fixture',isFirebaseConfigured=true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  const ready = () => page.waitForFunction(() => !document.querySelector('.page-loading') && document.querySelector('tr.clickable'))
  const go = async (route, width = 1440) => {
    await page.setViewport({ width, height: 1000 }); await page.goto(base + route); await ready()
    await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)) })
  }
  const returnOnce = async (route, expectedHref) => {
    await page.waitForFunction(href => location.pathname === href, {}, expectedHref)
    await page.waitForFunction(() => !document.querySelector('.page-loading'))
    assert.equal(await page.evaluate(() => window.__navigations.length), 1, 'One history entry per navigation')
    await page.goBack(); await ready()
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)) })
    assert.equal(new URL(page.url()).pathname, route)
  }
  for (const route of ['/admin/reports', '/admin']) {
    const prefix = route === '/admin/reports' ? 'rr-reports' : 'rr-dashboard'
    const table = route === '/admin/reports' ? '.rr-reports-table' : '.rr-dashboard-recent .table-responsive'
    const view = `.${prefix}-view`
    for (const width of [1440, 820, 390]) {
      await go(route, width)
      const sizes = await page.$eval(table, el => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, table: el.clientWidth, scroll: el.scrollWidth }))
      assert.ok(sizes.document <= width + 1 && sizes.scroll <= sizes.table + 1, JSON.stringify({route, ...sizes}))
      const layout = await page.$eval(view, el => {
        const box = el.getBoundingClientRect(), row = el.closest('tr'), cell = el.closest('td')
        return { height: box.height, width: box.width, cellWidth: cell.clientWidth, text: el.innerText, label: el.ariaLabel,
          rowTabindex: row.getAttribute('tabindex'), rowRole: row.getAttribute('role'), links: row.querySelectorAll('a').length,
          cells: [...row.cells].map(c => ({left:c.getBoundingClientRect().left,right:c.getBoundingClientRect().right,top:c.getBoundingClientRect().top,bottom:c.getBoundingClientRect().bottom})) }
      })
      assert.equal(layout.links, 2); assert.equal(layout.rowTabindex, null); assert.equal(layout.rowRole, 'row')
      assert.ok(layout.label.startsWith('View report RA-2026-'))
      assert.ok(layout.height >= (width < 768 ? 43.99 : 33.99), JSON.stringify({route,width,layout}))
      assert.equal(layout.text.replace(/\s+/g, ' '), width < 768 ? 'View report' : 'View')
      if (width < 768) {
        assert.ok(Math.abs(layout.width - layout.cellWidth) < 1)
        const action = layout.cells.at(-1)
        assert.ok(layout.cells.slice(0,-1).every(c => c.bottom <= action.top + 1), 'Action on its own bottom line')
      }
      const overlap = await page.$eval('tr.clickable',row=>{const a=row.querySelector('.code-cell a').getBoundingClientRect(),b=row.querySelector('.status-badge').getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom})
      assert.equal(overlap,false,'Long status must not overlap the ID')
      results.layouts.push({route, width, sizes, height:layout.height})
      await page.screenshot({ path: path.join(output, `${prefix}-${width}.png`), fullPage: true })
      await (await page.$('tr.clickable')).screenshot({path:path.join(output,`${prefix}-row-${width}.png`)})
      console.log(`PASS: ${route} ${width}px, no table or page overflow`)
    }
    await go(route)
    const href = await page.$eval('tr.clickable .code-cell a', a => a.getAttribute('href'))
    // ID and View stay native links; the row ignores their bubbled events.
    for (const selector of ['tr.clickable .code-cell a', view, 'tr.clickable .status-badge']) {
      await page.evaluate(() => { window.__navigations = [] })
      await page.click(selector)
      await returnOnce(route, href)
    }
    // Click actual row padding, away from both links and all cell text.
    await page.evaluate(() => { window.__navigations = [] })
    await page.$eval('tr.clickable', el => el.scrollIntoView({block:'center',behavior:'instant'}))
    const space = await page.$eval('tr.clickable td:nth-child(3)', el => {const b=el.getBoundingClientRect();return{x:b.right-4,y:b.bottom-4}})
    await page.mouse.click(space.x, space.y); await returnOnce(route, href)
    // Real mouse drag creates a selection and must leave this list in place.
    await page.$eval('tr.clickable', el => el.scrollIntoView({block:'center',behavior:'instant'}))
    const text = await page.$eval('tr.clickable td:nth-child(3)', el => {const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return{x:b.x+2,y:b.y+b.height/2,end:b.right-2}})
    await page.mouse.move(text.x, text.y); await page.mouse.down(); await page.mouse.move(text.end,text.y,{steps:15}); await page.mouse.up()
    assert.ok(await page.evaluate(() => getSelection().toString().length > 0))
    assert.equal(new URL(page.url()).pathname, route)
    await page.evaluate(() => getSelection().removeAllRanges())
    // Interactive descendants (including possible future controls) must not trigger row navigation.
    await page.$eval('tr.clickable td:nth-child(3)', el => {el.insertAdjacentHTML('beforeend','<button id="fixture-button">Control</button><input id="fixture-checkbox" type="checkbox"><input id="fixture-input">')})
    for (const selector of ['#fixture-button','#fixture-checkbox','#fixture-input']) {
      await page.click(selector); assert.equal(new URL(page.url()).pathname,route)
    }
    await page.evaluate(() => document.querySelectorAll('[id^="fixture-"]').forEach(el=>el.remove()))
    // Check actual native Ctrl-click/middle-click popups plus every row modifier.
    for (const selector of ['tr.clickable td:nth-child(3)', view, 'tr.clickable .code-cell a']) {
      for (const modifier of [process.platform === 'darwin' ? 'Meta' : 'Control', 'Middle']) {
        console.log(`Check new tab: ${route} ${selector} ${modifier}`)
        const existingTargets = new Set(browser.targets())
        const targetPromise = browser.waitForTarget(target => target.type() === 'page' && !existingTargets.has(target), { timeout: 5000 })
        if (modifier !== 'Middle') await page.keyboard.down(modifier)
        await page.click(selector, modifier === 'Middle' ? {button:'middle'} : {})
        if (modifier !== 'Middle') await page.keyboard.up(modifier)
        const target = await targetPromise
        const popup = await target.page()
        await popup.waitForFunction(href => location.pathname === href || new URLSearchParams(location.search).get('next') === href, {}, href)
        await popup.close()
        assert.equal(new URL(page.url()).pathname, route)
      }
    }
    // Also exercise every row modifier, independent of the host OS's mouse conventions.
    const modifiers = await page.$eval('tr.clickable td:nth-child(3)', el => {
      const calls=[], open=window.open; window.open=(...args)=>calls.push(args)
      for(const key of ['metaKey','ctrlKey','shiftKey','altKey']) el.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0,[key]:true}))
      el.dispatchEvent(new MouseEvent('auxclick',{bubbles:true,button:2}))
      window.open=open; return calls
    })
    assert.equal(modifiers.length,4); assert.ok(modifiers.every(call=>call[0]===href&&call[1]==='_blank'))
    // ID then View are the only link tab stops in each data row; Enter uses the real route.
    await go(route)
    await page.focus('tr.clickable .code-cell a')
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth),'2px')
    await page.keyboard.press('Tab')
    assert.ok(await page.evaluate(selector=>document.activeElement.matches(selector),view))
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor),'rgb(245, 197, 24)')
    assert.notEqual(await page.$eval('tr.clickable td',el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)')
    await page.evaluate(() => {window.__navigations=[]})
    await page.keyboard.press('Enter'); await returnOnce(route, href)
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
    assert.equal(await page.$eval(view,el=>getComputedStyle(el).transitionDuration),'0s')
    await page.emulateMediaFeatures([])
    // Touch devices have 44px actions even at tablet widths.
    await page.setViewport({width:820,height:1000,hasTouch:true}); await ready()
    assert.ok(await page.$eval(view,el=>el.getBoundingClientRect().height>=44))
    await page.setViewport({width:1440,height:1000,hasTouch:false}); await ready()
    await page.emulateMediaType('print')
    assert.ok(await page.$$eval(`.${prefix}-action-cell`,els=>els.every(el=>getComputedStyle(el).display==='none')))
    await page.pdf({path:path.join(output,`${prefix}-print.pdf`),format:'A4',landscape:true,printBackground:true})
    await page.emulateMediaType('screen')
    results.interactions.push(`${route}: native links, row/status clicks, selection, modifiers, middle-click, keyboard, print, touch, reduced motion`)
  }
  // The list's filters AND cursor page must survive one Back, from either link or row.
  await go('/admin/reports?municipality=Malolos')
  await page.select('select[aria-label="Status"]','submitted'); await ready()
  await page.click('.rr-reports-pager .btn:last-child'); await ready()
  const pageTwo = await page.$eval('tr.clickable .code-cell a',a=>({href:a.getAttribute('href'),text:a.textContent}))
  assert.equal(pageTwo.text,'RA-2026-000027')
  for(const selector of ['tr.clickable .code-cell a','.rr-reports-view','tr.clickable .status-badge']){
    await page.evaluate(()=>{window.__navigations=[]}); await page.click(selector)
    await returnOnce('/admin/reports',pageTwo.href)
    assert.equal(await page.$eval('select[aria-label="Status"]',el=>el.value),'submitted')
    assert.equal(await page.$eval('input[name="municipality"]',el=>el.value),'Malolos')
    assert.equal(await page.$eval('tr.clickable .code-cell a',el=>el.textContent),pageTwo.text)
  }
  const csv = await page.evaluate(async()=>{const {toCsv}=await import('/src/utils/csv.js');return toCsv(window.__fixtures)})
  assert.ok(!csv.includes('"Action"')&&!csv.includes('"View"'))
  assert.ok(csv.startsWith('\uFEFF"Report ID","Date","Time","Location","Type","Injury","Officer","Reporter","Status"'))
  // Stale rows must not be clickable while fetching a new filter result.
  await page.evaluate(()=>{window.__queryDelay=1500})
  await page.select('select[aria-label="Status"]','verified')
  await page.waitForSelector('.page-loading')
  assert.equal(await page.$$eval('tr.clickable',els=>els.length),0)
  await page.waitForSelector('.rr-reports-state-row .rr-state-empty')
  assert.equal(await page.$$eval('tr.clickable',els=>els.length),0)
  results.interactions.push('Reports: page 2 and filters preserved on Back; CSV unchanged; loading/empty rows inert')
  assert.deepEqual(results.runtimeErrors,[])
  console.log(JSON.stringify(results,null,2))
} finally {
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(results,null,2))
  await browser.close()
}
