<?php
/** GET /auth/me.php   The logged-in user (apps call this on startup to check the saved token). */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

json_ok(public_user(require_auth()));
