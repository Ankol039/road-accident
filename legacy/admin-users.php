<?php
require __DIR__ . '/includes/layout.php';
page_head('Users · RoadReport');
?>
<body>
  <!-- FR-13 user management. Owner: Alyana -->
  <main id="page" hidden>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h3 mb-0">Users</h1>
      <button class="btn btn-guide" id="add-user">Add a user</button>
    </div>
    <form class="filter-bar" id="filters" role="search">
      <input type="search" name="q" class="form-control" placeholder="Search name, email or badge" aria-label="Search users">
      <select name="role" class="form-select" aria-label="Role"><option value="">All roles</option><option value="admin">Administrators</option>
        <option value="officer">Traffic officers</option><option value="reporter">Public users</option></select>
      <select name="status" class="form-select" aria-label="Status"><option value="">Active and inactive</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <button class="btn btn-outline-secondary">Search</button>
    </form>
    <div class="table-responsive panel p-0">
      <table class="table align-middle mb-0">
        <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="d-flex justify-content-between align-items-center mt-3" id="pager"></div>

    <div class="modal fade" id="user-modal" tabindex="-1" aria-labelledby="user-modal-title" aria-hidden="true">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h2 class="modal-title h5" id="user-modal-title">Add a user</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
          <form id="user-form" novalidate>
            <div id="form-alert"></div>
            <input type="hidden" name="id">
            <div class="mb-3"><label class="form-label" for="u-name">Full name</label><input id="u-name" name="full_name" class="form-control"></div>
            <div class="mb-3"><label class="form-label" for="u-email">Email</label><input id="u-email" name="email" type="email" class="form-control"></div>
            <div class="mb-3"><label class="form-label" for="u-phone">Mobile number (optional)</label><input id="u-phone" name="phone" class="form-control" placeholder="09XXXXXXXXX"></div>
            <div class="row g-3 mb-3">
              <div class="col-6"><label class="form-label" for="u-role">Role</label>
                <select id="u-role" name="role" class="form-select"><option value="officer">Traffic officer</option><option value="admin">Administrator</option><option value="reporter">Public user</option></select></div>
              <div class="col-6"><label class="form-label" for="u-status">Status</label>
                <select id="u-status" name="status" class="form-select"><option value="active">Active</option><option value="inactive">Inactive (cannot log in)</option></select></div>
            </div>
            <p class="small text-secondary">Traffic officers and public users log in with the mobile app. Administrators log in on this website.</p>
            <p class="small text-secondary" id="self-note" hidden>You cannot change your own role or deactivate yourself.</p>
            <div class="mb-3" id="badge-row"><label class="form-label" for="u-badge">Badge number</label><input id="u-badge" name="badge_no" class="form-control" placeholder="TO-0045"></div>
            <div class="mb-1"><label class="form-label" for="u-pass" id="password-label">Password</label>
              <input id="u-pass" name="password" type="password" class="form-control" autocomplete="new-password">
              <div class="form-text">At least 8 characters with letters and numbers. Give it to the person privately.</div></div>
          </form>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-guide" id="save-user">Save</button></div>
      </div></div>
    </div>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script type="module" src="js-release-20261020b/pages/admin-users.js"></script>
</body>
</html>
