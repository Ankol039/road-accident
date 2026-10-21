<?php

use Kreait\Firebase\Factory;

require_once __DIR__ . '/../../vendor/autoload.php';
$firebaseSettings = require __DIR__ . '/../config/config.php';
$serviceAccount = $firebaseSettings['firebase']['credentials'];
if (!is_file($serviceAccount) || !is_readable($serviceAccount)) {
    throw new RuntimeException('Firebase credential is missing or unreadable in the private directory.');
}
$factory = (new Factory)
    ->withServiceAccount($serviceAccount)
    ->withDatabaseUri($firebaseSettings['firebase']['database_uri']);
$firebaseDatabase = $factory->createDatabase();
