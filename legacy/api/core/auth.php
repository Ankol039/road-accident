<?php
/**
 * Token login (works the same for web and mobile).
 *
 *   Login returns a token. The app saves it and sends it on every request:
 *       Authorization: Bearer <token>
 *
 *   In an endpoint:
 *       $user = require_auth();                    // any logged-in user
 *       $user = require_auth(['admin']);           // admins only
 *       $user = require_auth(['admin', 'officer']);
 *
 * Firestore collections used here:
 *   users/{id}              the account (password stored as a bcrypt hash)
 *   user_emails/{email}     { user_id }  keeps emails unique
 *   sessions/{sha256}       one login; only the SHA-256 hash of the token is stored
 */

const USER_ROLES = ['reporter', 'admin', 'officer'];

/**
 * Where each role logs in:
 *   admin              -> the website ("web")
 *   reporter, officer  -> the Flutter app ("mobile"), each with their own screens and permissions
 */
function role_device(string $role): string
{
    return $role === 'admin' ? 'web' : 'mobile';
}

function email_key(string $email): string
{
    return str_replace('/', '%2F', strtolower(trim($email)));
}

function find_user(int $id): ?array
{
    $u = fs_get('users', $id);
    return $u ? normalize_user($u) : null;
}

function find_user_by_email(string $email): ?array
{
    $link = fs_get('user_emails', email_key($email));
    return $link ? find_user((int)$link['user_id']) : null;
}

function normalize_user(array $u): array
{
    $u['id'] = (int)($u['id'] ?? $u['_id']);
    $u['status'] = $u['status'] ?? 'active';
    return $u;
}

function issue_token(int $userId, ?string $device = null): string
{
    $token = bin2hex(random_bytes(32));
    $days = (int)config('token_days', 7);
    fs_set('sessions', hash('sha256', $token), [
        'user_id'      => $userId,
        'device'       => $device === 'mobile' ? 'mobile' : 'web',
        'created_at'   => now(),
        'expires_at'   => date('Y-m-d H:i:s', strtotime("+$days days")),
        'last_used_at' => now(),
    ]);
    return $token;
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
            }
        }
    }
    if (preg_match('/Bearer\s+([a-f0-9]{64})/i', $header, $m)) {
        return strtolower($m[1]);
    }
    // <img> tags and download links cannot send headers, so they may pass ?token=...
    if (isset($_GET['token']) && is_string($_GET['token']) && preg_match('/^[a-f0-9]{64}$/i', $_GET['token'])) {
        return strtolower($_GET['token']);
    }
    return null;
}

/** The logged-in user, or null. */
function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    $user = null;
    $token = bearer_token();
    if ($token === null) {
        return null;
    }
    $hash = hash('sha256', $token);
    $session = fs_get('sessions', $hash);
    if (!$session || ($session['expires_at'] ?? '') <= now()) {
        return null;
    }
    $u = find_user((int)$session['user_id']);
    // A login made on the wrong side (for example before the admin changed this user's role)
    // stops working: admins use the website, reporters and officers the app.
    if ($u && $u['status'] === 'active' && ($session['device'] ?? 'web') === role_device((string)$u['role'])) {
        // Save "last used" at most every 15 minutes to keep Firestore writes low
        if (($session['last_used_at'] ?? '') < date('Y-m-d H:i:s', time() - 900)) {
            fs_update('sessions', $hash, ['last_used_at' => now()]);
        }
        $user = $u;
    }
    return $user;
}

function require_auth(array $roles = []): array
{
    $user = current_user();
    if ($user === null) {
        json_error('Please log in first', 401);
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        json_error('You do not have permission to do this', 403);
    }
    return $user;
}

/** Fields that are safe to send to the app (never the password hash). */
function public_user(array $u): array
{
    return [
        'id'        => (int)$u['id'],
        'full_name' => $u['full_name'],
        'email'     => $u['email'],
        'phone'     => $u['phone'] ?? null,
        'role'      => $u['role'],
        'badge_no'  => $u['badge_no'] ?? null,
    ];
}

/** Admin view of a user (adds status and dates). */
function admin_user(array $u): array
{
    return public_user($u) + [
        'status'     => $u['status'] ?? 'active',
        'created_at' => $u['created_at'] ?? null,
        'updated_at' => $u['updated_at'] ?? null,
    ];
}

/** Validation shared by register, profile and user management. Returns field errors. */
function validate_user_fields(array $f, bool $needPassword, ?int $currentId = null): array
{
    $errors = [];
    if (array_key_exists('full_name', $f) && ($f['full_name'] === null || mb_strlen($f['full_name']) < 2)) {
        $errors['full_name'] = 'Enter the full name';
    }
    if (array_key_exists('email', $f)) {
        if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email';
        } else {
            $other = find_user_by_email($f['email']);
            if ($other && $other['id'] !== $currentId) {
                $errors['email'] = 'This email is already registered';
            }
        }
    }
    if (($f['phone'] ?? null) !== null && !preg_match('/^(09\d{9}|\+639\d{9})$/', $f['phone'])) {
        $errors['phone'] = 'Use 09XXXXXXXXX or +639XXXXXXXXX';
    }
    $pass = $f['password'] ?? null;
    if ($needPassword || ($pass !== null && $pass !== '')) {
        if (strlen((string)$pass) < 8 || !preg_match('/[A-Za-z]/', (string)$pass) || !preg_match('/\d/', (string)$pass)) {
            $errors['password'] = 'At least 8 characters with letters and numbers';
        } elseif (array_key_exists('password_confirmation', $f) && $pass !== $f['password_confirmation']) {
            $errors['password_confirmation'] = 'Passwords do not match';
        }
    }
    return $errors;
}

/**
 * Create a user. The email link is created in the same commit, so if two people
 * register the same email at the same moment, only one succeeds.
 */
function create_user(array $f): array
{
    $id = fs_next_id('users');
    $email = strtolower($f['email']);
    $user = [
        'id'            => $id,
        'full_name'     => $f['full_name'],
        'email'         => $email,
        'phone'         => $f['phone'] ?? null,
        'password_hash' => password_hash($f['password'], PASSWORD_BCRYPT),
        'role'          => $f['role'] ?? 'reporter',
        'badge_no'      => $f['badge_no'] ?? null,
        'status'        => $f['status'] ?? 'active',
        'created_at'    => now(),
        'updated_at'    => now(),
    ];
    try {
        fs_commit([
            fs_w_create('user_emails', email_key($email), ['user_id' => $id]),
            fs_w_set('users', $id, $user),
        ]);
    } catch (FirestoreException $e) {
        if ($e->status === 'ALREADY_EXISTS' || $e->http === 409) {
            json_error('Please fix the highlighted fields', 422, ['email' => 'This email is already registered']);
        }
        throw $e;
    }
    return $user;
}

/** Change user fields. Handles email changes (moves the email link) and new passwords. */
function update_user(array $old, array $changes): array
{
    $writes = [];
    if (isset($changes['email'])) {
        $changes['email'] = strtolower($changes['email']);
        if ($changes['email'] !== $old['email']) {
            $writes[] = fs_w_create('user_emails', email_key($changes['email']), ['user_id' => $old['id']]);
            $writes[] = fs_w_delete('user_emails', email_key($old['email']));
        }
    }
    if (!empty($changes['password'])) {
        $changes['password_hash'] = password_hash($changes['password'], PASSWORD_BCRYPT);
    }
    unset($changes['password'], $changes['password_confirmation']);
    $changes['updated_at'] = now();
    $writes[] = fs_w_update('users', $old['id'], $changes);
    try {
        fs_commit($writes);
    } catch (FirestoreException $e) {
        if ($e->status === 'ALREADY_EXISTS' || $e->http === 409) {
            json_error('Please fix the highlighted fields', 422, ['email' => 'This email is already registered']);
        }
        throw $e;
    }
    return array_merge($old, $changes);
}

/** Log out every device of a user (after deactivation or a password change). */
function end_sessions(int $userId, ?string $keepHash = null): void
{
    $writes = [];
    foreach (fs_query('sessions', [['user_id', '==', $userId]]) as $s) {
        if ($s['_id'] !== $keepHash) {
            $writes[] = fs_w_delete('sessions', $s['_id']);
        }
    }
    if ($writes) {
        fs_commit($writes);
    }
}

/**
 * Can this user see this report?
 * Reporter: own reports. Officer: reports assigned to them. Admin: all.
 */
function can_view_report(array $user, array $report): bool
{
    return match ($user['role']) {
        'admin'    => true,
        'officer'  => (int)($report['assigned_officer_id'] ?? 0) === (int)$user['id'],
        'reporter' => (int)($report['reporter_id'] ?? 0) === (int)$user['id'],
        default    => false,
    };
}
