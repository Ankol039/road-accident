<?php
/**
 * POST /auth/login.php   (FR-02)  Owner: Juliana
 * Body (JSON): { email, password, device? ("web" or "mobile", default "web") }
 * Returns: { token, user }
 * Administrators log in only on the website (device "web").
 * Public users (reporters) and traffic officers log in only in the Flutter app (device "mobile").
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$in = input();
$email = strtolower((string)str_field($in, 'email'));
$pass  = (string)($in['password'] ?? '');

if ($email === '' || $pass === '') {
    json_error('Enter your email and password', 422);
}

$user = filter_var($email, FILTER_VALIDATE_EMAIL) ? find_user_by_email($email) : null;
if (!$user || !password_verify($pass, (string)($user['password_hash'] ?? ''))) {
    json_error('Wrong email or password', 401);
}
if ($user['status'] !== 'active') {
    json_error('This account is deactivated. Contact the administrator.', 403);
}

// The website is for administrators; the app is for public users and traffic officers
$device = str_field($in, 'device') === 'mobile' ? 'mobile' : 'web';
if ($device !== role_device((string)$user['role'])) {
    json_error($device === 'web'
        ? 'This website is for administrators only. Public users and traffic officers use the RoadReport mobile app.'
        : 'Administrators use the RoadReport website, not the app.', 403);
}

$token = issue_token($user['id'], $device);
audit_log($user, 'user.login', 'user', $user['id'], ['device' => $device]);
json_ok(['token' => $token, 'user' => public_user($user)], 'Logged in');
