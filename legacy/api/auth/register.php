<?php
/**
 * POST /auth/register.php   (FR-01)  Owner: Juliana
 * Body (JSON): { full_name, email, phone, password, password_confirmation, device? }
 * Public sign-up (from the mobile app) always creates a "reporter".
 * Admins create officers/admins on the website (user management).
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$in = input();
$f = [
    'full_name'             => str_field($in, 'full_name'),
    'email'                 => strtolower((string)str_field($in, 'email')),
    'phone'                 => str_field($in, 'phone'),
    'password'              => (string)($in['password'] ?? ''),
    'password_confirmation' => (string)($in['password_confirmation'] ?? ''),
];
$errors = validate_user_fields($f, true);
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$user = create_user($f + ['role' => 'reporter']);
audit_log($user, 'user.register', 'user', $user['id']);

$token = issue_token($user['id'], 'mobile');
json_ok(['token' => $token, 'user' => public_user($user)], 'Account created', 201);
