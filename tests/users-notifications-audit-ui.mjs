/** Offline visual checks. Run Vite, then APP_BASE=http://127.0.0.1:5179 node tests/users-notifications-audit-ui.mjs.
 * Real pages, services and unread provider; in-memory Firestore only. No live Firebase access.
 * Comparison PNGs show the app on the left and the untouched mockup on the right.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

const base = process.env.APP_BASE || 'http://127.0.0.1:5179'
const origin = new URL(base).origin
const output = path.resolve('output/users-notifications-audit-ui')
fs.mkdirSync(output, { recursive: true })
let mock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
mock = mock.replace('export async function getDocs(q)', 'async function unusedGetDocs(q)')
mock = mock.replace('export const setDoc = deny, addDoc = deny, patchDoc = deny, removeDoc = deny, createDoc = deny;', 'export const setDoc = deny, addDoc = deny, removeDoc = deny, createDoc = deny;')
mock = mock.replace('export const writeBatch = deny, runTransaction = deny;', 'export const runTransaction = deny;')
mock += `
export async function getDocs(q) {
  await new Promise(resolve => setTimeout(resolve, window.__delay || 0));
  if (window.__state === 'error' && q.name !== 'notifications') throw new Error('Fixture load failed');
  if (window.__state === 'error' && q.name === 'notifications' && q.parts.some(p=>p.kind==='limit' && p.value===50)) throw new Error('Fixture load failed');
  let rows = window.__state === 'empty' ? [] : [...(window.__db[q.name] || [])];
  for (const p of q.parts || []) {
    if(p.kind === 'where') rows = rows.filter(r => p.op === '>=' ? new Date(r[p.field]) >= p.value : p.op === '<=' ? new Date(r[p.field]) <= p.value : p.op === 'in' ? p.value.includes(r[p.field]) : r[p.field] === p.value);
    if(p.kind === 'limit') rows = rows.slice(0, p.value);
  }
  const docs = rows.map(r=>({id:r.id,ref:docRef(q.name,r.id),data:()=>({...r})}));
  return { docs, size:docs.length };
}
export async function patchDoc(name,id,data) {
  if(name !== 'notifications' || Object.keys(data).join(',') !== 'read' || data.read !== true) throw new Error('Unexpected fixture write');
  await new Promise(resolve=>setTimeout(resolve,100));
  Object.assign(window.__db.notifications.find(r=>r.id===id),data);
}
export function writeBatch() {
  const ops=[]; return {update(ref,data){ops.push([ref,data])},async commit(){for(const [ref,data] of ops) await patchDoc(ref.name,ref.id,data)}};
}
`
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const browser = await puppeteer.launch({executablePath:chrome,headless:true,userDataDir:path.resolve('tmp/users-notifications-audit-ui/browser-profile'),args:['--no-sandbox']})
const errors = [], checks = []
try {
  const page = await browser.newPage()
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    const date = '2026-10-23T10:42:00Z'
    window.__db = {
      users: [
        {id:'admin',full_name:'admin',role:'admin',email:'admin@example.gov.ph',status:'active',phone:''},
        {id:'offline-admin',full_name:'Demo User',role:'admin',email:'admin@example.gov.ph',status:'active',phone:''},
        {id:'officer',full_name:'Demo User',role:'officer',email:'officer@example.invalid',status:'active',phone:'09123456789',badge_no:'TO-0045'},
        {id:'public',full_name:'Public User',role:'reporter',email:'public@example.invalid',status:'inactive',phone:''},
      ].map(r=>({...r,created_at:'2026-10-21T00:00:00Z'})),
      audit_logs: [
        {id:'a1',actor_name:'admin',actor_role:'admin',action:'user.update',entity:'user',entity_id:'offline-admin',details:'status: active'},
        {id:'a2',actor_name:'admin',actor_role:'admin',action:'user.update',entity:'user',entity_id:'offline-admin',details:'status: inactive'},
        {id:'a3',actor_name:'Demo User',actor_role:'admin',action:'settings.update',entity:'settings',details:{changed:{arrival_match_radius_m:{from:120,to:95}}}},
        {id:'a4',actor_name:'Demo User',actor_role:'admin',action:'report.status',entity:'report',entity_id:'RA-2026-000002',details:{changed:{status:{from:'submitted',to:'under_review'}}}},
      ].map(r=>({...r,created_at:date})),
      notifications: [
        {id:'n1',title:'New report awaiting review',message:'A report was submitted near MacArthur Hwy in Malolos.'},
        {id:'n2',title:'Officer dispatched',message:'Demo User was assigned to report RA-2026-000002.'},
        {id:'n3',title:'Site cleared',message:'The assigned officer finished clearing the site.'},
      ].map(r=>({...r,user_id:'offline-admin',read:false,created_at:'2026-10-21T08:38:00Z'})),
    }
    window.__state = 'normal'
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = new URL(req.url())
    if (['data:','blob:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) {
      if (['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) return req.continue()
      return req.abort()
    }
    const respond = body => req.respond({status:200,contentType:'application/javascript',body})
    if(url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider=({children})=>children;
      export const useAuth=()=>({user:{uid:'offline-admin'},profile:{role:'admin',full_name:'Demo User'},loading:false,signOut:async()=>{}});
      export const useActor=()=>({uid:'offline-admin',role:'admin'});
    `)
    if(url.pathname === '/src/lib/firebase.js') return respond(`export const auth={},db={},apiKey='offline-fixture',isFirebaseConfigured=true;`)
    if(url.pathname === '/src/lib/firestore.js') return respond(mock)
    return req.continue()
  })
  page.on('pageerror', e=>errors.push(e.message))
  page.on('console', m=>{if(m.type()==='error') errors.push(m.text())})
  const overflow = async label => {
    const sizes=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
    assert.ok(sizes.html<=sizes.width+1 && sizes.body<=sizes.width+1,`${label}: ${JSON.stringify(sizes)}`)
  }
  const contrast = async () => {
    const failures=await page.evaluate(()=>{
      const rgb = value => (value.match(/[\d.]+/g)||[]).map(Number)
      const blend = (fg,bg) => fg.slice(0,3).map((c,i)=>c*(fg[3]??1)+bg[i]*(1-(fg[3]??1)))
      const lum = color => color.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0)
      const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)
      const bad=[]
      for(const el of document.querySelectorAll('.staff-main *')) {
        if(!el.getClientRects().length || el.closest('button:disabled') || ![...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())) continue
        const style=getComputedStyle(el), fg=rgb(style.color)
        let backgrounds=[[27,34,38]]
        for(let node=el;node && !node.classList.contains('staff-main');node=node.parentElement) {
          const s=getComputedStyle(node), bg=rgb(s.backgroundColor)
          const gradient=[...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m=>rgb(m[0]))
          if(gradient.length) {backgrounds=gradient.map(c=>blend(c,[27,34,38]));break}
          if((bg[3]??1)>0) {backgrounds=[blend(bg,[27,34,38])];break}
        }
        const minimum=(parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700))?3:4.5
        const value=Math.min(...backgrounds.map(bg=>ratio(fg,bg)))
        if(value+.01<minimum) bad.push({text:el.textContent.trim().slice(0,50),color:style.color,ratio:value,minimum})
      }
      return bad
    })
    assert.deepEqual(failures,[],'AA text contrast')
  }
  const go = async (screen,width) => {
    await page.setViewport({width,height:1000})
    await page.goto(`${base}/admin/${screen}`)
    await page.waitForFunction(()=>!document.querySelector('.page-loading'))
    await page.evaluate(()=>document.fonts.ready)
  }
  for(const screen of ['users','notifications','audit']) {
    for(const width of [320,360,390,414,768,1024,1440]) {
      await go(screen,width)
      await overflow(`${screen}/${width}`)
      await contrast()
      if(screen!=='notifications') assert.equal(await page.$eval('tbody tr',r=>getComputedStyle(r).display),width<768?'grid':'table-row')
      if(screen==='users' && width<768) assert.equal(await page.$eval('tbody td:nth-child(3)',el=>getComputedStyle(el).display),'none')
      if(screen==='audit' && width>=768) {
        assert.equal(await page.$eval('tbody td',el=>getComputedStyle(el).position),'relative')
        assert.equal(await page.$eval('table',el=>getComputedStyle(el).borderCollapse),'collapse')
        assert.ok(await page.$$eval('tbody tr',rows=>rows.slice(1).every((r,i)=>Math.abs(r.getBoundingClientRect().top-rows[i].getBoundingClientRect().bottom)<1)))
      }
      await page.focus(screen==='notifications'?'.notif-row':'input[type=search]')
      await page.keyboard.press('Tab')
      const focus=await page.evaluate(()=>{const el=document.activeElement,s=getComputedStyle(el);return {tag:el.tagName,classes:el.className,visible:el.matches(':focus-visible'),style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})
      assert.ok(focus.visible && focus.style!=='none' && focus.width>=2,`${screen} focus ${JSON.stringify(focus)}`)
      if([390,1440].includes(width)) {
        await page.evaluate(()=>document.activeElement.blur())
        const live=path.join(output,`${screen}-${width}.png`), reference=path.join(output,`${screen}-mockup-${width}.png`)
        await page.screenshot({path:live,fullPage:true})
        const ref=await browser.newPage()
        await ref.setViewport({width,height:1000})
        await ref.goto(`${base}/html-mockups/_screens/${screen}/index.html`)
        await ref.evaluate(()=>document.fonts.ready)
        await ref.screenshot({path:reference,fullPage:true})
        await ref.close()
        const a=PNG.sync.read(fs.readFileSync(live)),b=PNG.sync.read(fs.readFileSync(reference))
        const joined=new PNG({width:width*2,height:Math.max(a.height,b.height)})
        joined.data.fill(14)
        PNG.bitblt(a,joined,0,0,a.width,a.height,0,0)
        PNG.bitblt(b,joined,0,0,b.width,b.height,width,0)
        fs.writeFileSync(path.join(output,`${screen}-comparison-${width}.png`),PNG.sync.write(joined))
      }
      checks.push(`${screen}/${width}`)
    }
    await go(screen,390)
    for(const state of ['empty','error','loading']) {
      await page.evaluate(state=>{window.__state=state==='loading'?'normal':state;window.__delay=state==='loading'?1500:0},state)
      const other = screen==='users'?'audit':'users'
      await page.evaluate(other=>document.querySelector('.side-nav a[href="/admin/'+other+'"]').click(),other)
      await page.waitForSelector('.rr-'+other+'-page')
      await page.evaluate(screen=>document.querySelector('.side-nav a[href="/admin/'+screen+'"]').click(),screen)
      await page.waitForSelector(state==='error'?'.rr-state-error':state==='loading'?'.page-loading':'.rr-state-empty')
      await overflow(`${screen}/${state}/390`)
      await go(screen,390)
    }
  }
  await go('users',390)
  await page.click('.rr-head .btn')
  await page.waitForSelector('#u-role')
  assert.deepEqual(await page.$$eval('#u-role option',els=>els.map(el=>el.value)),['admin','officer'])
  await overflow('Add dialog/390')
  await page.screenshot({path:path.join(output,'users-add-dialog-390.png'),fullPage:true})
  await page.keyboard.press('Escape')
  await page.waitForSelector('#u-role',{hidden:true})
  await go('notifications',1440)
  await page.waitForFunction(()=>document.querySelector('.side-nav .count-pill')?.textContent==='3')
  await page.click('[data-id="n1"]')
  await page.waitForFunction(()=>document.querySelector('[data-id="n1"]').dataset.read==='1' && document.querySelector('.side-nav .count-pill')?.textContent==='2')
  await contrast()
  await page.screenshot({path:path.join(output,'notifications-read-1440.png'),fullPage:true})
  await page.waitForFunction(()=>!document.querySelector('#mark-all')?.disabled)
  await page.click('#mark-all')
  await page.waitForFunction(()=>!document.querySelector('.side-nav .count-pill'))
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
  await page.hover('.notif-row')
  assert.equal(await page.$eval('.notif-row',el=>getComputedStyle(el).transform),'none')
  assert.equal(await page.$eval('.notif-row',el=>getComputedStyle(el).transitionDuration),'0s')
  assert.deepEqual(errors,[])
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({checks,errors,dialog:'open/close passed',notification:'read + counter 3 → 2 → hidden passed',states:'loading/empty/error at 390 passed',contrast:'AA text contrast passed',reducedMotion:'passed'},null,2))
  console.log(`PASS: ${checks.length} viewport checks, focus, states, dialog, read/counter, reduced motion; no console errors. Comparisons: ${output}`)
} finally { await browser.close() }
