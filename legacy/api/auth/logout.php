<?php
/** POST /auth/logout.php   (FR-02)  Deletes the token that was sent. */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

require_auth();
fs_delete('sessions', hash('sha256', bearer_token()));
json_ok(null, 'Logged out');
