<?php
/**
 * GET /photos/view.php?id=5&token=...   (FR-05 evidence viewer)
 * Sends the image only to people allowed to see the report.
 * Photos are stored inside Firestore (collection report_photos, field "data").
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth();
$id = int_query('id');
$photo = $id ? fs_get('report_photos', $id) : null;
$report = $photo ? find_report((int)$photo['report_id']) : null;
if (!$photo || !$report || !can_view_report($user, $report) || !($photo['data'] ?? null) instanceof FsBytes) {
    json_error('Photo not found', 404);
}

if (!empty(PHOTO_CATEGORIES[$photo['category'] ?? 'other']['sensitive']) && !in_array($user['role'], ['admin', 'officer'], true)) {
    json_error('Photo not found', 404);
}

$etag = '"photo-' . $id . '-' . ($photo['size_bytes'] ?? 0) . '"';
// Photos of injured people are not kept in the browser cache
$sensitive = PHOTO_CATEGORIES[$photo['category'] ?? 'other']['sensitive'] ?? false;
header($sensitive ? 'Cache-Control: private, no-store' : 'Cache-Control: private, max-age=86400');
header('ETag: ' . $etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
$bytes = $photo['data']->data;
header('Content-Type: ' . ($photo['mime_type'] ?? 'image/jpeg'));
header('Content-Length: ' . strlen($bytes));
header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $report['report_code'] . '-' . $id . '.jpg') . '"');
echo $bytes;
