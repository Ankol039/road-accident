<?php
require __DIR__ . '/includes/layout.php';
page_head('Categories and settings · RoadReport');
?>
<body>
  <!-- Accident categories, emergency contacts, system settings. Owner: Alyana -->
  <main id="page" hidden>
    <h1 class="h3 mb-3">Categories and settings</h1>
    <div id="error"></div>
    <div class="row g-4">
      <div class="col-xl-7">
        <section class="panel">
          <h2 class="h5">Accident categories</h2>
          <p class="small text-secondary">Categories that reports already use cannot be deleted. Hide them instead: they disappear from the report form but old reports keep them.</p>
          <div class="table-responsive"><table class="table align-middle">
            <thead><tr><th>Category</th><th class="text-end">Reports</th><th>Form</th><th></th></tr></thead><tbody id="types"></tbody></table></div>
          <form id="type-form" class="row g-2 align-items-end" novalidate>
            <input type="hidden" name="id">
            <div class="col-sm-4"><label class="form-label small mb-1" for="t-name">Name</label><input id="t-name" name="name" class="form-control"></div>
            <div class="col-sm-5"><label class="form-label small mb-1" for="t-desc">Description</label><input id="t-desc" name="description" class="form-control"></div>
            <div class="col-sm-3 d-flex gap-1"><button class="btn btn-guide flex-grow-1" id="type-submit" type="submit">Add category</button>
              <button type="button" class="btn btn-link px-1" id="type-cancel" hidden>Cancel</button></div>
          </form>
        </section>
      </div>
      <div class="col-xl-5">
        <form class="panel" id="settings-form" novalidate>
          <h2 class="h5">System settings</h2>
          <div id="settings-alert"></div>
          <div class="mb-3"><label class="form-label" for="s-name">System name</label><input id="s-name" name="system_name" class="form-control"></div>
          <div class="mb-3"><label class="form-label" for="s-photos">Photos allowed per report (all sections)</label><input id="s-photos" name="max_photos_per_report" type="number" min="3" max="15" class="form-control">
            <div class="form-text">Sections: scene, plate number, damage (required), people affected, other. Up to 3 per section.</div></div>
          <fieldset><legend class="form-label fs-6 mb-1">Duplicate rule (FR-08)</legend>
            <p class="small text-secondary mb-2">Nearby reports with the same accident type and close incident times are flagged as possible duplicates. An admin reviews and confirms them; they are not automatically closed.</p>
            <div class="mb-3"><label for="s-window" class="form-label">Incident time window (minutes)</label><input id="s-window" name="duplicate_window_minutes" type="number" min="1" max="1440" class="form-control"></div>
            <div class="mb-3"><label class="form-label small mb-1" for="s-radius">Duplicate radius (meters)</label>
              <input id="s-radius" name="duplicate_radius_m" type="number" min="1" max="500" step="1" class="form-control">
              <div class="form-text">Phone GPS is often 5 to 20 m off, so some real duplicates may be farther apart. You can still flag those by hand.</div></div>
          </fieldset>
          <fieldset><legend class="form-label fs-6 mb-1">Officer arrival check</legend>
            <p class="small text-secondary mb-2">When the officer taps "I've arrived", the locations match if he is this close to the
              reporter's pin. GPS supports the review. If the pins differ or accuracy is uncertain, record supporting evidence to approve or ask for another arrival.</p>
            <div class="mb-3"><label class="form-label small mb-1" for="s-match">Match distance (meters)</label>
              <input id="s-match" name="arrival_match_radius_m" type="number" min="5" max="500" step="1" class="form-control"></div>
          </fieldset>
          <button class="btn btn-guide" type="submit">Save settings</button>
        </form>
      </div>
      <div class="col-12">
        <section class="panel">
          <h2 class="h5">Emergency contacts</h2>
          <p class="small text-secondary">Shown on the home screen of the mobile app. Add your local MDRRMO, PNP station and hospitals.</p>
          <div class="table-responsive"><table class="table align-middle">
            <thead><tr><th>Order</th><th>Name</th><th>Phone</th><th>Shown</th><th></th></tr></thead><tbody id="contacts"></tbody></table></div>
          <form id="contact-form" class="row g-2 align-items-end" novalidate>
            <input type="hidden" name="id">
            <div class="col-md-3"><label class="form-label small mb-1" for="c-name">Name</label><input id="c-name" name="name" class="form-control"></div>
            <div class="col-md-2"><label class="form-label small mb-1" for="c-phone">Phone</label><input id="c-phone" name="phone" class="form-control"></div>
            <div class="col-md-2"><label class="form-label small mb-1" for="c-cat">Category</label><input id="c-cat" name="category" class="form-control" list="c-cats">
              <datalist id="c-cats"><option value="Emergency"><option value="Police"><option value="Rescue"><option value="Medical"><option value="Fire"></datalist></div>
            <div class="col-md-1"><label class="form-label small mb-1" for="c-order">Order</label><input id="c-order" name="sort_order" type="number" class="form-control" value="0"></div>
            <div class="col-md-1"><div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="c-active" name="is_active" checked><label class="form-check-label small" for="c-active">Shown</label></div></div>
            <div class="col-md-3 d-flex gap-1"><button class="btn btn-guide flex-grow-1" id="contact-submit" type="submit">Add contact</button>
              <button type="button" class="btn btn-link px-1" id="contact-cancel" hidden>Cancel</button></div>
          </form>
        </section>
      </div>
    </div>
  </main>
  <script type="module" src="js-release-20261020b/pages/admin-settings.js"></script>
</body>
</html>
