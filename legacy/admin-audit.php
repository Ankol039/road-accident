<?php
require __DIR__ . '/includes/layout.php';
page_head('Audit trail · RoadReport');
?>
<body>
  <!-- FR-14 audit trail. Owner: Alyana -->
  <main id="page" hidden>
    <h1 class="h3 mb-3">Audit trail</h1>
    <form class="filter-bar" id="audit-form" role="search">
      <input type="search" name="q" class="form-control" placeholder="Search name or details" aria-label="Search">
      <select name="action" class="form-select" aria-label="Action"><option value="">All actions</option></select>
      <input type="date" name="date_from" class="form-control" aria-label="From">
      <input type="date" name="date_to" class="form-control" aria-label="To">
      <button class="btn btn-guide">Search</button>
    </form>
    <div class="table-responsive panel p-0">
      <table class="table align-middle mb-0">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="d-flex justify-content-between align-items-center mt-3" id="pager"></div>
  </main>
  <script type="module" src="js-release-20261020b/pages/admin-audit.js"></script>
</body>
</html>
