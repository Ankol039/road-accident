<?php
require __DIR__ . '/includes/layout.php';
page_head('Report · RoadReport', ['leaflet']);
?>
<body>
  <!-- Report details for administrators. Owner: Alyana (admin dashboard) -->
  <main id="page" hidden>
    <div class="detail-page" id="report"><p class="text-secondary">Loading…</p></div>

    <div class="modal fade" id="edit-modal" tabindex="-1" aria-labelledby="edit-title" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header"><h2 class="modal-title h5" id="edit-title">Edit report details</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body"><form id="edit-form" novalidate></form></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-guide" id="edit-save">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script type="module" src="js-release-20261020b/pages/report.js"></script>
</body>
</html>
