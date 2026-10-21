<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['password'])) {
    header('Location: login.php', true, 303);
    exit;
}
header('Cache-Control: no-store');
require __DIR__ . '/includes/layout.php';
page_head('Log in · RoadReport');
?>
<body>
  <!-- FR-02 administrator login. Owner: Jan Russel -->
  <div class="auth-page">
    <form class="auth-card" id="login-form" method="post" action="login.php" novalidate>
      <a href="index.php" class="text-decoration-none d-inline-block mb-3"><?= brand() ?></a>
      <h1 class="h4 mb-1">Administrator log in</h1>
      <p class="small text-secondary mb-3">For RoadReport administrators only.</p>
      <div id="message"></div>
      <div class="mb-3">
        <label class="form-label" for="email">Email</label>
        <input id="email" name="email" type="email" class="form-control" autocomplete="email" required>
      </div>
      <div class="mb-3">
        <label class="form-label" for="password">Password</label>
        <input id="password" name="password" type="password" class="form-control" autocomplete="current-password" required>
      </div>
      <button class="btn btn-guide w-100" type="submit">Log in</button>
      <p class="small text-secondary mt-3 mb-0">Public users and traffic officers: use the RoadReport mobile app.
        Officer accounts are created by the administrator.</p>
    </form>
  </div>
  <script type="module" src="js-release-20261020b/pages/login.js"></script>
</body>
</html>
