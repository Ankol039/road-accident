<?php
/**
 * POST /users/save.php   (FR-13)   Owner: Juliana
 * Body (JSON): { id? (omit to create), full_name, email, phone?, role, badge_no?, password? (required when creating), status? }
 *   - role: reporter | admin | officer;  status: active | inactive
 *   - An admin cannot deactivate or demote their own account.
 *   - Deactivating a user logs them out everywhere.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$admin = require_auth(['admin']);
$in = input();
$id = filter_var($in['id'] ?? null, FILTER_VALIDATE_INT) ?: null;
$old = $id ? find_user((int)$id) : null;
if ($id && !$old) {
    json_error('User not found', 404);
}

$f = [];
foreach (['full_name', 'email', 'phone', 'badge_no'] as $k) {
    if (!$old || array_key_exists($k, $in)) {
        $f[$k] = str_field($in, $k);
    }
}
if (isset($f['email'])) {
    $f['email'] = strtolower($f['email']);
} elseif (array_key_exists('email', $f)) {
    $f['email'] = '';
}
foreach (['role', 'status'] as $k) {
    if (!$old || array_key_exists($k, $in)) {
        $f[$k] = str_field($in, $k) ?? ($k === 'status' ? 'active' : null);
    }
}
$pass = (string)($in['password'] ?? '');
if ($pass !== '') {
    $f['password'] = $pass;
}

$errors = validate_user_fields($f, !$old, $old['id'] ?? null);
if (array_key_exists('role', $f) && !in_array($f['role'], USER_ROLES, true)) {
    $errors['role'] = 'Choose reporter, officer or admin';
}
if (array_key_exists('status', $f) && !in_array($f['status'], ['active', 'inactive'], true)) {
    $errors['status'] = 'Choose active or inactive';
}
$finalRole = $f['role'] ?? $old['role'] ?? null;
$finalBadge = array_key_exists('badge_no', $f) ? $f['badge_no'] : ($old['badge_no'] ?? null);
if ($finalRole === 'officer' && empty($finalBadge)) {
    $errors['badge_no'] = 'Officers need a badge number';
}
if ($old && $old['id'] === $admin['id']) {
    if (($f['role'] ?? 'admin') !== 'admin') {
        $errors['role'] = 'You cannot remove your own admin role';
    }
    if (($f['status'] ?? 'active') !== 'active') {
        $errors['status'] = 'You cannot deactivate your own account';
    }
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}
if ($finalRole !== 'officer') {
    $f['badge_no'] = null; // only officers have badge numbers
}

if (!$old) {
    $user = create_user($f);
    audit_log($admin, 'user.create', 'user', $user['id'], ['email' => $user['email'], 'role' => $user['role']]);
    json_ok(admin_user($user), 'User created', 201);
}

$changes = array_filter($f, fn($v, $k) => ($old[$k] ?? null) !== $v || $k === 'password', ARRAY_FILTER_USE_BOTH);
if (!$changes) {
    json_ok(admin_user($old), 'Nothing changed');
}
$user = update_user($old, $changes);
if (($changes['status'] ?? null) === 'inactive' || isset($changes['password']) || isset($changes['role'])) {
    end_sessions($old['id']);
}
$logged = $changes;
unset($logged['password']);
if (isset($changes['password'])) {
    $logged['password'] = 'changed';
}
audit_log($admin, 'user.update', 'user', $old['id'], ['changed' => $logged]);
json_ok(admin_user($user), 'User saved');
