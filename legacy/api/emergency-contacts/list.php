<?php
/**
 * GET /emergency-contacts/list.php   Shown on the mobile and web home screens (no login needed).
 * Admins add ?all=1 to include hidden ones.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$all = ($_GET['all'] ?? '') === '1' && (current_user()['role'] ?? '') === 'admin';
$rows = array_filter(fs_query('emergency_contacts'), fn($c) => $all || !empty($c['is_active']));
usort($rows, fn($a, $b) => [(int)($a['sort_order'] ?? 0), $a['name']] <=> [(int)($b['sort_order'] ?? 0), $b['name']]);
json_ok(array_map(fn($c) => [
    'id'         => (int)$c['id'],
    'name'       => $c['name'],
    'phone'      => $c['phone'],
    'category'   => $c['category'] ?? null,
    'sort_order' => (int)($c['sort_order'] ?? 0),
    'is_active'  => (bool)($c['is_active'] ?? true),
], array_values($rows)));
