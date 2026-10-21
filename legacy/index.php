<?php
/**
 * Landing page for the admin portal (Bulacan).
 * Design taken from "RoadReport: Bulacan Admin Portal.html" (kept as reference),
 * rebuilt as a PHP page that reuses includes/layout.php for the <head>.
 * Its stylesheet css/landing.css is loaded after css/app.css and runs in dark theme
 * to match the rest of the admin website. Owner: Jan Russel
 */
require __DIR__ . '/includes/layout.php';
page_head('RoadReport: Bulacan Admin Portal', [], ['css/landing.css']);
?>
<body class="landing-page">
<nav class="nav">
   <a class="brand" href="#"><i></i>RoadReport</a>
   <div><a class="l" href="#process">How it works</a><a class="l" href="#hotspots">Hotspots</a><a class="l" href="#livemap">Live map</a><a class="btn" href="login.php">Log in</a></div>
  </nav>

<div class="track"><header class="hero">
 <div class="wrap" style="width:100%">
 </div>
 <div class="wrap hero-in">
  <span class="eyebrow">Bulacan Admin Portal</span>
  <h1 class="serif">Where Road Safety and Local Response Meet</h1>
  <p class="sub">Know where every crash happens—precisely. Reports from the RoadReport app, verified by administrators and answered by traffic officers across Bulacan.</p>
  <div class="cta"><a class="btn" href="login.php">Log in to the admin portal</a><a class="btn ghost" href="#process">See how it works</a></div>

  <div class="scene" aria-label="Animation of a tricycle and a jeepney colliding, then a report being logged">
   <svg viewBox="0 0 800 300" role="img">
    <line class="road" x1="0" y1="242" x2="800" y2="242" stroke-width="2"/>
    <!-- tricycle (sidecar left, motorcycle right) -->
    <g class="tri"><g transform="translate(236,240)" class="ln">
      <circle cx="38" cy="-20" r="19"/><circle cx="130" cy="-20" r="19"/><circle cx="38" cy="-20" r="5"/><circle cx="130" cy="-20" r="5"/>
      <path d="M6 -28 V-82 Q6 -96 22 -96 H68 Q82 -96 82 -82 V-28 Z"/>
      <path d="M0 -96 H90"/><path d="M16 -82 H72 V-58 H16 Z"/>
      <path d="M82 -50 H104 L118 -78 L134 -84"/><path d="M104 -50 L130 -20"/><path d="M118 -78 L132 -62 L146 -20"/>
    </g></g>
    <!-- jeepney facing left -->
    <g class="jeep"><g transform="translate(386,240)" class="ln">
      <circle cx="48" cy="-20" r="20"/><circle cx="178" cy="-20" r="20"/><circle cx="48" cy="-20" r="5"/><circle cx="178" cy="-20" r="5"/>
      <path d="M0 -34 V-58 L22 -62 L30 -100 Q32 -108 42 -108 H212 Q226 -108 226 -94 V-34 Z"/>
      <path d="M44 -96 H80 V-66 H44 Z"/><path d="M92 -96 H128 V-66 H92 Z"/><path d="M140 -96 H176 V-66 H140 Z"/><path d="M188 -96 H214 V-66 H188 Z"/>
      <path d="M2 -46 H224" stroke="#e4572e"/><path d="M60 -116 H200"/>
    </g></g>
    <circle class="ring" cx="380" cy="185" r="40"/><circle class="ring b" cx="380" cy="185" r="40"/>
    <line class="scan" x1="170" y1="60" x2="630" y2="60"/>
    <g class="tag">
     <line x1="380" y1="150" x2="380" y2="70" stroke="#e4572e" stroke-width="1.5"/>
     <rect x="262" y="20" width="236" height="50" rx="12" fill="#e4572e"/>
     <text x="280" y="42" fill="#fff" font-size="13" font-weight="700">REPORT RECEIVED · GPS LOCKED</text>
     <text x="280" y="60" fill="#fff" font-size="12" opacity=".9">MacArthur Hwy, Meycauayan</text>
    </g>
   </svg>
  </div>
 </div>
 <div class="hint" id="hint">Scroll to discover</div>
</header></div>

<section class="lift">
 <div class="wrap rv">
  <span class="eyebrow">Our vision</span>
  <h2 class="serif">From scattered reports to coordinated response</h2>
  <p class="lead">A tricycle on a barangay road, a jeepney on the highway: every crash deserves a record that is complete, verified and acted on. RoadReport gives Bulacan’s administrators one place to do that.</p>
  <div class="feat">
   <div><b>01</b><h3>Reports straight from the street</h3><p>Public users send details, photos and the GPS location from the RoadReport app for Android.</p></div>
   <div><b>02</b><h3>Verified, not assumed</h3><p>Check new reports, ask for missing details, mark duplicates and confirm against official records.</p></div>
   <div><b>03</b><h3>Assigned to a traffic officer</h3><p>Verified reports go to officers who update the status and add findings in the same mobile app.</p></div>
   <div><b>04</b><h3>Hotspots that show themselves</h3><p>See which towns and highway stretches have the most accidents, built from real reports.</p></div>
   <div><b>05</b><h3>Built for every town in the province</h3><p>Daily to annual summaries with CSV and PDF downloads for councils, offices and agencies.</p></div>
  </div>
 </div>
</section>

<div class="tapes" aria-hidden="true"><div class="tape a"><div class="tt" data-t="⚠ Caution · Accident-prone area"></div></div><div class="tape b"><div class="tt" data-t="Slow down · Report it · Stay alert"></div></div></div>
<section class="band" id="hotspots">
 <div class="wrap split">
  <div class="rv">
   <span class="eyebrow">Real-time road intelligence</span>
   <h2 class="serif">Accident-prone areas, in plain sight</h2>
   <p class="lead">The dashboard turns verified reports into a ranked view of where crashes cluster, so patrols, signage and road fixes go where they matter first.</p>
  </div>
  <div class="dash rv" id="dash">
   <small>Sample data · last 30 days<span class="live">LIVE</span></small>
   <div class="big">Verified reports by town</div>
   <div class="bar"><span>Meycauayan</span><span class="t"><i style="--w:86%"></i></span><span>43</span></div>
   <div class="bar"><span>Marilao</span><span class="t"><i style="--w:68%"></i></span><span>34</span></div>
   <div class="bar"><span>Bocaue</span><span class="t"><i style="--w:56%"></i></span><span>28</span></div>
   <div class="bar"><span>Malolos</span><span class="t"><i style="--w:44%"></i></span><span>22</span></div>
   <div class="bar"><span>San Jose del Monte</span><span class="t"><i style="--w:30%"></i></span><span>15</span></div>
  </div>
 </div>
</section>

<section class="foot" id="footage"><div class="stk"><canvas class="cv"></canvas><div class="fin rv"><span class="eyebrow">Every minute counts</span><h2 class="serif">Every crash deserves a record</h2><div class="stats"><div><b data-n="24">0</b><span>Towns mapped</span></div><div><b data-n="10">0</b><span>Sample reports</span></div><div><b data-n="3">0</b><span>Steps to response</span></div></div></div></div></section>

<div class="mtrack" id="livemap"><div class="mstick">
 <div class="mmap rv"><svg id="msvg" viewBox="0 0 600 525" role="img" aria-label="Map of Bulacan municipalities with accident pins"><g id="mm"><path class="mun" d="M338.7 300.4L308.0 287.6L300.7 293.2L331.3 330.0L338.7 300.4ZM314.6 335.6L315.5 318.2L286.4 291.8L274.2 303.7L247.3 299.6L250.5 332.5L284.2 351.6L303.0 354.0L314.6 335.6Z"><title>Angat</title></path><path class="mun" d="M218.1 411.7L199.8 372.6L192.6 377.4L185.6 426.1L198.5 454.9L218.1 411.7Z"><title>Balagtas</title></path><path class="mun" d="M213.8 286.2L187.1 237.3L147.2 292.5L153.2 324.7L187.3 334.8L184.7 326.4L213.8 286.2Z"><title>Baliuag</title></path><path class="mun" d="M239.6 398.2L218.1 411.7L198.5 454.9L207.1 471.8L213.5 474.5L248.9 453.9L239.6 398.2Z"><title>Bocaue</title></path><path class="mun" d="M185.6 426.1L162.7 420.5L126.5 467.7L136.0 490.9L182.2 524.7L196.0 511.5L193.8 489.3L207.1 471.8L198.5 454.9L185.6 426.1Z"><title>Bulakan</title></path><path class="mun" d="M243.4 292.8L213.8 286.2L184.7 326.4L198.5 353.1L250.5 332.5L247.3 299.6L243.4 292.8Z"><title>Bustos</title></path><path class="mun" d="M105.1 344.6L96.9 311.2L51.0 317.0L43.6 371.5L79.5 375.5L85.8 375.8L107.1 354.4L105.1 344.6Z"><title>Calumpit</title></path><path class="mun" d="M192.6 377.4L152.1 378.7L162.7 420.5L185.6 426.1L192.6 377.4Z"><title>Guiguinto</title></path><path class="mun" d="M79.5 375.5L43.6 371.5L10.1 411.1L0.0 465.0L72.8 469.3L68.6 405.7L79.5 375.5Z"><title>Hagonoy</title></path><path class="mun" d="M107.1 354.4L85.8 375.8L103.5 402.2L105.9 479.7L126.5 467.7L162.7 420.5L152.1 378.7L107.1 354.4Z"><title>Malolos</title></path><path class="mun" d="M296.3 438.4L248.9 453.9L213.5 474.5L231.2 497.7L286.5 455.4L305.7 465.6L309.9 457.1L296.3 438.4Z"><title>Marilao</title></path><path class="mun" d="M305.7 465.6L286.5 455.4L231.2 497.7L213.5 474.5L207.1 471.8L193.8 489.3L217.9 500.1L264.7 501.3L305.7 465.6Z"><title>Meycauayan</title></path><path class="mun" d="M593.2 336.4L448.7 338.9L390.2 309.9L368.5 325.2L338.7 300.4L331.3 330.0L314.6 335.6L303.0 354.0L311.5 393.3L347.6 378.8L434.2 418.1L473.1 423.2L584.1 407.4L593.2 336.4Z"><title>Norzagaray</title></path><path class="mun" d="M217.9 500.1L193.8 489.3L196.0 511.5L217.9 500.1Z"><title>Obando</title></path><path class="mun" d="M284.2 351.6L250.5 332.5L198.5 353.1L199.8 372.6L218.1 411.7L239.6 398.2L284.2 351.6Z"><title>Pandi</title></path><path class="mun" d="M85.8 375.8L79.5 375.5L68.6 405.7L72.8 469.3L105.9 479.7L103.5 402.2L85.8 375.8Z"><title>Paombong</title></path><path class="mun" d="M198.5 353.1L184.7 326.4L187.3 334.8L172.5 352.1L105.1 344.6L107.1 354.4L152.1 378.7L192.6 377.4L199.8 372.6L198.5 353.1Z"><title>Plaridel</title></path><path class="mun" d="M147.2 292.5L96.9 311.2L105.1 344.6L172.5 352.1L187.3 334.8L153.2 324.7L147.2 292.5Z"><title>Pulilan</title></path><path class="mun" d="M347.2 152.2L329.6 140.8L278.5 160.8L234.9 140.0L191.6 184.2L221.6 215.1L271.0 249.4L338.8 245.1L351.8 200.6L347.2 152.2Z"><title>San Ildefonso</title></path><path class="mun" d="M434.2 418.1L347.6 378.8L311.5 393.3L296.3 438.4L309.9 457.1L379.0 467.6L434.2 418.1Z"><title>San Jose del Monte</title></path><path class="mun" d="M389.8 2.4L352.0 0.0L288.6 21.1L271.2 38.8L219.4 48.9L212.7 106.2L234.9 140.0L278.5 160.8L329.6 140.8L347.2 152.2L360.5 56.9L355.7 11.6L389.8 2.4Z"><title>San Miguel</title></path><path class="mun" d="M338.8 245.1L271.0 249.4L221.6 215.1L187.1 237.3L213.8 286.2L243.4 292.8L272.3 298.3L289.2 288.8L300.7 293.2L308.0 287.6L338.8 245.1Z"><title>San Rafael</title></path><path class="mun" d="M284.2 351.6L239.6 398.2L248.9 453.9L296.3 438.4L311.5 393.3L303.0 354.0L284.2 351.6Z"><title>Santa Maria</title></path><path class="mun" d="M593.2 336.4L600.0 255.6L574.4 142.8L565.7 72.4L471.7 45.0L453.0 2.4L389.8 2.4L355.7 11.6L360.5 56.9L347.2 152.2L351.8 200.6L338.8 245.1L308.0 287.6L338.7 300.4L368.5 325.2L390.2 309.9L448.7 338.9L593.2 336.4Z"><title>DRT</title></path></g><text class="bay" x="30" y="325" transform="rotate(-60 30 325)">Manila Bay</text><g id="mpins"></g></svg></div>
 <div class="mside">
  <small>Live map · sample data</small>
  <h2 class="serif">Every report, pinned where it happened</h2>
  <div class="cnt"><b id="mn">0</b><span>of <em id="mtot">0</em> reports plotted</span></div>
  <div class="chips" id="chips"></div>
  <div class="feed" id="feed"></div>
  <div class="mhint">Keep scrolling to log more reports</div>
 </div>
</div></div>

<div class="mq" aria-hidden="true"><div class="mq-t"><span>Reported</span><span class="f">Verified</span><span>Assigned</span><span class="f">Resolved</span></div></div>
<div class="mq" aria-hidden="true"><div class="mq-t"><span class="f">Every town</span><span>Every road</span><span class="f">Every report</span><span>Bulacan</span></div></div>
<div class="nog rv wrap">
 <div class="tl lg" aria-hidden="true"><i class="g"></i><i class="y"></i><i class="r"></i></div>
 <span class="eyebrow">RoadReport solves</span>
 <h2 class="serif">No Lost Reports.<br><em>No Guesswork.</em></h2>
 <p class="lead" style="margin:0 auto">Just verified incidents, delivered with accountability.</p>
</div>

<section id="process" style="padding-top:0">
 <div class="wrap rv">
  <span class="eyebrow">How it works</span>
  <h2 class="serif">Three steps from report to response</h2>
  <div class="steps">
   <div class="card"><span class="lamp r"></span><b>01</b><h3>Review and verify</h3><p>Check new reports, ask for missing details, mark duplicates, verify official records.</p></div>
   <div class="card"><span class="lamp y"></span><b>02</b><h3>Assign and respond</h3><p>Give verified reports to traffic officers, who update the status and add findings.</p></div>
   <div class="card"><span class="lamp g"></span><b>03</b><h3>Monitor and export</h3><p>Dashboard, accident-prone areas, summaries, and CSV and PDF downloads.</p></div>
  </div>
  <div class="note">
   <div class="sos">911</div>
   <p><strong>Saw an accident? Report it with the RoadReport app for Android.</strong> Public users send reports, photos and GPS location there. This website is for administrators only. In an emergency, call 911 first.</p>
  </div>
 </div>
</section>

<div class="tapes one" aria-hidden="true"><div class="tape s"><div class="tt" data-t="Road safety begins with a report · Log in to respond"></div></div></div>
<section class="end"><canvas class="cv"></canvas>
 <div class="wrap">
  <h2 class="serif">Turn Road Reports Into Safer Roads</h2>
  <p>Make real progress with data you can verify, assign, and act on.</p>
  <a class="btn" href="login.php">Log in to the admin portal</a>
 </div>
</section>

<footer><div class="wrap"><span>© RoadReport · Bulacan, Philippines</span><span>Administrator access only</span></div></footer>

<script>
try{
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
 document.querySelectorAll('.rv').forEach(el=>io.observe(el));
}catch(e){document.querySelectorAll('.rv').forEach(el=>el.classList.add('in'))}
</script>
<script>
(()=>{
const tr=document.querySelector('.track'),h=document.getElementById('hint'),T=document.querySelector('.tri'),J=document.querySelector('.jeep'),R=document.querySelectorAll('.ring'),S=document.querySelector('.scan'),G=document.querySelector('.tag'),sc=document.querySelector('.scene'),tx=[...document.querySelector('.hero-in').children].filter(e=>e!==sc);
const c=v=>Math.max(0,Math.min(1,v)),e=t=>1-Math.pow(1-t,3);
function f(){
 const r=tr.getBoundingClientRect(),p=c(-r.top/(r.height-innerHeight));
 const a=e(c(p/.5)),m=c((p-.5)/.06);
 T.style.transform=`translateX(${-460*(1-a)-16*m}px)`;
 J.style.transform=`translateX(${460*(1-a)+12*m}px)`;
 T.style.opacity=J.style.opacity=c(p*8);
 R.forEach((x,i)=>{const k=c((p-.5-i*.04)/.25);x.style.transform=`scale(${.1+k*3.1})`;x.style.opacity=k>0&&k<1?1-k:0});
 const s=c((p-.58)/.3);S.style.transform=`translateY(${s*190}px)`;S.style.opacity=s>0&&s<1?.9:0;
 const g=c((p-.72)/.1);G.style.opacity=g;G.style.transform=`translateY(${(1-g)*10}px)`;
 tx.forEach(x=>{x.style.opacity=1-c(p/.4);x.style.transform=`translateY(${-p*60}px)`});
 sc.style.transform=`scale(${1+p*.12})`;
 h.textContent=p<.5?'Scroll to discover':p<.72?'Impact detected':'Report logged';
}
addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f();
try{
 const fo=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('on',e.isIntersecting)),{rootMargin:'-42% 0px -42% 0px'});
 document.querySelectorAll('.feat div').forEach(d=>fo.observe(d));
 let n=0;
 const sp=el=>[...el.childNodes].forEach(x=>{
  if(x.nodeType==3){const fr=document.createDocumentFragment();x.textContent.split(/(\s+)/).forEach(w=>{if(!w.trim()){fr.append(' ');return}const s=document.createElement('span');s.className='w';s.style.setProperty('--i',n++);s.textContent=w;fr.append(s)});x.replaceWith(fr)}
  else if(x.nodeType==1&&x.tagName!='BR')sp(x)});
 const wo=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');wo.unobserve(e.target)}}),{threshold:.2});
 document.querySelectorAll('h1,h2').forEach(x=>{n=0;sp(x);wo.observe(x)});
}catch(err){}
})();
</script>
<script>
(()=>{
const G={"x0": 120.68703221300007, "y1": 15.268369465000033, "k": 0.9663760793213293, "S": 939.5481923313982, "H": 525},NS='http://www.w3.org/2000/svg';
const X=g=>(g-G.x0)*G.k*G.S,Y=a=>(G.y1-a)*G.S;
const el=(t,a,p)=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);p&&p.appendChild(n);return n};
const SV={Fatal:'#e4572e',Serious:'#f2a93b',Slight:'#5fb7a5'};
const R=[
['Meycauayan','MacArthur Hwy',14.7366,120.9606,'Tricycle vs. jeepney','Fatal','Assigned','07:42'],
['DRT','DRT Highway',15.0660,121.1673,'Truck rollover','Serious','New','08:10'],
['Hagonoy','Hagonoy–Malolos Rd',14.8314,120.7427,'Tricycle rollover','Slight','New','09:05'],
['Norzagaray','Norzagaray–Angat Rd',14.8892,121.1458,'Motorcycle collision','Fatal','Verified','10:20'],
['San Miguel','Maharlika Hwy',15.1962,121.0284,'Bus sideswipe','Slight','Resolved','11:30'],
['San Jose del Monte','Quirino Hwy',14.8166,121.0824,'Hit and run','Serious','Assigned','12:45'],
['Calumpit','MacArthur Hwy',14.8966,120.7798,'Truck vs. motorcycle','Fatal','Verified','14:02'],
['Baliuag','Maharlika Hwy',14.9509,120.8895,'Skid on wet road','Slight','Resolved','15:18'],
['Malolos','Paseo del Congreso',14.8382,120.8179,'Pedestrian struck','Serious','New','16:40'],
['San Ildefonso','San Ildefonso–Baliuag Rd',15.0725,121.0078,'Car vs. tricycle','Slight','Verified','17:55']
].map((r,i)=>({id:'RR-'+(2401+i),town:r[0],road:r[1],lat:r[2],lng:r[3],type:r[4],sv:r[5],st:r[6],t:r[7]}));
const N=R.length,pg=document.getElementById('mpins');
R.forEach(r=>{const o=el('g',{transform:`translate(${X(r.lng).toFixed(1)} ${Y(r.lat).toFixed(1)})`},pg),g=el('g',{class:'pin'},o);r.g=g;
 for(let k=0;k<5;k++){const c=el('circle',{class:'sw',r:6,stroke:SV[r.sv],fill:SV[r.sv]},g);c.style.animationDelay=(k*.7)+'s'};
 el('circle',{r:6,fill:SV[r.sv],stroke:'#0e1214','stroke-width':2},g);el('title',{},g).textContent=`${r.id} · ${r.type} · ${r.town}`});
document.getElementById('mtot').textContent=N;
const off=new Set(),ch=document.getElementById('chips');let last=-1;
Object.keys(SV).forEach(k=>{const b=document.createElement('button');b.className='chip';b.style.setProperty('--c',SV[k]);b.innerHTML=`<i></i>${k}`;b.onclick=()=>{off.has(k)?off.delete(k):off.add(k);b.classList.toggle('x');last=-1;up()};ch.appendChild(b)});
const tr=document.getElementById('livemap'),feed=document.getElementById('feed'),mn=document.getElementById('mn');
function up(){const rc=tr.getBoundingClientRect(),p=Math.max(0,Math.min(1,-rc.top/(rc.height-innerHeight))),n=Math.min(N,Math.ceil(p*1.1*N));
 if(n===last)return;last=n;let c=0;
 R.forEach((r,i)=>{const on=i<n&&!off.has(r.sv);r.g.classList.toggle('show',on);r.g.classList.toggle('off',off.has(r.sv));r.g.classList.toggle('new',i===n-1&&on);if(on)c++});
 mn.textContent=c;
 const v=R.slice(0,n).filter(r=>!off.has(r.sv)).slice(-3).reverse();
 feed.innerHTML=v.map(r=>`<div class="rep" style="--c:${SV[r.sv]}"><span class="st">${r.sv} · ${r.st}</span><b>${r.id} · ${r.type}</b><p>${r.road}, ${r.town} · ${r.t}</p></div>`).join('')||'<div class="rep"><p>Scroll to start logging reports…</p></div>'}
addEventListener('scroll',up,{passive:true});addEventListener('resize',()=>{last=-1;up()});up();
})();
</script>
<script>
(()=>{
const nv=document.querySelector('.nav');let ly=0;
addEventListener('scroll',()=>{const y=scrollY;nv.classList.toggle('solid',y>60);ly=y},{passive:true});
function trails(cv){const x=cv.getContext('2d'),P=[];let W,H,run=false;
 const rs=()=>{W=cv.width=Math.min(1100,cv.clientWidth);H=cv.height=Math.round(W*cv.clientHeight/cv.clientWidth)||600};rs();addEventListener('resize',rs);
 for(let i=0;i<46;i++)P.push({x:Math.random(),l:Math.random(),s:.002+Math.random()*.006,r:Math.random()<.5,w:.5+Math.random()*1.6});
 function f(){if(!run)return;x.fillStyle='rgba(14,18,20,.2)';x.fillRect(0,0,W,H);const hy=H*.46;
  x.strokeStyle='rgba(243,239,230,.06)';for(let i=-6;i<=6;i++){x.beginPath();x.moveTo(W/2+i*8,hy);x.lineTo(W/2+i*W*.16,H);x.stroke()}
  P.forEach(p=>{p.x+=p.s*(p.r?-1:1);if(p.x>1.1)p.x=-.1;if(p.x<-.1)p.x=1.1;const z=p.l,y=hy+z*z*(H-hy)*.95+4,len=30+z*140,px=p.x*W,c=p.r?'228,87,46':'243,239,230';
   const g=x.createLinearGradient(px-len*(p.r?-1:1),0,px,0);g.addColorStop(0,`rgba(${c},0)`);g.addColorStop(1,`rgba(${c},${.35+z*.6})`);x.strokeStyle=g;x.lineWidth=p.w*(.6+z*2.4);x.beginPath();x.moveTo(px-len*(p.r?-1:1),y);x.lineTo(px,y);x.stroke()});
  requestAnimationFrame(f)}
 new IntersectionObserver(e=>{const v=e[0].isIntersecting;if(v&&!run){run=true;f()}else if(!v)run=false}).observe(cv)}
document.querySelectorAll('.cv').forEach(trails);
const ft=document.getElementById('footage'),cv=ft.querySelector('.cv'),bs=ft.querySelectorAll('b');
let done=0;new IntersectionObserver(e=>{if(e[0].isIntersecting&&!done){done=1;bs.forEach(b=>{const n=+b.dataset.n,t0=performance.now();(function u(t){const k=Math.min(1,(t-t0)/1800);b.textContent=Math.round(n*(1-Math.pow(1-k,3)));k<1&&requestAnimationFrame(u)})(t0)})}},{threshold:.5}).observe(ft);
addEventListener('scroll',()=>{const r=ft.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/(r.height-innerHeight)));cv.style.transform=`scale(${1+p*.18})`},{passive:true});
})();
</script>

<script>
(()=>{
const c=v=>Math.max(0,Math.min(1,v)),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const sp=document.createElement('div');sp.className='sp';document.body.prepend(sp);
const feat=$('.feat'),dash=$('#dash'),mq=$$('.mq-t');
const split=dash.parentNode;
split.insertAdjacentHTML('beforeend','<div class="fchip a rv"><b>+12%</b>faster verification vs last week</div><div class="fchip b rv"><i></i>New report · Marilao</div>');
mq.forEach(m=>m.innerHTML=m.innerHTML.repeat(4));
$$('.bar').forEach((b,i)=>b.style.setProperty('--d',(i*.12)+'s'));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
$$('.fchip').forEach(x=>io.observe(x));
new IntersectionObserver((e,o)=>{if(!e[0].isIntersecting)return;o.disconnect();
 $$('.bar').forEach((b,i)=>{const n=b.lastElementChild,v=+n.textContent,t0=performance.now()+i*120+300;
  (function u(t){const k=c((t-t0)/1500);n.textContent=Math.round(v*(1-Math.pow(1-k,3)));k<1&&requestAnimationFrame(u)})(t0)})
},{threshold:.4}).observe(dash);
function f(){
 const h=document.documentElement.scrollHeight-innerHeight;sp.style.transform=`scaleX(${h>0?scrollY/h:0})`;
 const r=feat.getBoundingClientRect();feat.style.setProperty('--p',c((innerHeight*.58-r.top)/r.height));

}
addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f();
$$('.card').forEach(k=>k.addEventListener('pointermove',e=>{const r=k.getBoundingClientRect();k.style.setProperty('--mx',e.clientX-r.left+'px');k.style.setProperty('--my',e.clientY-r.top+'px')}));

})();
</script>
<script>
document.querySelectorAll('.tt').forEach(t=>{t.innerHTML=Array(16).fill('<span>'+t.dataset.t+'</span>').join('')});
try{const to=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');to.unobserve(e.target)}}),{threshold:.3});document.querySelectorAll('.tapes').forEach(x=>to.observe(x))}catch(e){document.querySelectorAll('.tapes').forEach(x=>x.classList.add('in'))}
</script>
<script>
/* JS-driven so it keeps running even when the device has reduced-motion on */
(()=>{
const M=[...document.querySelectorAll('.mq-t')],t0=performance.now();
M.forEach(m=>m.style.animation='none');
(function loop(t){M.forEach((m,i)=>{const w=m.scrollWidth/4,d=((t-t0)/1000*(w/26))%w;m.style.transform=`translateX(${i?d-w:-d}px)`});requestAnimationFrame(loop)})(t0);
const L=[...document.querySelectorAll('.tl i')],C=['#3ccf7a','#f5c518','#ff4a3d'];let k=0;
const tick=()=>{L.forEach((l,i)=>{const on=i===k;l.style.animation='none';l.style.background=on?C[i]:'#2a3236';l.style.boxShadow=on?`0 0 22px 4px ${C[i]}`:'none'});k=(k+1)%3};
tick();setInterval(tick,2000);
const B=document.querySelector('.brand i');if(B){B.style.animation='none';(function s(t){B.style.transform=`rotate(${(t/9000%1)*360}deg)`;requestAnimationFrame(s)})(0)}
})();
</script>
</body>
</html>
