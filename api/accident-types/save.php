<?php
/**
 * POST /accident-types/save.php   (Admin: manage accident categories)   Owner: Juliana
 * Body (JSON): { id? (omit to create), name, description?, is_active? }
 * Types are never deleted (old reports use them): set is_active = false to hide one from the form.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$id = filter_var($in['id'] ?? null, FILTER_VALIDATE_INT) ?: null;
$name = str_field($in, 'name');
$types = accident_types_map();
$old = $id ? ($types[$id] ?? null) : null;
if ($id && !$old) {
    json_error('Category not found', 404);
}

$errors = [];
if ($name === null || mb_strlen($name) < 3 || mb_strlen($name) > 60) {
    $errors['name'] = 'Enter a name (3 to 60 characters)';
} else {
    foreach ($types as $t) {
        if ($t['id'] !== $id && mb_strtolower($t['name']) === mb_strtolower($name)) {
            $errors['name'] = 'A category with this name already exists';
        }
    }
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$id = $id ?? fs_next_id('accident_types');
$type = [
    'id'          => $id,
    'name'        => $name,
    'description' => mb_substr((string)str_field($in, 'description'), 0, 255) ?: null,
    'is_active'   => array_key_exists('is_active', $in) ? filter_var($in['is_active'], FILTER_VALIDATE_BOOLEAN) : ($old['is_active'] ?? true),
    'updated_at'  => now(),
];
fs_commit([
    fs_w_set('accident_types', $id, $type + ['created_at' => $old['created_at'] ?? now()]),
    audit_write($user, 'type.save', 'accident_type', $id, ['name' => $name, 'is_active' => $type['is_active'], 'new' => $old === null]),
]);
json_ok($type, $old ? 'Category saved' : 'Category added', $old ? 200 : 201);
