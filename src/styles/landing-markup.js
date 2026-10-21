/**
 * Static landing-page assets extracted verbatim from index.php.
 * Generated file - edit carefully.
 */

/* Landing markup minus the live-map section (LandingMap.jsx renders it). */
export const LANDING_HTML = `<nav class="nav">
   <a class="brand" href="#"><i></i>RoadReport</a>
   <div><a class="l" href="#process">How it works</a><a class="l" href="#hotspots">Hotspots</a><a class="l" href="#livemap">Live map</a><a class="btn" href="/login">Log in</a></div>
  </nav>

<div class="track"><header class="hero">
 <div class="wrap" style="width:100%">
 </div>
 <div class="wrap hero-in">
  <span class="eyebrow">Bulacan Admin Portal</span>
  <h1 class="serif">Where Road Safety and Local Response Meet</h1>
  <p class="sub">Know where every crash happens—precisely. Reports from the RoadReport app, verified by administrators and answered by traffic officers across Bulacan.</p>
  <div class="cta"><a class="btn" href="/login">Log in to the admin portal</a><a class="btn ghost" href="#process">See how it works</a></div>

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

<!-- livemap rendered by <LandingMap/> -->
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
  <a class="btn" href="/login">Log in to the admin portal</a>
 </div>
</section>

<footer><div class="wrap"><span>© RoadReport · Bulacan, Philippines</span><span>Administrator access only</span></div></footer>`

/* Bulacan municipality <path> elements for the live map. */
export const BULACAN_PATHS = `<path class="mun" d="M338.7 300.4L308.0 287.6L300.7 293.2L331.3 330.0L338.7 300.4ZM314.6 335.6L315.5 318.2L286.4 291.8L274.2 303.7L247.3 299.6L250.5 332.5L284.2 351.6L303.0 354.0L314.6 335.6Z"><title>Angat</title></path><path class="mun" d="M218.1 411.7L199.8 372.6L192.6 377.4L185.6 426.1L198.5 454.9L218.1 411.7Z"><title>Balagtas</title></path><path class="mun" d="M213.8 286.2L187.1 237.3L147.2 292.5L153.2 324.7L187.3 334.8L184.7 326.4L213.8 286.2Z"><title>Baliuag</title></path><path class="mun" d="M239.6 398.2L218.1 411.7L198.5 454.9L207.1 471.8L213.5 474.5L248.9 453.9L239.6 398.2Z"><title>Bocaue</title></path><path class="mun" d="M185.6 426.1L162.7 420.5L126.5 467.7L136.0 490.9L182.2 524.7L196.0 511.5L193.8 489.3L207.1 471.8L198.5 454.9L185.6 426.1Z"><title>Bulakan</title></path><path class="mun" d="M243.4 292.8L213.8 286.2L184.7 326.4L198.5 353.1L250.5 332.5L247.3 299.6L243.4 292.8Z"><title>Bustos</title></path><path class="mun" d="M105.1 344.6L96.9 311.2L51.0 317.0L43.6 371.5L79.5 375.5L85.8 375.8L107.1 354.4L105.1 344.6Z"><title>Calumpit</title></path><path class="mun" d="M192.6 377.4L152.1 378.7L162.7 420.5L185.6 426.1L192.6 377.4Z"><title>Guiguinto</title></path><path class="mun" d="M79.5 375.5L43.6 371.5L10.1 411.1L0.0 465.0L72.8 469.3L68.6 405.7L79.5 375.5Z"><title>Hagonoy</title></path><path class="mun" d="M107.1 354.4L85.8 375.8L103.5 402.2L105.9 479.7L126.5 467.7L162.7 420.5L152.1 378.7L107.1 354.4Z"><title>Malolos</title></path><path class="mun" d="M296.3 438.4L248.9 453.9L213.5 474.5L231.2 497.7L286.5 455.4L305.7 465.6L309.9 457.1L296.3 438.4Z"><title>Marilao</title></path><path class="mun" d="M305.7 465.6L286.5 455.4L231.2 497.7L213.5 474.5L207.1 471.8L193.8 489.3L217.9 500.1L264.7 501.3L305.7 465.6Z"><title>Meycauayan</title></path><path class="mun" d="M593.2 336.4L448.7 338.9L390.2 309.9L368.5 325.2L338.7 300.4L331.3 330.0L314.6 335.6L303.0 354.0L311.5 393.3L347.6 378.8L434.2 418.1L473.1 423.2L584.1 407.4L593.2 336.4Z"><title>Norzagaray</title></path><path class="mun" d="M217.9 500.1L193.8 489.3L196.0 511.5L217.9 500.1Z"><title>Obando</title></path><path class="mun" d="M284.2 351.6L250.5 332.5L198.5 353.1L199.8 372.6L218.1 411.7L239.6 398.2L284.2 351.6Z"><title>Pandi</title></path><path class="mun" d="M85.8 375.8L79.5 375.5L68.6 405.7L72.8 469.3L105.9 479.7L103.5 402.2L85.8 375.8Z"><title>Paombong</title></path><path class="mun" d="M198.5 353.1L184.7 326.4L187.3 334.8L172.5 352.1L105.1 344.6L107.1 354.4L152.1 378.7L192.6 377.4L199.8 372.6L198.5 353.1Z"><title>Plaridel</title></path><path class="mun" d="M147.2 292.5L96.9 311.2L105.1 344.6L172.5 352.1L187.3 334.8L153.2 324.7L147.2 292.5Z"><title>Pulilan</title></path><path class="mun" d="M347.2 152.2L329.6 140.8L278.5 160.8L234.9 140.0L191.6 184.2L221.6 215.1L271.0 249.4L338.8 245.1L351.8 200.6L347.2 152.2Z"><title>San Ildefonso</title></path><path class="mun" d="M434.2 418.1L347.6 378.8L311.5 393.3L296.3 438.4L309.9 457.1L379.0 467.6L434.2 418.1Z"><title>San Jose del Monte</title></path><path class="mun" d="M389.8 2.4L352.0 0.0L288.6 21.1L271.2 38.8L219.4 48.9L212.7 106.2L234.9 140.0L278.5 160.8L329.6 140.8L347.2 152.2L360.5 56.9L355.7 11.6L389.8 2.4Z"><title>San Miguel</title></path><path class="mun" d="M338.8 245.1L271.0 249.4L221.6 215.1L187.1 237.3L213.8 286.2L243.4 292.8L272.3 298.3L289.2 288.8L300.7 293.2L308.0 287.6L338.8 245.1Z"><title>San Rafael</title></path><path class="mun" d="M284.2 351.6L239.6 398.2L248.9 453.9L296.3 438.4L311.5 393.3L303.0 354.0L284.2 351.6Z"><title>Santa Maria</title></path><path class="mun" d="M593.2 336.4L600.0 255.6L574.4 142.8L565.7 72.4L471.7 45.0L453.0 2.4L389.8 2.4L355.7 11.6L360.5 56.9L347.2 152.2L351.8 200.6L338.8 245.1L308.0 287.6L338.7 300.4L368.5 325.2L390.2 309.9L448.7 338.9L593.2 336.4Z"><title>DRT</title></path>`

export default LANDING_HTML
