<?php
/**
 * Photo evidence (FR-05). Photos are stored inside Firestore (collection report_photos),
 * because Firebase Storage needs the paid plan. A Firestore document can hold at most 1 MB,
 * so every photo is turned into a JPEG of at most 1280 px and about 900 KB.
 */

/**
 * Photo sections (the reporter takes each kind of proof separately; the admin website shows them separately).
 * Upload field for a section: photos_<key>[]   e.g. photos_scene[], photos_plate[]
 * Optional camera/gallery note per file: sources_<key> = "camera,gallery,..." in the same order as the files.
 * The old field photos[] still works and goes to "other".
 */
const PHOTO_CATEGORIES = [
    'scene'  => ['label' => 'Overall accident scene', 'required' => true, 'sensitive' => false,
                 'hint' => 'Stand back and take the whole scene: the vehicles, the road and nearby landmarks.'],
    'plate'  => ['label' => 'Vehicle plate number(s)', 'required' => true, 'sensitive' => false,
                 'hint' => 'One clear photo for each vehicle plate involved.'],
    'damage' => ['label' => 'Collision or damage area', 'required' => true, 'sensitive' => false,
                 'hint' => 'Where the vehicles hit each other, or the damaged part.'],
    'people' => ['label' => 'People affected (injuries or casualties)', 'required' => false, 'sensitive' => true,
                 'hint' => 'Optional. Help the injured and call 911 first.',
                 'privacy_note' => 'Optional and sensitive. Only take these if it is safe and respectful. They are seen only by '
                     . 'the administrator and the assigned traffic officer, are never shown to the public, and are '
                     . 'not included in exports.'],
    'other'  => ['label' => 'Other proof', 'required' => false, 'sensitive' => false,
                 'hint' => 'Anything else that helps: road signs, skid marks, traffic lights.'],
];

/** Most photos per section. */
const PHOTOS_PER_SECTION = 3;

/** The sections as the apps receive them (form options and report details). */
function photo_categories_public(): array
{
    $out = [];
    foreach (PHOTO_CATEGORIES as $key => $c) {
        $out[] = ['key' => $key, 'max' => PHOTOS_PER_SECTION] + $c + ['privacy_note' => null];
    }
    return $out;
}

/**
 * Read the uploaded photos of every section. Returns [photos, errors].
 * Each photo: ['tmp', 'name', 'mime', 'category', 'source' (camera|gallery|null)]
 * $existing: photo info already on the report (counts toward the limits).
 * $requireSections: true when reporting (scene, plate and damage must have a photo).
 */
function read_uploaded_photos(array $existing = [], bool $requireSections = false): array
{
    $maxTotal = (int)app_setting('max_photos_per_report');
    $maxBytes = (int)config('uploads.max_mb', 10) * 1024 * 1024;
    $allowed = config('uploads.allowed_mime');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $have = [];
    foreach ($existing as $p) {
        $c = $p['category'] ?? 'other';
        $have[$c] = ($have[$c] ?? 0) + 1;
    }

    $photos = [];
    $errors = [];
    $fields = ['photos' => 'other'];
    foreach (array_keys(PHOTO_CATEGORIES) as $key) {
        $fields["photos_$key"] = $key;
    }
    foreach ($fields as $field => $category) {
        if (empty($_FILES[$field])) {
            continue;
        }
        $f = $_FILES[$field];
        $count = is_array($f['name']) ? count($f['name']) : 1;
        $sourceKey = $field === 'photos' ? 'sources' : 'sources_' . $category;
        $sources = array_map('trim', explode(',', (string)($_POST[$sourceKey] ?? '')));
        $errKey = $field === 'photos' ? 'photos_other' : $field;
        for ($i = 0; $i < $count; $i++) {
            $err  = is_array($f['error']) ? $f['error'][$i] : $f['error'];
            $tmp  = is_array($f['tmp_name']) ? $f['tmp_name'][$i] : $f['tmp_name'];
            $name = (string)(is_array($f['name']) ? $f['name'][$i] : $f['name']);
            $size = (int)(is_array($f['size']) ? $f['size'][$i] : $f['size']);
            if ($err === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
                $errors[$errKey] = "$name is too large for the server";
                continue;
            }
            if ($err !== UPLOAD_ERR_OK) {
                $errors[$errKey] = "Upload failed for $name";
                continue;
            }
            $mime = $finfo->file($tmp) ?: '';
            if (!isset($allowed[$mime])) {
                $errors[$errKey] = "$name is not a JPG, PNG or WEBP image";
                continue;
            }
            if ($size > $maxBytes) {
                $errors[$errKey] = "$name is larger than " . config('uploads.max_mb') . ' MB';
                continue;
            }
            $source = $sources[$i] ?? '';
            $photos[] = [
                'tmp' => $tmp, 'name' => mb_substr($name, 0, 120), 'mime' => $mime, 'category' => $category,
                'source' => in_array($source, ['camera', 'gallery'], true) ? $source : null,
            ];
            $have[$category] = ($have[$category] ?? 0) + 1;
        }
    }

    foreach (PHOTO_CATEGORIES as $key => $c) {
        if (($have[$key] ?? 0) > PHOTOS_PER_SECTION) {
            $errors["photos_$key"] = 'At most ' . PHOTOS_PER_SECTION . ' photos for "' . $c['label'] . '"';
        }
        if ($requireSections && $c['required'] && empty($have[$key]) && !isset($errors["photos_$key"])) {
            $errors["photos_$key"] = 'Take a photo of the ' . mb_strtolower($c['label']);
        }
    }
    if (array_sum($have) > $maxTotal) {
        $errors['photos'] = "Attach at most $maxTotal photos per report";
    }
    return [$errors ? [] : $photos, $errors];
}

/**
 * Shrink one photo to a JPEG that fits in a Firestore document.
 * @return array{data:string, mime:string, width:int, height:int}
 */
function compress_photo(string $path, string $mime): array
{
    $limit = (int)config('uploads.max_store_kb', 900) * 1024;

    if (!function_exists('imagecreatetruecolor')) {
        // No GD extension: keep the original if it is already small enough
        $data = (string)file_get_contents($path);
        if (strlen($data) > $limit) {
            throw new RuntimeException('The GD extension is off, so large photos cannot be shrunk. Enable extension=gd in php.ini.');
        }
        return ['data' => $data, 'mime' => $mime, 'width' => 0, 'height' => 0];
    }

    $dimensions = @getimagesize($path);
    if (!$dimensions || $dimensions[0] * $dimensions[1] > 40000000) {
        throw new RuntimeException('Photo resolution is too large or invalid. Use an image under 40 megapixels.');
    }

    $src = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($path),
        'image/png'  => @imagecreatefrompng($path),
        'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
        default      => false,
    };
    if (!$src) {
        throw new RuntimeException('One of the photos could not be read. Try another photo.');
    }

    // Phones save the camera rotation in EXIF; apply it so photos are upright
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($path);
        $angle = [3 => 180, 6 => -90, 8 => 90][(int)($exif['Orientation'] ?? 1)] ?? 0;
        if ($angle !== 0) {
            $rotated = imagerotate($src, $angle, 0);
            if ($rotated) {
                imagedestroy($src);
                $src = $rotated;
            }
        }
    }

    $w = imagesx($src);
    $h = imagesy($src);
    $maxSide = (int)config('uploads.max_side_px', 1280);
    $quality = (int)config('uploads.jpeg_quality', 72);

    for ($attempt = 0; $attempt < 6; $attempt++) {
        $scale = min(1, $maxSide / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        // White background for transparent PNG/WEBP
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        ob_start();
        imagejpeg($dst, null, $quality);
        $data = (string)ob_get_clean();
        imagedestroy($dst);
        if (strlen($data) <= $limit) {
            imagedestroy($src);
            return ['data' => $data, 'mime' => 'image/jpeg', 'width' => $nw, 'height' => $nh];
        }
        // Still too big: smaller and a little lower quality, then try again
        $maxSide = (int)($maxSide * 0.8);
        $quality = max(45, $quality - 8);
    }
    imagedestroy($src);
    throw new RuntimeException('A photo is too detailed to store. Try a smaller photo.');
}

/**
 * Compress and prepare Firestore writes for new photos of a report.
 * @return array{0: array, 1: array} [list of writes, list of photo info for the report document]
 */
function photo_writes(int $reportId, array $photos, int $uploadedBy): array
{
    $writes = [];
    $info = [];
    $images = array_map(fn($p) => compress_photo($p['tmp'], $p['mime']), $photos);
    $ids = fs_next_ids('report_photos', count($photos));
    foreach ($photos as $i => $p) {
        $img = $images[$i];
        $pid = $ids[$i];
        $writes[] = fs_w_set('report_photos', $pid, [
            'id'          => $pid,
            'report_id'   => $reportId,
            'category'    => $p['category'] ?? 'other',
            'source'      => $p['source'] ?? null,
            'name'        => $p['name'],
            'mime_type'   => $img['mime'],
            'size_bytes'  => strlen($img['data']),
            'width'       => $img['width'],
            'height'      => $img['height'],
            'uploaded_by' => $uploadedBy,
            'uploaded_at' => now(),
            'data'        => new FsBytes($img['data']),
        ]);
        $info[] = ['id' => $pid, 'name' => $p['name'], 'category' => $p['category'] ?? 'other', 'source' => $p['source'] ?? null];
    }
    return [$writes, $info];
}

/**
 * Save photo documents in several commits, so one request never passes Firestore's 10 MB limit
 * (photos are up to ~900 KB each, about 1.2 MB once encoded). Call it BEFORE the report commit.
 * If the report commit then fails, delete_photo_docs() removes them again.
 */
function save_photo_docs(array $photoWrites): void
{
    $batch = [];
    $bytes = 0;
    foreach ($photoWrites as $w) {
        $size = strlen((string)json_encode($w));
        if ($batch && $bytes + $size > 7 * 1024 * 1024) {
            fs_commit($batch);
            $batch = [];
            $bytes = 0;
        }
        $batch[] = $w;
        $bytes += $size;
    }
    if ($batch) {
        fs_commit($batch);
    }
}

function delete_photo_docs(array $photoInfo): void
{
    if ($photoInfo) {
        try {
            fs_commit(array_map(fn($p) => fs_w_delete('report_photos', $p['id']), $photoInfo));
        } catch (Throwable $e) {
            // leftover photo documents are harmless: no report points to them
        }
    }
}
