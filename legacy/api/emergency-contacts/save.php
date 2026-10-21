<?php
/**
 * POST /emergency-contacts/save.php   (Admin: system settings)
 * Body (JSON): { id? (omit to create), name, phone, category?, sort_order?, is_active?, delete? }
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$id = filter_var($in['id'] ?? null, FILTER_VALIDATE_INT) ?: null;
$old = $id ? fs_get('emergency_contacts', $id) : null;
if ($id && !$old) {
    json_error('Contact not found', 404);
}

if ($old && filter_var($in['delete'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
    fs_commit([
        fs_w_delete('emergency_contacts', $id),
        audit_write($user, 'contact.save', 'emergency_contact', $id, ['deleted' => $old['name']]),
    ]);
    json_ok(null, 'Contact removed');
}

$name = str_field($in, 'name');
$phone = str_field($in, 'phone');
$errors = [];
if ($name === null || mb_strlen($name) < 2) {
    $errors['name'] = 'Enter the name';
}
if ($phone === null || !preg_match('/^[0-9+()\- ]{3,20}$/', $phone)) {
    $errors['phone'] = 'Enter a phone number (digits, +, -, spaces)';
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$id = $id ?? fs_next_id('emergency_contacts');
$contact = [
    'id'         => $id,
    'name'       => mb_substr($name, 0, 100),
    'phone'      => $phone,
    'category'   => mb_substr((string)str_field($in, 'category'), 0, 40) ?: null,
    'sort_order' => (int)($in['sort_order'] ?? ($old['sort_order'] ?? 0)),
    'is_active'  => array_key_exists('is_active', $in) ? filter_var($in['is_active'], FILTER_VALIDATE_BOOLEAN) : ($old['is_active'] ?? true),
];
fs_commit([
    fs_w_set('emergency_contacts', $id, $contact),
    audit_write($user, 'contact.save', 'emergency_contact', $id, ['name' => $contact['name'], 'new' => $old === null]),
]);
json_ok($contact, 'Contact saved', $old ? 200 : 201);
