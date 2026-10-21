<?php
require __DIR__ . '/includes/layout.php';
page_head('RoadReport: admin portal');
?>
<body>
  <!-- Admin portal landing page. Owner: Jan Russel -->
  <div class="landing">
    <header class="container d-flex justify-content-between align-items-center py-3">
      <?= brand(true) . PHP_EOL ?>
      <a href="login.php" class="btn btn-sm btn-outline-light">Log in</a>
    </header>
    <section class="container landing-hero">
      <p class="text-uppercase small fw-semibold text-white-50 mb-2">Administrators</p>
      <h1>Road accident reports for Bulacan, in one place.</h1>
      <p class="lead">Review reports sent from the RoadReport mobile app, verify them, assign traffic officers,
        and see where accidents happen most.</p>
      <div class="d-flex flex-wrap gap-3 mt-4">
        <a href="login.php" class="btn btn-report btn-lg">Log in to the admin portal</a>
      </div>
    </section>
    <div class="lane-line" aria-hidden="true"></div>
    <section class="landing-steps">
      <div class="container">
        <ol class="steps">
          <li><h2 class="h6">Review and verify</h2><p>Check new reports, ask for missing details, mark duplicates, verify official records.</p></li>
          <li><h2 class="h6">Assign and respond</h2><p>Give verified reports to traffic officers, who update the status and add findings in the mobile app.</p></li>
          <li><h2 class="h6">Monitor and export</h2><p>Dashboard, accident-prone areas, daily to annual summaries, CSV and PDF downloads.</p></li>
        </ol>
        <div class="panel mt-5">
          <h2 class="h6 mb-1">Saw an accident? Report it with the mobile app.</h2>
          <p class="text-secondary mb-0">Public users send reports, photos and the GPS location with the
            <strong>RoadReport app for Android</strong>. Traffic officers handle their assigned reports in the same app.
            This website is for administrators only. In an emergency, call 911 first.</p>
        </div>
      </div>
    </section>
  </div>
  <script type="module" src="js-release-20261020b/pages/landing.js"></script>
</body>
</html>
