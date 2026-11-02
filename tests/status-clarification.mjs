/** Offline status regression. Local Vite only; Firebase is replaced before any app module loads. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { REPORT_STATUSES, REPORT_STATUS_DEFINITIONS as DEFINITIONS, STATUS_LABELS, STATUS_COLORS, STATUS_HELP, STATUS_TRANSITIONS, OFFICIAL_STATUSES, OFFICER_ACTIVE_STATUSES, STATUS_FORM_HIDDEN, OFFICIAL_RECORDS_HELP, FLAGGED_HELP, statusAction } from '../src/lib/reportStatuses.js'

const base = process.env.APP_BASE || 'http://127.0.0.1:5181'
const origin = new URL(base).origin
const output = path.resolve('output/status-clarification')
fs.mkdirSync(output, { recursive: true })
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const date = new Date().toISOString().slice(0, 10)
const profile = { id: 'admin', role: 'admin', status: 'active', full_name: 'Offline Administrator', email: 'admin@example.invalid' }
const officer = { id: 'officer', role: 'officer', status: 'active', full_name: 'Offline Officer', email: 'officer@example.invalid', badge_no: 'TEST' }
const template = { accident_date: date, accident_time: '10:00', accident_type_id: 'collision', accident_type_name: 'Collision', location_text: 'Test road', municipality: 'Malolos', injury_status: 'none', latitude: 14.85, longitude: 120.81, arrival_latitude: 14.85, arrival_longitude: 120.81, arrival_accuracy_m: 5, gps_accuracy_m: 5, arrival_at: '2026-11-01T01:00:00Z', created_at: '2026-11-01T00:00:00Z', officer_id: 'officer', officer_name: 'Offline Officer', verified_by_name: 'Offline Administrator', verified_at: '2026-11-01T02:00:00Z', vehicles: [], description: 'Offline fixture', reporter_name: 'Offline Reporter' }
const fixtures = REPORT_STATUSES.map(status => ({ ...template, id: status, status, report_code: `TEST-${status}`, flagged: status === 'duplicate', duplicate_of: status === 'duplicate' ? 'resolved' : null, duplicate_of_code: status === 'duplicate' ? 'TEST-resolved' : null, flag_reason: status === 'duplicate' ? 'Review attention' : null, status_history: [{status, at:'2026-11-01T01:00:00Z', by:'Fixture', note:'Historical Verified prose stays unchanged'}] }))
for (const [status, count] of [['submitted', 11], ['assigned', 5], ['rejected', 1]]) for(let i=0;i<count;i++) fixtures.push({...fixtures.find(r=>r.status===status),id:`extra-${status}-${i}`})
const originalBadgeColors = {submitted:'rgb(200, 205, 201)',under_review:'rgb(156, 198, 245)',info_required:'rgb(245, 197, 24)',assigned:'rgb(179, 166, 240)',on_scene:'rgb(134, 214, 234)',verified:'rgb(111, 224, 161)',in_progress:'rgb(241, 154, 122)',rejected:'rgb(243, 154, 149)'}
const audit = [
 {id:'report-audit',entity:'report',entity_id:'submitted',action:'report.status',actor_name:'Fixture',created_at:'2026-11-01T01:00:00Z',details:{changed:{status:{from:'submitted',to:'under_review'}},note:'Historical Verified prose stays unchanged'}},
 {id:'user-audit',entity:'user',entity_id:'admin',action:'user.update',actor_name:'Fixture',created_at:'2026-11-01T01:00:00Z',details:{changed:{status:{from:'active',to:'inactive'}}}},
 {id:'legacy-audit',entity:'report',entity_id:'submitted',action:'report.status',actor_name:'Fixture',created_at:'2026-11-01T01:00:00Z',details:{from:'assigned',to:'on_scene'}},
]
const notifications = [
 {id:'history',user_id:'admin',read:true,title:'Historical Verified notification',message:'Status is now: Verified',created_at:'2026-11-01T01:00:00Z'},
 {id:'structured',user_id:'admin',read:true,title:'Structured update',message:'Original message unchanged',kind:'status',details:{changed:{status:{from:'on_scene',to:'verified'}}},created_at:'2026-11-01T01:00:00Z'},
]
const firestoreMock = `
export const ref = name => ({name}), docRef = (name,id) => ({name,id});
export const where = (field,op,value) => ({kind:'where',field,op,value}), orderBy = (field,direction='asc') => ({kind:'order',field,direction}), limit = value => ({kind:'limit',value}), startAfter = value => ({kind:'cursor',value});
export const query = (reference,...parts) => ({...reference,parts});
const snapshot = (r,id) => ({id, ref:docRef('reports',id), exists:()=>!!r, data:()=>structuredClone(r)});
export async function getDoc(r) {return snapshot(window.__db[r.name]?.find(x=>x.id===r.id),r.id)}
export async function getDocs(q) {
 window.__queries.push(q); let rows = [...(window.__db[q.name] || [])];
 for(const p of q.parts || []) {
  if(p.kind==='where') {const value=p.value instanceof Date?p.value.toISOString():p.value;rows=rows.filter(r=>p.op==='in'?value.includes(r[p.field]):p.op==='>='?r[p.field]>=value:p.op==='<='?r[p.field]<=value:r[p.field]===value);}
  if(p.kind==='order') rows.sort((a,b)=>String(a[p.field]).localeCompare(String(b[p.field]))*(p.direction==='desc'?-1:1));
  if(p.kind==='limit') rows=rows.slice(0,p.value);
 }
 return {docs:rows.map(r=>snapshot(r,r.id)),size:rows.length};
}
export const fetchCollection = async name => (await getDocs(ref(name))).docs.map(d=>({id:d.id,...d.data()}));
export const fetchDoc = async (name,id) => {const d=await getDoc(docRef(name,id)); return d.exists()?{id,...d.data()}:null};
export const readSetting = async (_key,fallback) => fallback;
const guard = () => {if(!window.__memoryWrites) throw new Error('Fixture writes disabled')};
const apply = (r,changes) => {guard(); const row=window.__db[r.name]?.find(x=>x.id===r.id); if(!row)throw new Error('Fixture missing'); Object.assign(row,structuredClone(changes));window.__writes.push({ref:r,changes:structuredClone(changes)})};
export const patchDoc = async (name,id,changes) => apply(docRef(name,id),changes);
export const addDoc = async (r,data) => {guard();const id='memory-'+window.__writes.length;(window.__db[r.name] ||= []).push({id,...structuredClone(data)});window.__writes.push({ref:{...r,id},changes:data});return {id}};
export const setDoc = async (r,data) => apply(r,data);
export const removeDoc = () => {throw new Error('Deletion forbidden')}, createDoc = addDoc;
export const serverTimestamp = () => '2026-11-02T00:00:00Z', increment = n => n;
export async function runTransaction(_db,callback) {
 guard();
 for(let attempt=0;attempt<2;attempt++) {
  const updates=[];let wrote=false;
  const result=await callback({get:async r=>{if(wrote)throw new Error('Read after write');window.__txReads++;return getDoc(r)},update:(r,data)=>{wrote=true;updates.push([r,data])}});
  if(window.__retry && attempt===0) {const retry=window.__retry;window.__retry=null;Object.assign(window.__db.reports.find(r=>r.id===retry.id),retry.changes);continue}
  for(const [r,data] of updates)apply(r,data); return result;
 }
}
export const writeBatch = () => {throw new Error('Batch writes forbidden')};
`
const browser = await puppeteer.launch({ executablePath:chrome, headless:true, userDataDir:path.resolve('tmp/status-clarification/browser-profile'), args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run'] })
const results = {viewports:[],checks:[],errors:[],externalRequestsBlocked:0}
try {
 const page = await browser.newPage()
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
 await page.emulateTimezone('Asia/Manila')
 await page.evaluateOnNewDocument((db) => { window.__db=db;window.__queries=[];window.__writes=[];window.__txReads=0;window.__memoryWrites=false;window.__retry=null }, {reports:fixtures,users:[profile,officer,{...officer,id:'inactive',full_name:'Inactive Officer',status:'inactive'}],notifications,audit_logs:audit,accident_types:[{id:'collision',name:'Collision',active:true}],report_photos:[]})
 await page.setRequestInterception(true)
 page.on('request',req=>{
  const url=new URL(req.url()); if(['blob:','data:'].includes(url.protocol))return req.continue()
  if(url.origin!==origin){results.externalRequestsBlocked++;return req.respond({status:204,body:''})}
  const respond=body=>req.respond({status:200,contentType:'application/javascript',body})
  if(url.pathname==='/src/hooks/useAuth.jsx') return respond(`export const AuthProvider=({children})=>children;export const useAuth=()=>({user:{uid:'admin'},profile:${JSON.stringify(profile)},loading:false,signOut:async()=>{}});export const useActor=()=>(${JSON.stringify(profile)});`)
  if(url.pathname==='/src/lib/firebase.js')return respond(`export const auth={},db={},apiKey='offline-fixture',isFirebaseConfigured=true;`)
  if(url.pathname==='/src/lib/firestore.js')return respond(firestoreMock)
  req.continue()
 })
 page.on('pageerror',e=>results.errors.push(e.message))
 const go=async(route,width=1440)=>{await page.setViewport({width,height:1000});await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('.page-loading,.rr-state-loading'));await page.evaluate(()=>document.fonts.ready)}
 const screen=async(name,width)=>{
  await page.evaluate(async()=>{window.scrollTo(0,0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)})
  await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true})
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(dimensions.html<=width+1&&dimensions.body<=width+1,`${name} overflow: ${JSON.stringify(dimensions)}`)
  results.viewports.push({name,width,...dimensions})
 }
 for(const width of [1440,390]) {
  await go('/admin',width);await page.waitForSelector('#cards .stat-card')
  const cards=await page.$$eval('#cards .stat-card',els=>els.map(el=>({label:el.querySelector('.stat-label').textContent,count:Number(el.querySelector('.stat-value').textContent),level:el.dataset.level,hidden:getComputedStyle(el.querySelector('.rr-dashboard-level-text')).clip,href:el.getAttribute('href')})))
  assert.equal(cards.length,9)
  const mapping={submitted:'Awaiting review',assigned:'Dispatched',on_scene:'Arrival reported',verified:'Clearance approved',resolved:'Site cleared',under_review:'In review'}
  for(const [code,label]of Object.entries(mapping)){const c=cards.find(c=>c.label===label);assert.ok(c);assert.equal(c.count,fixtures.filter(r=>r.status===code).length);const u=new URL(c.href,base);assert.equal(u.searchParams.get('status'),code);assert.ok(u.searchParams.has('date_from'));assert.ok(u.searchParams.has('date_to'));assert.equal(u.searchParams.has('official'),false)}
  for(const c of cards){assert.equal(c.level,c.count===0?'none':c.count<=5?'low':c.count<=10?'moderate':'high');assert.equal(c.hidden,'rect(0px, 0px, 0px, 0px)')}
  const chart=await page.evaluate(async()=>{const{Chart}=await import('/node_modules/.vite/deps/chart__js.js');const c=Chart.getChart(document.querySelectorAll('canvas')[4]);return {labels:c.data.labels,colors:c.data.datasets[0].backgroundColor}})
  assert.deepEqual(chart.labels,REPORT_STATUSES.map(c=>STATUS_LABELS[c]));assert.deepEqual(chart.colors,REPORT_STATUSES.map(c=>STATUS_COLORS[c]))
  const legend=await page.$$eval('.legend-dot',els=>els.map(e=>e.parentElement.textContent.trim()));assert.deepEqual(legend,REPORT_STATUSES.map(c=>STATUS_LABELS[c]))
  await page.click('details summary');assert.ok((await page.$eval('details',el=>el.textContent)).includes(FLAGGED_HELP));await screen('dashboard',width)
  await go('/admin/reports',width);await page.waitForSelector('select[aria-label=Status]')
  assert.deepEqual(await page.$$eval('select[aria-label=Status] option',els=>els.slice(1).map(e=>({value:e.value,label:e.textContent.trim()}))),REPORT_STATUSES.map(c=>({value:c,label:STATUS_LABELS[c]})))
  for(const code of REPORT_STATUSES){await page.select('select[aria-label=Status]',code);await page.waitForFunction((code)=>[...document.querySelectorAll('tr.clickable .status-badge')].length>0&&[...document.querySelectorAll('tr.clickable .status-badge')].every(e=>e.dataset.status===code),{},code);assert.equal(await page.$eval('tr.clickable .status-badge',el=>el.textContent.trim()),STATUS_LABELS[code])}
  await screen('reports',width)
  for(const code of REPORT_STATUSES){
   await go('/admin/reports/'+code,width);await page.waitForSelector('.status-help')
   const badge=await page.$eval('.status-badge',el=>({text:el.textContent.trim(),cls:el.className,color:getComputedStyle(el).color,title:el.title}));assert.equal(badge.text,STATUS_LABELS[code]);assert.ok(badge.cls.includes(`status-${code}`));assert.equal(badge.title,STATUS_HELP[code]);if(originalBadgeColors[code])assert.equal(badge.color,originalBadgeColors[code])
   const options=await page.$$eval('#next-status option',els=>els.map(e=>e.value).filter(Boolean));const expected=code==='on_scene'||code==='duplicate'?[]:STATUS_TRANSITIONS[code].filter(c=>!STATUS_FORM_HIDDEN.includes(c));assert.deepEqual(options,expected)
   if(DEFINITIONS[code].reassignmentLocked){assert.equal(await page.$('#officer'),null);assert.ok((await page.$eval('body',el=>el.textContent)).includes('Changing officers is disabled'))}
   if(code==='verified'||code==='in_progress') {await page.select('#next-status','resolved');assert.ok(await page.$('input[name=siteCleared][required]'));const state=await page.$eval('input[name=siteCleared]',el=>({checked:el.checked,valid:el.form.checkValidity()}));assert.equal(state.checked,false);assert.equal(state.valid,false);await page.click('input[name=siteCleared]');assert.equal(await page.$eval('input[name=siteCleared]',el=>el.form.checkValidity()),true)}
   await screen('detail-'+code,width)
  }
  for(const [route,name,selector]of [['/admin/summaries','summaries','#scope'],['/admin/notifications','notifications','.notif-row'],['/admin/audit','audit','.rr-audit-table tbody tr'],['/admin/users','users','.rr-users-page tbody tr']]){
   await go(route,width);await page.waitForSelector(selector)
   const text=await page.$eval('body',el=>el.textContent)
   if(name==='summaries'){assert.equal(await page.$eval('#scope option[value=official]',el=>el.textContent), 'Official records');assert.ok(text.includes('Site cleared'));assert.ok(text.includes(OFFICIAL_RECORDS_HELP))}
   if(name==='notifications'){assert.ok(text.includes('Status is now: Verified'));assert.ok(text.includes('Arrival reported → Clearance approved'))}
   if(name==='audit'){assert.ok(text.includes('Awaiting review → In review'));assert.ok(text.includes('Dispatched'));assert.ok(text.includes('active → inactive'));assert.ok(text.includes('Historical Verified prose stays unchanged'))}
   if(name==='users'){const badges=await page.$$eval('.rr-users-page .status-badge',els=>els.map(e=>e.textContent.trim()));assert.ok(badges.includes('Active'));assert.ok(badges.includes('Inactive'));assert.ok(!badges.includes(STATUS_LABELS.verified));assert.ok(await page.evaluate(expected=>window.__queries.some(q=>q.name==='reports'&&q.parts?.some(p=>p.field==='status'&&JSON.stringify(p.value)===JSON.stringify(expected))),OFFICER_ACTIVE_STATUSES))}
   await screen(name,width)
  }
 }
 for(const width of [1440,390]) {
  await go('/admin/reports/verified',width);await page.waitForSelector('#next-status');await page.evaluate(()=>{window.__memoryWrites=true})
  await page.select('#next-status','resolved')
  await page.click('#next-status').catch(()=>{})
  await page.$eval('#next-status',el=>el.form.requestSubmit())
  assert.equal(await page.evaluate(()=>window.__writes.length),0,'Unchecked closure must not submit')
  await page.click('input[name=siteCleared]')
  await page.$eval('#next-status',el=>el.form.requestSubmit())
  await page.waitForFunction(()=>document.querySelector('.status-badge')?.dataset.status==='resolved')
  assert.ok(await page.evaluate(()=>window.__db.reports.find(r=>r.id==='verified').status_history.at(-1).note.includes('Clearing site was skipped')))
  await go('/admin/reports/submitted',width);await page.waitForSelector('#next-status');await page.evaluate(()=>{window.__memoryWrites=true})
  await page.select('#next-status','under_review');await page.$eval('#next-status',el=>el.form.requestSubmit())
  await page.waitForFunction(()=>document.querySelector('.status-badge')?.dataset.status==='under_review')
  assert.equal(await page.$eval('#next-status',el=>el.value),'','Action selection resets after a transition')
  await go('/admin/reports/duplicate',width);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Remove flag'));await page.evaluate(()=>{window.__memoryWrites=true})
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Remove flag').click())
  await page.waitForFunction(()=>window.__db.reports.find(r=>r.id==='duplicate').flagged===false)
  assert.equal(await page.evaluate(()=>window.__db.reports.find(r=>r.id==='duplicate').duplicate_of),'resolved')
 }
 await go('/admin',1440);await page.waitForSelector('#cards .stat-card')
 await page.evaluate(()=>{window.__db.reports=[];const input=document.querySelector('#range-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2020-01-01');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})
 await page.$eval('#range-form',el=>el.requestSubmit())
 await page.waitForFunction(()=>[...document.querySelectorAll('#cards .stat-card')].length===9&&[...document.querySelectorAll('#cards .stat-card')].every(c=>c.dataset.level==='none'&&c.querySelector('.stat-value').textContent==='0'))
 results.checks.push('Empty dashboard retains nine gray data-level=none cards')
 // Run the real service against in-memory Firestore, including a simulated transaction retry.
 const service=await page.evaluate(async({template,officer,transitions,hidden})=>{
  const svc=await import('/src/services/reports.service.js');window.__memoryWrites=true
  const actor={uid:'admin',full_name:'Offline Administrator'};const errors=[];let checked=0
  const reset=(status)=>{window.__db.reports=[{...template,id:'test',report_code:'TEST',status,duplicate_of:'original',duplicate_of_code:'ORIGINAL',flagged:true,status_history:[]},{...template,id:'original',status:'resolved'}];window.__writes=[]}
  for(const from of Object.keys(transitions))for(const to of Object.keys(transitions)){
   reset(from);let succeeded=false
   try{await svc.updateStatus('test',to,{actor,note:'Evidence reviewed',reason:'Review reason',siteCleared:true});succeeded=true}catch{}
   const expected=transitions[from].includes(to)&&(!['assigned','on_scene'].includes(to)||(from==='on_scene'&&to==='assigned'))
   if(succeeded!==expected)errors.push({from,to,succeeded,expected});checked++
  }
  reset('verified');let missingConfirmation=false;try{await svc.updateStatus('test','resolved',{actor})}catch(e){missingConfirmation=!!e.errors?.siteCleared}if(!missingConfirmation)errors.push('Closure accepted without confirmation')
  await svc.updateStatus('test','resolved',{actor,siteCleared:true});if(!window.__db.reports[0].status_history.at(-1).note.includes('Clearing site was skipped'))errors.push('Skipped step missing')
  reset('in_progress');await svc.updateStatus('test','resolved',{actor,siteCleared:true});if(window.__db.reports[0].status_history.at(-1).note.includes('skipped'))errors.push('Incorrect skipped-step note')
  reset('duplicate');await svc.setFlag('test',false,{actor});if(window.__db.reports[0].duplicate_of!=='original'||window.__db.reports[0].duplicate_of_code!=='ORIGINAL'||window.__db.reports[0].flagged)errors.push('Duplicate link lost')
  for(const status of ['on_scene','verified','in_progress']){reset(status);let denied=false;try{await svc.assignOfficer('test',{...officer,id:'replacement'},{actor})}catch(e){denied=!!e.errors?.officer_id}if(!denied)errors.push('Reassigned '+status)}
  reset('submitted');await svc.assignOfficer('test',officer,{actor});if(window.__db.reports[0].status!=='assigned')errors.push('Dispatch failed')
  reset('assigned');await svc.assignOfficer('test',{...officer,id:'replacement'},{actor});if(window.__db.reports[0].status!=='assigned')errors.push('Reassignment changed status')
  reset('under_review');window.__retry={id:'test',changes:{status:'resolved'}};let denied=false;try{await svc.updateStatus('test','info_required',{note:'Missing details',actor})}catch(e){denied=!!e.errors?.status}if(!denied||window.__writes.length)errors.push('Stale status transition committed')
  reset('assigned');window.__retry={id:'test',changes:{status:'on_scene'}};denied=false;try{await svc.assignOfficer('test',{...officer,id:'replacement'},{actor})}catch(e){denied=!!e.errors?.officer_id}if(!denied||window.__writes.length)errors.push('Stale assignment committed')
  reset('under_review');window.__retry={id:'test',changes:{status:'duplicate'}};await svc.setFlag('test',false,{actor});if(window.__db.reports[0].duplicate_of!=='original')errors.push('Concurrent duplicate link lost')
  reset('on_scene');await svc.updateStatus('test','verified',{actor,note:'Photos checked'});const notice=window.__db.notifications.at(-1);if(!notice.message.startsWith('Clearance approved:'))errors.push('Future notification drift')
  return {checked,errors,txReads:window.__txReads}
 },{template,officer,transitions:STATUS_TRANSITIONS,hidden:STATUS_FORM_HIDDEN})
 assert.deepEqual(service.errors,[]);results.checks.push(service)
 await go('/',390);await page.$eval('#livemap',el=>window.scrollTo(0,el.offsetTop+300));await page.waitForSelector('.st');assert.ok(!(await page.$$eval('.st',els=>els.map(e=>e.textContent))).some(s=>s.includes('New')));await screen('landing',390)
 assert.deepEqual(results.errors,[])
 results.checks.push('All ten old codes, preserved colors, cards/filters/donut/legend, account overrides, workload groups, history text, actions, closure and transaction retries passed')
 console.log('PASS: offline status services and all requested screens at 1440px and 390px')
} finally {fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(results,null,2));await browser.close()}
