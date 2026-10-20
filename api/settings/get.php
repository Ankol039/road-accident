<?php
/** GET /settings/get.php   System settings (anyone: the apps read system_name and max_photos_per_report). */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

json_ok(app_settings());
