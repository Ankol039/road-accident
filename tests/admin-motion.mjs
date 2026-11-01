/** Run Vite, then APP_BASE=http://127.0.0.1:5193 node tests/admin-motion.mjs.
 * Auth/Firestore are read-only fixtures; all external requests are blocked.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.APP_BASE || 'http://127.0.0.1:5193'
const origin = new URL(base).origin
const output = path.resolve('output/admin-motion')
fs.mkdirSync(output, { recursive: true })
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome, 'Chrome is required')
let mock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
mock = mock.replace('export async function getDocs(q)', 'async function unusedGetDocs(q)')
mock = mock.replace('export const fetchCollection = async () => [{ id: \'collision\', name: \'Collision\' }];', 'export const fetchCollection = async (name) => window.__db[name] || [];')
mock = mock.replace('export const fetchDoc = async () => null;', 'export const fetchDoc = async (name, id) => window.__db[name]?.find(r => r.id === id) || null;')
mock = mock.replace('export const getDoc = async () => ({ exists: () => false });', `export const getDoc = async (ref) => {
  const row = window.__db[ref.name]?.find(r => r.id === ref.id);
  return {id:ref.id, exists:()=>Boolean(row), data:()=>row};
};`)
mock += `
export async function getDocs(q) {
  await new Promise(resolve => setTimeout(resolve, window.__queryDelay));
  let rows = [...(window.__db[q.name] || [])];
  for (const p of q.parts || []) {
    if (p.kind === 'where') rows = rows.filter(r => p.op === '>=' ? r[p.field] >= p.value : p.op === '<=' ? r[p.field] <= p.value : p.op === 'in' ? p.value.includes(r[p.field]) : r[p.field] === p.value);
    if (p.kind === 'order') rows.sort((a,b) => String(a[p.field]).localeCompare(String(b[p.field])) * (p.direction === 'desc' ? -1 : 1));
    if (p.kind === 'cursor') rows = rows.slice(rows.findIndex(r => r.id === p.value.id) + 1);
    if (p.kind === 'limit') rows = rows.slice(0,p.value);
  }
  const docs = rows.map(r=>({id:r.id,ref:docRef(q.name,r.id),data:()=>r}));
  return {docs,size:docs.length};
}
`
// Instrument only the served test response, never the application source.
const mapSource = await (await fetch(base + '/src/components/MapView.jsx')).text()
assert.ok(mapSource.includes('map.invalidateSize({ pan: false })'))
const mapInstrumented = mapSource.replace('map.invalidateSize({ pan: false })', `(window.__mapChecks.push({
  path:location.pathname, t:performance.now(), size:map.getSize(),
  width:map.getContainer().clientWidth, height:map.getContainer().clientHeight,
  transform:getComputedStyle(page).transform
}), map.invalidateSize({ pan: false }))`)

const browser = await puppeteer.launch({ executablePath:chrome, headless:true,
  userDataDir:path.resolve('tmp/admin-motion/browser-profile'), args:['--no-sandbox','--disable-dev-shm-usage'] })
const errors = [], checks = []
try {
  const page = await browser.newPage()
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__queryDelay = 40
    window.__profile = {id:'offline-admin',full_name:'Offline Admin',email:'fixture@example.invalid',role:'admin',status:'active'}
    window.__db = {
      reports:Array.from({length:60}, (_,i)=>({id:'r'+i,report_code:'RA-TEST-'+String(i).padStart(4,'0'),
        accident_date:new Date().toISOString().slice(0,10),accident_time:'10:30',municipality:'Malolos',barangay:'Centro',
        location_text:'Provincial road',description:'Offline fixture',accident_type_id:'collision',accident_type_name:'Collision',
        status:i%2?'verified':'submitted',injury_status:'none',latitude:14.85+i*.001,longitude:120.81+i*.001,
        vehicles:[],status_history:[],created_at:'2026-11-01T00:00:00Z'})),
      users:[], notifications:[], audit_logs:[], accident_types:[{id:'collision',name:'Collision',active:true}],
      emergency_contacts:[], report_photos:[], settings:[],
    }
    window.__db.users = [window.__profile, {id:'officer',full_name:'Fixture Officer',role:'officer',status:'active'}]
    window.__enters = []; window.__ends = []; window.__samples = []; window.__mapChecks = []
    document.addEventListener('animationstart', e => {
      if(e.animationName !== 'rr-page-enter') return
      window.__enters.push({path:location.pathname,t:performance.now()})
      const wrapper=e.target, animation=wrapper.getAnimations()[0]
      const frames=animation.effect.getKeyframes()
      window.__lastAnimation={duration:animation.effect.getTiming().duration,fill:animation.effect.getTiming().fill,
        easing:getComputedStyle(wrapper).animationTimingFunction,frames:frames.map(f=>({opacity:f.opacity,transform:f.transform}))}
      const sample=()=>{
        if(!wrapper.isConnected) return
        window.__samples.push({path:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
          transform:getComputedStyle(wrapper).transform})
        if(wrapper.getAnimations().some(a=>a.playState==='running')) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    document.addEventListener('animationend', e => {
      if(e.animationName==='rr-page-enter') window.__ends.push({path:location.pathname,t:performance.now()})
    })
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url=new URL(req.url())
    if(['data:','blob:'].includes(url.protocol)) return req.continue()
    if(url.origin!==origin) return req.abort()
    const respond=body=>req.respond({status:200,contentType:'application/javascript',body})
    if(url.pathname==='/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider=({children})=>children;
      export const useAuth=()=>({user:{uid:'offline-admin'},profile:window.__profile,loading:false,signOut:async()=>{}});
      export const useActor=()=>({uid:'offline-admin',role:'admin'});
    `)
    if(url.pathname==='/src/lib/firebase.js') return respond(`export const auth={},db={},apiKey='offline-fixture',isFirebaseConfigured=true;`)
    if(url.pathname==='/src/lib/firestore.js') return respond(mock)
    if(url.pathname==='/src/components/MapView.jsx') return respond(mapInstrumented)
    return req.continue()
  })
  page.on('pageerror',e=>errors.push(e.message))
  const settled=async()=>{
    await page.waitForFunction(()=>document.querySelector('.rr-page-enter') && !document.querySelector('.page-loading')
      && !document.querySelector('.rr-page-enter').getAnimations().some(a=>a.playState==='running'))
  }
  const checkPage=async(route,title,animated=true)=>{
    await page.waitForFunction((route,title)=>location.pathname===route && document.title===title+' — RoadReport',{},route,title)
    await settled()
    const result=await page.evaluate(()=>({
      title:document.title,y:scrollY,focus:document.activeElement.id,
      transform:getComputedStyle(document.querySelector('.rr-page-enter')).transform,
      opacity:getComputedStyle(document.querySelector('.rr-page-enter')).opacity,
      outline:getComputedStyle(document.querySelector('#page')).outlineStyle,
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      expanded:document.querySelector('.rr-burger').getAttribute('aria-expanded'),
      persistent:window.__sidebar===document.querySelector('.sidebar'),
    }))
    assert.equal(result.title,title+' — RoadReport')
    assert.equal(result.y,0,'Navigation starts at top')
    assert.equal(result.focus,'page','Navigation focuses main')
    assert.equal(result.outline,'none')
    assert.equal(result.transform,'none','No retained containing block')
    assert.equal(result.opacity,'1')
    assert.ok(result.scrollWidth<=result.width+1,'No horizontal overflow')
    assert.equal(result.expanded,'false')
    assert.equal(result.persistent,true,'Sidebar persists')
    if(animated){
      const animation=await page.evaluate(()=>window.__lastAnimation)
      assert.equal(animation.duration,220)
      assert.equal(animation.fill,'backwards')
      assert.equal(animation.easing,'cubic-bezier(0.22, 0.61, 0.36, 1)')
      assert.deepEqual(animation.frames,[{opacity:'0',transform:'translateY(8px)'},{opacity:'1',transform:'translateY(0px)'}])
    }
    checks.push({route,width:result.width,animated})
  }
  const nav=async(route,title,animated=true)=>{
    const before=await page.evaluate(()=>window.__enters.length)
    if(await page.$eval('.rr-burger',el=>el.getClientRects().length>0)) await page.click('.rr-burger')
    await page.click(`#site-nav a[href="${route}"]`)
    await checkPage(route,title,animated)
    assert.equal(await page.evaluate(()=>window.__enters.length),before+(animated?1:0))
  }
  const remember=()=>page.evaluate(()=>{
    window.__wrapper=document.querySelector('.rr-page-enter'); window.__count=window.__enters.length
  })
  const unchanged=async(label)=>{
    await settled()
    assert.equal(await page.evaluate(()=>window.__wrapper===document.querySelector('.rr-page-enter') && window.__count===window.__enters.length),true,label)
  }
  const items=[['/admin/reports','Accident reports'],['/admin/summaries','Summaries and export'],['/admin/users','Users'],
    ['/admin/settings','Categories and settings'],['/admin/audit','Audit trail'],['/admin/notifications','Notifications'],
    ['/admin/account','My account'],['/admin','Dashboard']]

  for(const width of [1440,390]){
    await page.setViewport({width,height:900})
    await page.goto(base+'/admin')
    await settled()
    assert.equal(await page.evaluate(()=>document.activeElement.id==='page'),false,'First load does not steal focus (including StrictMode)')
    await page.evaluate(()=>{window.__sidebar=document.querySelector('.sidebar')})
    for(const [route,title] of items) await nav(route,title)
    await page.waitForFunction(()=>window.__mapChecks.some(c=>c.path==='/admin' && c.transform==='none'))
    const mapChecks=await page.evaluate(()=>window.__mapChecks)
    for(const m of mapChecks){assert.equal(m.width,m.size.x);assert.equal(m.height,m.size.y);assert.ok(m.width>200);assert.equal(m.height,378,'380px map box minus its two borders')}
    await page.screenshot({path:path.join(output,`dashboard-${width}.png`),fullPage:true})
    // Entry completion must not recreate charts. Filters use the same wrapper.
    await remember()
    await page.evaluate(()=>{window.__canvases=[...document.querySelectorAll('.chart-box canvas')]})
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.equal(await page.evaluate(()=>window.__canvases.length===6 && window.__canvases.every((c,i)=>c===document.querySelectorAll('.chart-box canvas')[i])),true,'Entry completion keeps chart instances mounted')
    await page.click('#range-form .btn-link')
    await settled()
    await unchanged('Dashboard data refresh does not re-enter')
    await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}))
    if(width===390){
      assert.equal(await page.$eval('.sidebar',el=>getComputedStyle(el).position),'sticky')
      assert.ok(Math.abs(await page.$eval('.sidebar',el=>el.getBoundingClientRect().top))<1)
    }
    await nav('/admin/reports','Accident reports')
    await remember()
    await page.select('select[aria-label="Status"]','submitted')
    await unchanged('Status filter does not re-enter')
    await page.select('select[aria-label="Status"]','')
    await settled()
    await page.waitForFunction(()=>![...document.querySelectorAll('.rr-reports-pager button')].find(b=>b.textContent==='Next').disabled)
    await page.click('.rr-reports-pager button:last-child')
    await unchanged('Table pagination does not re-enter')
    await page.type('input[type="search"]','Provincial')
    await new Promise(resolve=>setTimeout(resolve,450))
    await unchanged('Debounced search does not re-enter')
    const searchValue=await page.$eval('input[type="search"]',el=>el.value)
    await page.evaluate(()=>{history.pushState({},'','?status=submitted#fixture');dispatchEvent(new PopStateEvent('popstate'))})
    await unchanged('Query/hash-only navigation does not re-enter')
    assert.equal(await page.$eval('input[type="search"]',el=>el.value),searchValue,'Search state is preserved')
    await page.screenshot({path:path.join(output,`reports-${width}.png`),fullPage:true})
    await page.click('.code-cell a')
    await checkPage(new URL(page.url()).pathname,'Report details')
    // Fixed dialogs stay viewport-sized once the animation releases its transform.
    await nav('/admin/users','Users')
    await page.click('.rr-users-table .btn')
    const modal=await page.$eval('.modal',el=>({top:el.getBoundingClientRect().top,width:el.getBoundingClientRect().width}))
    assert.equal(modal.top,0);assert.equal(modal.width,width)
    await page.keyboard.press('Escape')
    await nav('/admin/account','My account')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(()=>document.activeElement.closest('#page')!==null),true,'Tab proceeds into new page')
    await page.focus('.skip-link')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(()=>document.activeElement.id),'page','Skip link still focuses main')
    await nav('/admin/reports','Accident reports')
    await nav('/admin/users','Users')
    await page.evaluate(()=>window.scrollTo({top:300,behavior:'instant'}))
    await page.goBack()
    await checkPage('/admin/reports','Accident reports')
    await page.goForward()
    await checkPage('/admin/users','Users')
    // Rapid route changes remove the outgoing wrapper immediately.
    await page.evaluate(()=>document.querySelector('#site-nav a[href="/admin/reports"]').click())
    await page.waitForFunction(()=>location.pathname==='/admin/reports')
    await page.evaluate(()=>{window.__outgoing=document.querySelector('.rr-page-enter');document.querySelector('#site-nav a[href="/admin/account"]').click()})
    await checkPage('/admin/account','My account')
    assert.equal(await page.evaluate(()=>window.__outgoing.isConnected),false)
    const samples=await page.evaluate(()=>window.__samples)
    assert.ok(samples.length>20)
    assert.deepEqual(samples.filter(s=>s.overflow>1),[],'No horizontal overflow during motion')
    assert.ok(samples.some(s=>s.transform!=='none'),'Rise is visible during entry')

    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
    for(const [route,title] of items) await nav(route,title,false)
    assert.equal(await page.$eval('.rr-page-enter',el=>getComputedStyle(el).animationName),'none')
    for(const pseudo of [null,'::before']){
      assert.equal(await page.$eval('.side-nav a',(el,pseudo)=>getComputedStyle(el,pseudo).transitionDuration,pseudo),'0s')
    }
    assert.equal(await page.$eval('.rr-burger-bars',el=>getComputedStyle(el).transitionDuration),'0s')
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}])
    if(width===390) assert.equal(await page.$eval('.rr-burger-bars',el=>getComputedStyle(el).transitionDuration),'0.2s, 0.2s')
    await page.emulateMediaType('print')
    assert.equal(await page.$eval('.rr-page-enter',el=>getComputedStyle(el).animationName),'none')
    await page.emulateMediaType('screen')
    await settled() // Restoring screen media reapplies the CSS entry declaration.
    console.log(`PASS ${width}px: navigation, map, filters/paging/search, history, focus, reduced motion, printing`)
  }
  // Slow data mounts after entry without a second animation, using the map fallback.
  await page.evaluate(()=>{window.__queryDelay=400})
  await nav('/admin/reports','Accident reports')
  const mapCount=await page.evaluate(()=>window.__mapChecks.length)
  await nav('/admin','Dashboard')
  await page.waitForFunction(count=>window.__mapChecks.length>count && window.__mapChecks.at(-1)?.transform==='none',{},mapCount)
  assert.deepEqual(errors,[])
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checks,errors},null,2))
  console.log('PASS: offline admin motion checks; no application runtime errors. Artifacts: '+output)
} finally { await browser.close() }
