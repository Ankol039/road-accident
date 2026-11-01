/** Isolated browser UI checks. Firebase transport and auth service use memory fixtures.
 * Run Vite on 5181, then node tests/account-settings-login-ui.mjs.
 * Comparisons: app on left, untouched mockup on right. No live data is accessed.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'
const base=process.env.APP_BASE || 'http://127.0.0.1:5181', origin=new URL(base).origin
const output=path.resolve('output/account-settings-login-ui');fs.mkdirSync(output,{recursive:true})
let mock=fs.readFileSync('tests/summaries-downloads.mjs','utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
mock=mock.replace('export async function getDocs(q)','async function unusedGetDocs(q)').replace('export const fetchCollection = async () => [{ id: \'collision\', name: \'Collision\' }];','').replace('export const fetchDoc = async () => null;','')
mock+=`
export async function getDocs(q) {
 await new Promise(r=>setTimeout(r,window.__delay||0));
 if(window.__state==='error') throw new Error('Fixture load failed');
 let rows=window.__state==='empty'?[]:[...(window.__db[q.name]||[])];
 for(const p of q.parts||[]) {if(p.kind==='where') rows=rows.filter(r=>p.op==='in'?p.value.includes(r[p.field]):p.op==='>='?r[p.field]>=p.value:p.op==='<='?r[p.field]<=p.value:r[p.field]===p.value);if(p.kind==='limit')rows=rows.slice(0,p.value);}
 const docs=rows.map(r=>({id:r.id,ref:docRef(q.name,r.id),data:()=>({...r})}));return {docs,size:docs.length};
}
export const fetchCollection=async(name)=> (await getDocs({name,parts:[]})).docs.map(d=>({id:d.id,...d.data()}));
export const fetchDoc=async(name,id)=>{await new Promise(r=>setTimeout(r,window.__delay||0));if(window.__state==='error')throw new Error('Fixture load failed');return name==='users'?window.__profile:null};
`
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser=await puppeteer.launch({executablePath:chrome,headless:true,userDataDir:path.resolve('tmp/account-settings-login-ui/browser-profile'),args:['--no-sandbox']})
const errors=[],checks=[],contrastFailures=[]
try {
 const page=await browser.newPage()
 await page.evaluateOnNewDocument(()=>{
  window.__profile={id:'offline-admin',full_name:'Demo User',email:'admin@example.invalid',role:'admin',status:'active',phone:''}
  window.__state='normal';window.__delay=0
  window.__db={
   users:[window.__profile],
   accident_types:[{id:'collision',name:'Collision',description:'Two or more vehicles',active:true},{id:'single',name:'Single vehicle',description:'One vehicle involved',active:true},{id:'hidden',name:'Retired category',description:'Kept for existing reports',active:false}],
   emergency_contacts:[{id:'pnp',name:'Bulacan PNP',phone:'09123456789',category:'Police',sort_order:1,is_active:true},{id:'rescue',name:'Rescue hotline',phone:'09123456780',category:'Rescue',sort_order:2,is_active:false}],
   notifications:[{id:'n1',user_id:'offline-admin',read:false,title:'New report',message:'Awaiting review',created_at:'2026-11-01T00:00:00Z'}],
   audit_logs:[{id:'a1',actor_name:'Demo User',action:'settings.update',entity:'settings',created_at:'2026-11-01T00:00:00Z'}],
   reports:[{id:'r1',report_code:'RA-2026-000001',accident_date:'2026-11-01',accident_time:'10:30',municipality:'Malolos',location_text:'Provincial road',accident_type_id:'collision',accident_type_name:'Collision',injury_status:'none',status:'verified',vehicles:[],latitude:14.85,longitude:120.81}],
  }
 })
 await page.setRequestInterception(true)
 page.on('request',req=>{
  const url=new URL(req.url());if(['data:','blob:'].includes(url.protocol))return req.continue()
  if(url.origin!==origin){if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||url.hostname.endsWith('.tile.openstreetmap.org'))return req.continue();return req.abort()}
  const respond=body=>req.respond({status:200,contentType:'application/javascript',body})
  if(url.pathname==='/src/lib/firebase.js')return respond('export const auth={},db={},apiKey="offline",isFirebaseConfigured=true;')
  if(url.pathname==='/src/lib/firestore.js')return respond(mock)
  if(url.pathname==='/src/services/auth.service.js')return respond(`
   let listener;const user={uid:'offline-admin',email:'admin@example.invalid'};
   export const watchAuth=cb=>{listener=cb;queueMicrotask(()=>cb(sessionStorage.getItem('guest')==='1'?null:user));return()=>{listener=null}};
   export const signIn=async()=>{if(window.__loginError)throw Object.assign(new Error('Incorrect email or password.'),{code:'auth/invalid-credential'});sessionStorage.removeItem('guest');queueMicrotask(()=>listener?.(user));return user};
   export const signOut=async()=>{sessionStorage.setItem('guest','1');window.__signedOut=(window.__signedOut||0)+1;await listener?.(null)};
   export const loadProfile=async()=>window.__missingProfile?null:window.__profile;
   export const ensureProfile=async()=>null;
   export const canUsePortal=p=>Boolean(p&&['admin','officer'].includes(p.role));
   export const sendReset=async()=>{};
   export const changePassword=async()=>{throw new Error('auth/wrong-password')};
  `)
  return req.continue()
 })
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 const go=async(screen,width)=>{
  await page.setViewport({width,height:1000});if(screen==='login'&&page.url().startsWith(base))await page.evaluate(()=>sessionStorage.setItem('guest','1'));await page.goto(base+(screen==='login'?'/login':screen==='dashboard'?'/admin':'/admin/'+screen))
  if(screen==='login'&&!page.url().includes('/login')) {await page.evaluate(()=>sessionStorage.setItem('guest','1'));await page.goto(base+'/login')}
  await page.waitForSelector(screen==='login'?'.rr-login-card':'.staff-main h1');await page.waitForFunction(()=>!document.querySelector('.page-loading'))
  await page.evaluate(()=>document.fonts.ready)
 }
 const overflow=async(label)=>{const sizes=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(sizes.html<=sizes.width+1&&sizes.body<=sizes.width+1,label+JSON.stringify(sizes))}
 // Reuse the previous integration's text contrast audit with the login card included.
 const prior=fs.readFileSync('tests/users-notifications-audit-ui.mjs','utf8')
 const contrastBody=prior.slice(prior.indexOf('const failures=await page.evaluate('),prior.indexOf("    assert.deepEqual(failures,[],'AA text contrast')")).replace("document.querySelectorAll('.staff-main *')","document.querySelectorAll('.staff-main *, .rr-login-page *')").replace("!node.classList.contains('staff-main')","!node.classList.contains('staff-main') && !node.classList.contains('rr-login-page')")
 const contrast=new Function('page',`return (async()=>{${contrastBody};return failures})()`)
 for(const screen of ['account','settings','login'])for(const width of [320,360,390,414,768,1024,1440]) {
  if(screen!=='login' && page.url().startsWith(base))await page.evaluate(()=>sessionStorage.removeItem('guest'))
  await go(screen,width);await overflow(`${screen}/${width}`)
  const failures=await contrast(page);if(failures.length)contrastFailures.push({screen,width,failures})
  await page.focus(screen==='login'?'#email':screen==='account'?'#full_name':'#t-name');await page.keyboard.press('Tab')
  assert.ok(await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return e.matches(':focus-visible')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2}),screen+' keyboard focus')
  if([390,1440].includes(width)){
   await page.click('h1');await page.evaluate(()=>{document.activeElement.blur();window.getSelection()?.removeAllRanges();window.scrollTo(0,0)});const live=path.join(output,`${screen}-${width}.png`);await page.screenshot({path:live,fullPage:true})
   const ref=await browser.newPage();await ref.setViewport({width,height:1000});await ref.goto(`${base}/html-mockups/_screens/${screen}/index.html`);await ref.evaluate(()=>document.fonts.ready)
   const reference=path.join(output,`${screen}-mockup-${width}.png`);await ref.screenshot({path:reference,fullPage:true});await ref.close()
   const a=PNG.sync.read(fs.readFileSync(live)),b=PNG.sync.read(fs.readFileSync(reference)),joined=new PNG({width:width*2,height:Math.max(a.height,b.height)});joined.data.fill(14);PNG.bitblt(a,joined,0,0,a.width,a.height,0,0);PNG.bitblt(b,joined,0,0,b.width,b.height,width,0);fs.writeFileSync(path.join(output,`${screen}-comparison-${width}.png`),PNG.sync.write(joined))
  }
  checks.push(`${screen}/${width}`)
 }
 await go('login',390)
 assert.equal(await page.$('.rr-burger'),null)
 await page.click('#password-toggle');assert.equal(await page.$eval('#password',e=>e.type),'text');assert.equal(await page.$eval('#password-toggle',e=>e.getAttribute('aria-pressed')),'true');await page.keyboard.press('Space');assert.equal(await page.$eval('#password',e=>e.type),'password')
 await page.evaluate(()=>{window.__loginError=true});await page.click('button[type=submit]');await page.waitForSelector('#message.rr-login-error');assert.equal(await page.$eval('#message .rr-state-error',e=>getComputedStyle(e).color),'rgb(229, 72, 58)')
 await page.evaluate(()=>{window.__loginError=false});await page.type('#email','fixture@example.invalid');await page.type('#password','fixture-only');await page.click('button[type=submit]');await page.waitForSelector('.staff-main');await page.click('.rr-burger');await page.click('.sidebar-foot button');await page.waitForSelector('.rr-login-card');assert.ok(await page.evaluate(()=>window.__signedOut>=1))
 // The actual React auth provider rejects a missing profile and signs it out.
 await page.evaluate(()=>{window.__missingProfile=true});await page.click('button[type=submit]');await page.waitForSelector('#message');assert.ok(await page.evaluate(()=>window.__signedOut>=2))
 await page.evaluate(()=>sessionStorage.removeItem('guest'));await go('account',390)
 await page.type('#pw-new','fixture-value');await page.type('#pw-confirm','different-value');await page.click('#password-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('#pw-confirm + .invalid-feedback')?.textContent.includes('do not match'))
 await page.$eval('#pw-confirm',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'fixture-value');e.dispatchEvent(new Event('input',{bubbles:true}))});await page.click('#password-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('#pw-current + .invalid-feedback')?.textContent.includes('incorrect'))
 await go('settings',390);await page.click('.rr-settings-add button[type=submit]');await page.waitForSelector('#t-name.is-invalid')
 const before=await page.$eval('#c-active',e=>e.checked);await page.click('label[for=c-active]');assert.equal(await page.$eval('#c-active',e=>e.checked),!before)
 assert.equal(await page.$eval('.rr-settings-hidden td:nth-child(3)',e=>e.textContent),'Hidden')
 for(const state of ['empty','error','loading']){
  await page.evaluate(state=>{window.__state=state==='loading'?'normal':state;window.__delay=state==='loading'?1000:0},state)
  await page.evaluate(()=>document.querySelector('.side-nav a[href="/admin/account"]').click());await page.waitForSelector('.rr-account-page');await page.evaluate(()=>document.querySelector('.side-nav a[href="/admin/settings"]').click());await page.waitForSelector(state==='error'?'.rr-state-error':state==='loading'?'.page-loading':'.rr-state-empty');await overflow('settings '+state)
 }
 await page.evaluate(()=>sessionStorage.removeItem('guest'))
 for(const screen of ['dashboard','reports','summaries','users','settings','audit','notifications','account'])for(const width of [1440,390]){await go(screen,width);await overflow(`consistency ${screen}/${width}`);await page.screenshot({path:path.join(output,`route-${screen}-${width}.png`),fullPage:true})}
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);for(const screen of ['account','settings','login']){await go(screen,390);assert.equal(await page.$eval('button',e=>getComputedStyle(e).transitionDuration),'0s')}
 fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({checks,errors,contrastFailures,auth:'fixture sign in/out + missing-profile sign-out',states:'settings loading/error/empty',toggle:'keyboard + pointer passed',routes:'all 9 at 1440 and 390 captured'},null,2))
 assert.deepEqual(errors,[],'console/runtime errors');assert.deepEqual(contrastFailures,[],'AA text contrast')
 console.log('PASS: 21 viewport checks, all routes, focus, AA text contrast, reduced motion, checkbox, password toggle, fixture sign-in/out and missing-profile guard.')
} finally {await browser.close()}
