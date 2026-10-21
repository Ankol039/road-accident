<?php
/**
 * POST /auth/update-profile.php   Any logged-in user edits their own account.
 * Body (JSON): { full_name?, email?, phone?, current_password?, password?, password_confirmation? }
 *   - Changing the email or the password needs current_password.
 *   - A new password logs out the user's other devices.
 * Returns the updated user.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth();
$in = input();

$changes = [];
if (array_key_exists('full_name', $in)) {
    $changes['full_name'] = str_field($in, 'full_name');
}
if (array_key_exists('email', $in)) {
    $email = strtolower((string)str_field($in, 'email'));
    if ($email !== $user['email']) {
        $changes['email'] = $email;
    }
}
if (array_key_exists('phone', $in)) {
    $changes['phone'] = str_field($in, 'phone');
}
$newPass = (string)($in['password'] ?? '');
if ($newPass !== '') {
    $changes['password'] = $newPass;
    $changes['password_confirmation'] = (string)($in['password_confirmation'] ?? '');
}

$errors = validate_user_fields($changes, false, $user['id']);
if ((isset($changes['email']) || $newPass !== '')
    && !password_verify((string)($in['current_password'] ?? ''), (string)$user['password_hash'])) {
    $errors['current_password'] = 'Enter your current password to change your email or password';
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}
if (!$changes) {
    json_ok(public_user($user), 'Nothing changed');
}

$updated = update_user($user, $changes);
if ($newPass !== '') {
    end_sessions($user['id'], hash('sha256', bearer_token()));
}
audit_log($user, 'user.profile', 'user', $user['id'], ['changed' => array_values(array_diff(array_keys($changes), ['password_confirmation']))]);
json_ok(public_user($updated), 'Profile saved');
