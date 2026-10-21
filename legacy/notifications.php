<?php
require __DIR__ . '/includes/layout.php';
page_head('Notifications · RoadReport');
?>
<body>
  <!-- FR-09 notifications. Owner: Jan Russel -->
  <main id="page" hidden>
    <div class="form-page">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h3 mb-0">Notifications</h1>
        <button class="btn btn-sm btn-outline-secondary d-none" id="mark-all">Mark all as read</button>
      </div>
      <ul class="list-plain" id="list"><li class="text-secondary">Loading…</li></ul>
    </div>
  </main>
  <script type="module" src="js-release-20261020b/pages/notifications.js"></script>
</body>
</html>
