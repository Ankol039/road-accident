<?php
require __DIR__ . '/includes/layout.php';
page_head('Dashboard · RoadReport', ['leaflet']);
?>
<body>
  <!-- FR-10 admin dashboard. Owner: Alyana -->
  <main id="page" hidden>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
      <h1 class="h3 mb-0">Dashboard</h1>
      <form class="d-flex flex-wrap gap-2 align-items-end" id="range-form" aria-label="Date range for the charts">
        <div><label class="form-label small mb-0" for="from">Accidents from</label><input type="date" id="from" class="form-control form-control-sm"></div>
        <div><label class="form-label small mb-0" for="to">to</label><input type="date" id="to" class="form-control form-control-sm"></div>
        <button class="btn btn-sm btn-guide">Apply</button>
        <button type="button" class="btn btn-sm btn-link" id="range-clear">All dates</button>
      </form>
    </div>
    <div id="error"></div>
    <div class="stat-grid" id="cards"></div>
    <p class="small text-secondary mt-2" id="official-note"></p>

    <div class="row g-4 mt-1">
      <div class="col-xl-7"><section class="panel h-100"><h2 class="h6">Verified accidents per month (last 12 months)</h2>
        <div class="chart-box"><canvas id="chart-month" aria-label="Line chart of verified accidents per month" role="img"></canvas></div><div id="num-month"></div></section></div>
      <div class="col-xl-5"><section class="panel h-100"><h2 class="h6">Accident types (verified)</h2>
        <div class="chart-box"><canvas id="chart-type" aria-label="Bar chart of accident types" role="img"></canvas></div><div id="num-type"></div></section></div>
    </div>

    <div class="row g-4 mt-1">
      <div class="col-xl-8"><section class="panel h-100">
        <div class="d-flex justify-content-between align-items-baseline flex-wrap gap-2"><h2 class="h6 mb-2">Accident locations</h2>
          <span class="small text-secondary"><span class="legend-dot" style="background:#0f6b4c"></span>Verified record
            <span class="legend-dot ms-2" style="background:#8a9197"></span>Not yet verified · <span id="map-count"></span></span></div>
        <div class="map-box" id="points-map" style="height:380px"></div></section></div>
      <div class="col-xl-4"><section class="panel h-100"><h2 class="h6">Accident-prone areas (verified)</h2>
        <ol class="list-plain mb-0" id="hotspots"></ol></section></div>
    </div>

    <div class="row g-4 mt-1">
      <div class="col-xl-6"><section class="panel h-100"><h2 class="h6">Municipalities with the most accidents</h2>
        <div class="chart-box"><canvas id="chart-town" aria-label="Bar chart by municipality" role="img"></canvas></div><div id="num-town"></div></section></div>
      <div class="col-xl-6"><section class="panel h-100"><h2 class="h6">Time of day (verified)</h2>
        <div class="chart-box"><canvas id="chart-hour" aria-label="Bar chart by hour of the day" role="img"></canvas></div><div id="num-hour"></div></section></div>
    </div>

    <div class="row g-4 mt-1">
      <div class="col-xl-5"><section class="panel h-100"><h2 class="h6">Reports by status (all reports)</h2>
        <div class="chart-box"><canvas id="chart-status" aria-label="Bar chart of report statuses" role="img"></canvas></div><div id="num-status"></div></section></div>
      <div class="col-xl-7"><section class="panel h-100 p-0"><div class="d-flex justify-content-between align-items-baseline p-3 pb-0">
        <h2 class="h6">Newest reports</h2><a href="admin-reports.php" class="small">All reports</a></div>
        <div class="table-responsive"><table class="table table-hover align-middle mb-0">
          <thead><tr><th>Report ID</th><th>Date</th><th>Location</th><th>Type</th><th>Status</th></tr></thead>
          <tbody id="recent"></tbody></table></div></section></div>
    </div>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
  <script type="module" src="js-release-20261020b/pages/admin.js"></script>
</body>
</html>
