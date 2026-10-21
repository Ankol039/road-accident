<?php
require __DIR__ . '/includes/layout.php';
page_head('Summaries and export · RoadReport');
?>
<body>
  <!-- FR-12 summaries and FR-15 export. Owners: Alyana, John -->
  <main id="page" hidden>
    <h1 class="h3 mb-3">Summaries and export</h1>
    <form class="panel d-flex flex-wrap gap-3 align-items-end mb-3 no-print" id="summary-form">
      <div><label class="form-label small mb-1" for="period">Group by</label>
        <select id="period" name="period" class="form-select">
          <option value="daily">Day</option><option value="weekly">Week</option><option value="monthly" selected>Month</option><option value="annual">Year</option>
        </select></div>
      <div><label class="form-label small mb-1" for="scope">Count</label>
        <select id="scope" name="scope" class="form-select">
          <option value="official" selected>Verified accident records</option><option value="all">All public reports</option>
        </select></div>
      <div><label class="form-label small mb-1" for="date_from">From</label><input type="date" id="date_from" name="date_from" class="form-control"></div>
      <div><label class="form-label small mb-1" for="date_to">To</label><input type="date" id="date_to" name="date_to" class="form-control"></div>
      <button class="btn btn-guide" type="submit">Show</button>
      <div class="ms-auto d-flex gap-2 flex-wrap">
        <a class="btn btn-outline-guide" id="sum-csv" href="#">Download CSV</a>
        <a class="btn btn-outline-guide" id="sum-pdf" href="#">Download PDF</a>
        <button type="button" class="btn btn-outline-secondary" id="print">Print</button>
      </div>
    </form>
    <div id="error"></div>
    <section class="panel mb-3">
      <h2 class="h6 mb-0">Accidents per period</h2>
      <p class="small text-secondary" id="range"></p>
      <div class="chart-box"><canvas id="chart" aria-label="Bar chart of accidents per period" role="img"></canvas></div>
    </section>
    <div class="table-responsive panel p-0 mb-4">
      <table class="table table-sm align-middle mb-0">
        <thead><tr><th>Period</th><th class="text-end">Total</th><th class="text-end">With injuries</th><th class="text-end">Fatalities</th>
          <th class="text-end">No injuries</th><th class="text-end">Unknown</th><th class="text-end">Vehicles</th><th class="text-end">Resolved</th>
          <th>Most common type</th><th>Top municipality</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <section class="panel no-print">
      <h2 class="h5">Export the report list (FR-15)</h2>
      <p class="text-secondary mb-2">Every report in the dates above, with location, type, injuries, status, officer and reporter.
        For other filters (status, type, place), use the buttons under the <a href="admin-reports.php">Accident reports</a> table.</p>
      <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="export-official">
        <label class="form-check-label" for="export-official">Verified accident records only</label></div>
      <a class="btn btn-outline-guide" id="all-csv" href="#">Download CSV</a>
      <a class="btn btn-outline-guide" id="all-pdf" href="#">Download PDF</a>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
  <script type="module" src="js-release-20261020b/pages/admin-summaries.js"></script>
</body>
</html>
