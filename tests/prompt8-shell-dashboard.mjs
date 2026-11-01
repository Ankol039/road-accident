/** Offline UI verification. Run Vite, then APP_BASE=http://127.0.0.1:5178 node tests/prompt8-shell-dashboard.mjs.
 * Auth/Firestore are browser fixtures. Writes throw; no Firebase requests leave this browser.
 * Screenshot comparisons: app left, finished mockup right, at the same viewport widths.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

const base = process.env.APP_BASE || 'http://127.0.0.1:5178'
const origin = new URL(base).origin
const output = path.resolve('output/prompt8')
fs.mkdirSync(output, { recursive: true })
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
let firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
firestoreMock = firestoreMock.replace("if (q.name !== 'reports') {", `if (q.name === 'users' || q.name === 'notifications') {
  const rows = q.name === 'users' ? [window.__profile] : Array.from({length:3}, (_, i) => ({id:'n'+i,user_id:'offline-admin',read:false,title:'Report update',message:'Offline fixture'}));
  const docs=rows.map(r=>({id:r.id,data:()=>r}));return {docs,size:docs.length};
}
if (q.name !== 'reports') {`)
firestoreMock = firestoreMock.replace('export const fetchDoc = async () => null;', `export const fetchDoc = async (name) => name === 'users' ? window.__profile : null;`)
firestoreMock = firestoreMock.replace('export const getDoc = async () => ({ exists: () => false });', `export const getDoc = async (ref) => ({ exists: () => ref.name === 'reports', data: () => window.__fixtures[0] });`)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.resolve('tmp/prompt8/browser-profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const failures = [], notes = [], runtimeErrors = [], consoleErrors = []
try {
  const page = await browser.newPage()
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__profile = { id:'offline-admin', full_name:'Portal Administrator', email:'fixture@example.invalid', role:'admin', status:'active' }
    window.__fixtures = Array.from({length: 22}, (_, i) => ({
      id:'fixture-'+i, report_code:'RA-2026-'+String(i+1).padStart(6,'0'),
      accident_date: new Date().toISOString().slice(0,10), accident_time:'10:30',
      municipality:['Malolos','Baliwag','Meycauayan','Marilao','Bulakan','Bocaue'][i%6], barangay:'Centro',
      location_text:'Provincial road near the public market', accident_type_name:i%2 ? 'Collision' : 'Single vehicle',
      accident_type_id:'collision', injury_status:'none', vehicles:[], status:i<6 ? 'submitted' : i<12 ? 'verified' : i<18 ? 'resolved' : 'assigned',
      flagged:i<5, latitude:14.85+(i%6)*.02, longitude:120.81+(i%6)*.02,
      status_history:[], description:'Offline fixture for visual verification',
    }))
    window.__queryLog=[]; window.__mode='normal'; window.__queryDelay=50
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    // Read-only public visual assets are allowed; all other external requests are blocked.
    if (url.origin !== origin) {
      if (['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname) || url.hostname.endsWith('.tile.openstreetmap.org')) return req.continue()
      return req.abort()
    }
    const respond = body => req.respond({status:200,contentType:'application/javascript',body})
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider=({children})=>children;
      export const useAuth=()=>({user:window.__guest?null:{uid:'offline-admin',email:'fixture@example.invalid'},profile:window.__profile,loading:false,signOut:async()=>{window.__guest=true}});
      export const useActor=()=>({uid:'offline-admin',role:'admin'});
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth={}, db={}, apiKey='offline-fixture', isFirebaseConfigured=true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  page.on('pageerror', e => runtimeErrors.push(e.message))
  page.on('console', msg => { if(msg.type()==='error') consoleErrors.push(msg.text()) })
  const go = async (route='/admin', width=1440) => {
    await page.setViewport({width,height:1000})
    await page.goto(base+route)
    await page.waitForFunction(() => !document.querySelector('.page-loading'))
    await page.evaluate(() => document.fonts.ready)
  }
  const overflow = async label => {
    const sizes=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
    if(sizes.html>sizes.width+1 || sizes.body>sizes.width+1) failures.push({label,...sizes})
  }
  const visible = selector => page.$eval(selector, el=>el.getClientRects().length>0)
  let reloadDay = 1
  const applyAgain = async () => {
    await page.$eval('#range-form input', (input, day) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2020-01-'+String(day).padStart(2,'0'))
      input.dispatchEvent(new Event('input', {bubbles:true}))
      input.dispatchEvent(new Event('change', {bubbles:true}))
    }, reloadDay++)
    await page.evaluate(()=>document.querySelector('#range-form').requestSubmit())
  }
  const compare = async (width, open=false) => {
    const name=`${width}${open?'-open':''}`
    const appFile=path.join(output,`dashboard-${name}.png`)
    await page.screenshot({path:appFile,fullPage:true})
    const mock=await browser.newPage()
    await mock.setViewport({width,height:1000})
    await mock.goto(base+'/html-mockups/_screens/dashboard/index.html')
    await mock.evaluate(()=>document.fonts.ready)
    if(open) await mock.click('.rr-dashboard-burger')
    await mock.screenshot({path:path.join(output,`mockup-${name}.png`),fullPage:true})
    const a=PNG.sync.read(fs.readFileSync(appFile)), b=PNG.sync.read(fs.readFileSync(path.join(output,`mockup-${name}.png`)))
    const joined=new PNG({width:width*2,height:Math.max(a.height,b.height),fill:true})
    joined.data.fill(14)
    PNG.bitblt(a,joined,0,0,a.width,a.height,0,0)
    PNG.bitblt(b,joined,0,0,b.width,b.height,width,0)
    fs.writeFileSync(path.join(output,`comparison-${name}.png`),PNG.sync.write(joined))
    await mock.close()
  }
  for (const width of [320,360,390,414,768,1024,1440]) {
    await go('/admin',width)
    await page.waitForSelector('#cards .stat-card')
    await overflow(`Dashboard ${width}`)
    assert.equal(await page.$$eval('.side-nav .rr-ico',els=>els.filter(el=>el.getAttribute('aria-hidden')==='true'&&el.getAttribute('focusable')==='false').length),8)
    assert.equal(await page.$eval('.count-pill',el=>el.textContent),'3')
    const levels=await page.$$eval('#cards .stat-card',cards=>cards.map(c=>({n:Number(c.querySelector('.stat-value').textContent),level:c.dataset.level,text:c.querySelector('.rr-dashboard-level-text').textContent})))
    for(const {n,level,text} of levels){const expected=n>0?(n<=5?'low':n<=10?'moderate':'high'):'none'; assert.equal(level,expected);assert.equal(text,expected[0].toUpperCase()+expected.slice(1))}
    const cols=await page.$eval('#cards',el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)
    assert.equal(cols,width<576?2:3)
    assert.equal(await page.$eval('.rr-dashboard-charts',el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width<992?1:2)
    assert.equal(await page.$eval('.rr-dashboard-recent tr.clickable',el=>getComputedStyle(el).display),width<768?'grid':'table-row')
    if([1440,390].includes(width)) await compare(width)
    if(width<992){
      assert.equal(await visible('#site-nav'),false)
      await page.click('.rr-burger')
      assert.equal(await page.$eval('.sidebar',el=>el.classList.contains('rr-menu-open')),true)
      assert.equal(await visible('#site-nav'),true)
      await overflow(`Dashboard menu open ${width}`)
      if(width===390) await compare(width,true)
      await page.keyboard.press('Escape')
      assert.equal(await page.$eval('.rr-burger',el=>el.getAttribute('aria-expanded')),'false')
      assert.equal(await page.evaluate(()=>document.activeElement.matches('.rr-burger')),true)
    }
    console.log(`PASS: Dashboard ${width}px, grids, lamps, menu and overflow check`)
  }
  await go()
  // Check all level boundaries using the real stats service and unchanged Apply handler.
  for(const n of [0,1,5,6,10,11]){
    await page.evaluate(n=>{window.__fixtures=window.__fixtures.slice(0,n)},22)
    await page.evaluate(n=>{
      const first=window.__fixtures[0]||{accident_date:new Date().toISOString().slice(0,10),status:'verified',injury_status:'none'}
      window.__fixtures=Array.from({length:n},(_,i)=>({...first,id:'boundary-'+i}))
    },n)
    await applyAgain()
    await page.waitForFunction(n=>Number(document.querySelectorAll('#cards .stat-value')[3]?.textContent)===n,{},n)
  }
  await page.evaluate(()=>{window.__queryDelay=1200})
  await applyAgain()
  await page.waitForSelector('.rr-state[role="status"]')
  await page.screenshot({path:path.join(output,'loading-1440.png')})
  await page.waitForSelector('#cards')
  await page.evaluate(()=>{window.__queryDelay=0;window.__loadError=true})
  await applyAgain()
  await page.waitForSelector('.rr-state-error[role="alert"]')
  await page.screenshot({path:path.join(output,'error-1440.png')})
  await page.evaluate(()=>{window.__loadError=false;window.__mode='empty'})
  await applyAgain()
  await page.waitForSelector('.rr-state-empty')
  await page.setViewport({width:320,height:1000})
  await overflow('Empty Dashboard 320')
  await page.screenshot({path:path.join(output,'empty-320.png'),fullPage:true})
  await go('/admin',390)
  await page.focus('#range-form input')
  assert.equal(await page.$eval('#range-form input',el=>getComputedStyle(el).outlineStyle),'solid')
  const contrast = await page.evaluate(() => {
    const rgb = c => (c.match(/[\d.]+/g)||[]).slice(0,3).map(Number)
    const luminance = c => rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
    const ratio = (a,b) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    const checks = [
      ['cream text','rgb(236,232,223)','rgb(27,34,38)',4.5],
      ['muted text','rgb(141,151,155)','rgb(27,34,38)',4.5],
      ['orange eyebrow','rgb(228,87,46)','rgb(18,24,27)',4.5],
      ['report links incl hover surface','rgb(240,106,65)','rgb(40,31,29)',4.5],
      ['input boundary','rgb(102,113,118)','rgb(27,34,38)',3],
      ['focus outline','rgb(245,197,24)','rgb(27,34,38)',3],
    ]
    const button=getComputedStyle(document.querySelector('#range-form .btn-guide'))
    checks.push(['Apply',button.color,button.backgroundColor,4.5])
    return checks.map(([label,fg,bg,min])=>({label,ratio:ratio(fg,bg),min}))
  })
  for(const c of contrast) assert.ok(c.ratio>=c.min,JSON.stringify(c))
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
  assert.equal(await page.$eval('.stat-card',el=>getComputedStyle(el).transitionDuration),'0s')
  const chartSettings=await page.evaluate(async()=>{
    const {Chart}=await import('/node_modules/.vite/deps/chart__js.js')
    return [...Object.values(Chart.instances)].map(c=>({animation:c.options.animation,ticks:c.options.scales?.x?.ticks?.color,colors:c.data.datasets.map(d=>d.backgroundColor)}))
  })
  assert.equal(chartSettings.length,6)
  for(const c of chartSettings) assert.equal(c.animation,false)
  await page.emulateMediaFeatures([])
  await page.click('#range-form .btn-link')
  assert.equal(await page.$eval('#range-form input',el=>el.value),'')
  await page.waitForSelector('#cards')
  if(await visible('.rr-burger')) await page.click('.rr-burger')
  await page.click('#site-nav a[href="/admin/reports"]')
  assert.equal(await page.$eval('.rr-burger',el=>el.getAttribute('aria-expanded')),'false')
  for(const route of ['/','/login','/admin/reports','/admin/reports/fixture-0','/admin/summaries','/admin/users','/admin/settings','/admin/audit','/admin/notifications','/admin/account']) {
    for(const width of [320,360,390,414,768,1024,1440]) {
      await go(route,width)
      await overflow(`${route} ${width}`)
      if(route.startsWith('/admin')) assert.equal(await page.$$eval('#site-nav a',els=>els.length),8)
    }
    console.log('PASS: route loaded '+route+' at seven widths')
  }
  // The login route redirects an authenticated fixture, so also load it as a guest.
  await page.evaluate(()=>{window.__guest=true;history.pushState({},'','/login');dispatchEvent(new PopStateEvent('popstate'))})
  await page.waitForSelector('input[type="password"]')
  assert.deepEqual(runtimeErrors,[])
  const result={failures,notes,runtimeErrors,consoleErrors,chartSettings,contrast}
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(result,null,2))
  assert.deepEqual(failures,[],'Page-level overflow')
  assert.deepEqual(consoleErrors,[],'Console errors')
  console.log('PASS: routes, states, thresholds, filter handlers, reduced motion, focus and console checks; artifacts in '+output)
} finally { await browser.close() }
