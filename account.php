<?php
require __DIR__ . '/includes/layout.php';
page_head('My account · RoadReport');
?>
<body>
  <!-- Account settings for administrators -->
  <main id="page" hidden>
    <div class="form-page">
      <h1 class="h3 mb-1">My account</h1>
      <p class="text-secondary" id="role"></p>
      <div class="row g-4">
        <div class="col-md-7">
          <form class="panel" id="profile-form" novalidate>
            <h2 class="h5">Profile</h2>
            <div class="mb-3"><label class="form-label" for="full_name">Full name</label>
              <input id="full_name" name="full_name" class="form-control" autocomplete="name"></div>
            <div class="mb-3"><label class="form-label" for="email">Email</label>
              <input id="email" name="email" type="email" class="form-control" autocomplete="email"></div>
            <div class="mb-3" id="email-password" hidden><label class="form-label" for="current_password">Current password (needed to change the email)</label>
              <input id="current_password" name="current_password" type="password" class="form-control" autocomplete="current-password"></div>
            <div class="mb-3"><label class="form-label" for="phone">Mobile number</label>
              <input id="phone" name="phone" type="tel" class="form-control" placeholder="09XXXXXXXXX" autocomplete="tel"></div>
            <button class="btn btn-guide" type="submit">Save profile</button>
          </form>
        </div>
        <div class="col-md-5">
          <form class="panel" id="password-form" novalidate>
            <h2 class="h5">Change password</h2>
            <div class="mb-3"><label class="form-label" for="pw-current">Current password</label>
              <input id="pw-current" name="current_password" type="password" class="form-control" autocomplete="current-password"></div>
            <div class="mb-3"><label class="form-label" for="pw-new">New password</label>
              <input id="pw-new" name="password" type="password" class="form-control" autocomplete="new-password"></div>
            <div class="mb-3"><label class="form-label" for="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" name="password_confirmation" type="password" class="form-control" autocomplete="new-password"></div>
            <button class="btn btn-guide" type="submit">Change password</button>
          </form>
        </div>
      </div>
    </div>
  </main>
  <script type="module" src="js-release-20261020b/pages/account.js"></script>
</body>
</html>
