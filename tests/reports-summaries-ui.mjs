/** Offline visual and interaction check for Reports and Summaries. All Firebase traffic and writes are blocked. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

const base = process.env.APP_BASE || 'http://127.0.0.1:5179'
const origin = new URL(base).origin
const output = path.resolve('output/reports-summaries-ui')
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
  userDataDir: path.resolve('tmp/reports-summaries-ui/browser-profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const results = { widths: [], runtimeErrors: [], consoleErrors: [], contrast: [], states: [] }
try {
  const page = await browser.newPage()
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__profile = { id:'offline-admin', full_name:'Portal Administrator', role:'admin', status:'active' }
    window.__fixtures = Array.from({length: 30}, (_, i) => ({
      id:'fixture-'+i, report_code:'RA-2026-'+String(i+1).padStart(6,'0'),
      accident_date:'2026-'+String(1+i%10).padStart(2,'0')+'-15', accident_time:'10:30',
      municipality:['Malolos','Baliwag','Meycauayan','Marilao','Bulakan','Bocaue'][i%6], barangay:'Centro',
      location_text:'Provincial road near the public market', accident_type_name:i%2 ? 'Collision' : 'Single vehicle',
      accident_type_id:'collision', injury_status:i%3 ? 'none':'slight', vehicles:[{type:'Car',quantity:1}],
      status:['verified','resolved','in_progress','info_required','under_review','on_scene','submitted','assigned','rejected','duplicate'][i%10],
      flagged:i%3===0, officer_name: 'Test Officer', status_history:[], description:'Offline fixture',
    }))
    window.__queryLog=[]; window.__mode='normal'; window.__queryDelay=80
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url=new URL(req.url())
    if(['blob:','data:'].includes(url.protocol))return req.continue()
    if(url.origin!==origin){
      if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) return req.continue()
      return req.abort()
    }
    const respond=body=>req.respond({status:200,contentType:'application/javascript',body})
    if(url.pathname==='/src/hooks/useAuth.jsx')return respond(`
      export const AuthProvider=({children})=>children;
      export const useAuth=()=>({user:{uid:'offline-admin'},profile:window.__profile,loading:false,signOut:async()=>{}});
      export const useActor=()=>({uid:'offline-admin',role:'admin'});
    `)
    if(url.pathname==='/src/lib/firebase.js')return respond(`export const auth={}, db={}, apiKey='offline-fixture', isFirebaseConfigured=true;`)
    if(url.pathname==='/src/lib/firestore.js')return respond(firestoreMock)
    return req.continue()
  })
  page.on('pageerror',e=>results.runtimeErrors.push(e.message))
  page.on('console',msg=>{if(msg.type()==='error')results.consoleErrors.push(msg.text())})
  const loaded=()=>page.waitForFunction(()=>!document.querySelector('.page-loading'))
  const overflow=async(screen,width)=>{
    const dims=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
    results.widths.push({screen,...dims});assert.ok(dims.html<=width+1&&dims.body<=width+1,JSON.stringify({screen,...dims}))
  }
  const compare=async(screen,width)=>{
    const appFile=path.join(output,`${screen}-${width}.png`)
    await page.screenshot({path:appFile,fullPage:true})
    const mock=await browser.newPage()
    await mock.setViewport({width,height:1000})
    await mock.goto(base+`/html-mockups/_screens/${screen}/index.html`)
    await mock.evaluate(()=>document.fonts.ready)
    const mockFile=path.join(output,`${screen}-mockup-${width}.png`)
    await mock.screenshot({path:mockFile,fullPage:true})
    const a=PNG.sync.read(fs.readFileSync(appFile)),b=PNG.sync.read(fs.readFileSync(mockFile))
    const joined=new PNG({width:width*2,height:Math.max(a.height,b.height),fill:true});joined.data.fill(14)
    PNG.bitblt(a,joined,0,0,a.width,a.height,0,0);PNG.bitblt(b,joined,0,0,b.width,b.height,width,0)
    fs.writeFileSync(path.join(output,`${screen}-comparison-${width}.png`),PNG.sync.write(joined))
    await mock.close()
  }
  for(const screen of ['reports','summaries']){
    for(const width of [320,360,390,414,768,1024,1440]){
      await page.setViewport({width,height:1000});await page.goto(base+`/admin/${screen}`);await loaded();await page.evaluate(()=>document.fonts.ready)
      await overflow(screen,width)
      if(screen==='reports'){
        assert.equal(await page.$eval('tr.clickable',el=>getComputedStyle(el).display),width<768?'grid':'table-row')
        if(width<768){
          const overlaps=await page.$$eval('tr.clickable',rows=>rows.flatMap(row=>{const a=row.querySelector('a').getBoundingClientRect(),b=row.querySelector('.status-badge').getBoundingClientRect();return a.right>b.left+1&&a.top<b.bottom&&b.top<a.bottom?[row.innerText]:[]}))
          assert.deepEqual(overlaps,[],'Report ID and status must not overlap')
        }
        if(width>=768)assert.equal(await page.$eval('tr.clickable td:nth-child(3)',el=>getComputedStyle(el).minWidth),'300px')
        if(width<420){
          const positions=await page.$$eval('.filter-bar :is(.form-control,.form-select,.form-check,.btn)',els=>els.map(el=>el.getBoundingClientRect().top))
          assert.equal(new Set(positions).size,positions.length,'One filter control per row below 420px')
        }
      } else {
        assert.equal(await page.$eval('.rr-summaries-table td:first-child',el=>getComputedStyle(el).position),'sticky')
        const pinned=await page.$eval('.rr-summaries-table',el=>{const first=el.querySelector('td');const before=first.getBoundingClientRect().left;el.scrollLeft=240;const after=first.getBoundingClientRect().left;el.scrollLeft=0;return {before,after,background:getComputedStyle(first).backgroundColor}})
        assert.equal(pinned.before,pinned.after);assert.equal(pinned.background,'rgb(22, 28, 31)')
        if(width<768)assert.ok(await page.$eval('.rr-summaries-chart-scroll',el=>el.scrollWidth>el.clientWidth))
        if(width<=1024)assert.ok(await page.$eval('.rr-summaries-table',el=>el.scrollWidth>el.clientWidth))
      }
      if([1440,390].includes(width))await compare(screen,width)
      console.log(`PASS: ${screen} ${width}px`)
    }
    // Keyboard focus and both loading and empty/error fixtures use the real page components.
    await page.keyboard.press('Tab');await page.focus(screen==='reports'?'input[type="search"]':'#period')
    assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid')
    const selector=screen==='reports'?'.rr-reports-actions button':'.rr-summaries-actions button'
    const contrast=await page.evaluate(selector=>{
      const rgb=c=>(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number)
      const lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
      const checks=[['cream','rgb(236,232,223)','rgb(27,34,38)',4.5],['muted','rgb(141,151,155)','rgb(27,34,38)',4.5],['eyebrow','rgb(228,87,46)','rgb(18,24,27)',4.5],['link','rgb(240,106,65)','rgb(40,31,29)',4.5],['input boundary','rgb(102,113,118)','rgb(27,34,38)',3],['focus','rgb(245,197,24)','rgb(27,34,38)',3]]
      const button=getComputedStyle(document.querySelector('form button[type="submit"]'));checks.push(['submit',button.color,button.backgroundColor,4.5])
      const outline=getComputedStyle(document.querySelector(selector));checks.push(['outline button',outline.color,'rgb(27,34,38)',4.5])
      return checks.map(([name,fg,bg,min])=>({name,ratio:ratio(fg,bg),min}))
    },selector)
    for(const c of contrast)assert.ok(c.ratio>=c.min,JSON.stringify(c));results.contrast.push({screen,checks:contrast})
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
    assert.equal(await page.$eval(selector,el=>getComputedStyle(el).transitionDuration),'0s')
    if(screen==='summaries'){
      const chart=await page.evaluate(async()=>{const {Chart}=await import('/node_modules/.vite/deps/chart__js.js');const c=Chart.getChart(document.querySelector('canvas'));return{animation:c.options.animation,ticks:c.options.scales.x.ticks.color,grid:c.options.scales.y.grid.color,bar:c.data.datasets[0].backgroundColor}})
      assert.deepEqual(chart,{animation:false,ticks:'#8d979b',grid:'rgba(236,232,223,.09)',bar:'#e4572e'});results.chart=chart
    }
    await page.emulateMediaFeatures([])
    // Check rendered text, including translucent status and toggle surfaces.
    const textContrast=await page.evaluate(screen=>{
      const parse=c=>{const a=(c.match(/[\d.]+/g)||[]).map(Number);return a.length>2?[a[0],a[1],a[2],a[3]??1]:[0,0,0,0]}
      const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3])).concat(1)
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
      const failures=[];let checked=0
      for(const el of document.querySelectorAll(`.rr-${screen}-page *`)){
        if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!el.getClientRects().length||el.closest(':disabled,option,script,style,.print-only'))continue
        const style=getComputedStyle(el);if(style.visibility==='hidden')continue
        const ancestors=[];for(let p=el;p;p=p.parentElement)ancestors.unshift(p)
        let bg=[14,18,20,1]
        for(const p of ancestors){const s=getComputedStyle(p);bg=blend(parse(s.backgroundColor),bg);const hex=s.backgroundImage.match(/#[0-9a-f]{6}/i);if(hex){const h=hex[0];bg=[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),1]}}
        const fg=blend(parse(style.color),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
        const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);const min=large?3:4.5
        checked++;if(ratio<min)failures.push({text:el.textContent.trim().slice(0,65),ratio,min})
      }
      return {checked,failures}
    },screen)
    results.contrast.push({screen,renderedText:textContrast});assert.deepEqual(textContrast.failures,[])
    const reload=async()=>{
      if(screen==='reports')await page.click('.filter-bar .form-check input')
      else await page.click('#export-official')
    }
    await page.evaluate(()=>{window.__queryDelay=1000});await reload();await page.waitForSelector('.rr-state[role="status"]');results.states.push(screen+' loading');await loaded()
    await page.evaluate(()=>{window.__queryDelay=20;window.__mode='empty'});await reload();await page.waitForSelector('.rr-state-empty');results.states.push(screen+' empty')
    await page.setViewport({width:320,height:1000});await overflow(screen+' empty',320)
    await page.screenshot({path:path.join(output,`${screen}-empty-320.png`),fullPage:true})
    await page.evaluate(()=>{window.__mode='normal';window.__loadError=true});await reload();await page.waitForSelector('.rr-state-error');results.states.push(screen+' error')
    await page.screenshot({path:path.join(output,`${screen}-error-320.png`),fullPage:true})
  }
  // Exercise both Reports pills and Clear without replacing the production handlers.
  await page.goto(base+'/admin/reports');await loaded()
  for(const label of [0,1]){
    await page.click(`.filter-bar .form-check:nth-of-type(${label+1}) input`);await loaded()
    assert.equal(await page.$eval(`.filter-bar .form-check:nth-of-type(${label+1}) input`,el=>el.checked),true)
    assert.equal(await page.$eval(`.filter-bar .form-check:nth-of-type(${label+1})`,el=>getComputedStyle(el).borderColor),'rgb(228, 87, 46)')
  }
  await page.click('.filter-bar button[type="button"]');await loaded()
  assert.ok(await page.$$eval('.filter-bar input[type="checkbox"]',els=>els.every(el=>!el.checked)))
  assert.deepEqual(results.runtimeErrors,[]);assert.deepEqual(results.consoleErrors,[])
  console.log('PASS: seven widths, focus, AA palette, reduced motion, pills, Clear, states and no console errors')
} finally {
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(results,null,2))
  await browser.close()
}
