<?php
/**
 * Firestore (Firebase database) helper. Owner: Juliana + Alyana
 *
 * The PHP API is the only thing that talks to Firestore. It logs in with the
 * Firebase service account key (api/config/firebase-service-account.json) and
 * calls the Firestore REST API with cURL. No Composer, no gRPC extension, so it
 * runs on XAMPP, InfinityFree and Hostinger.
 *
 * Reading:
 *     $user  = fs_get('users', 4);                       // one document, or null
 *     $rows  = fs_query('reports', [['status', '==', 'submitted']]);
 *     $all   = fs_query('reports');                       // whole collection
 *
 * Writing (every write goes through one atomic "commit"):
 *     fs_set('users', 4, [...all fields...]);             // create or replace
 *     fs_update('reports', 12, ['status' => 'verified']); // change some fields (must exist)
 *     fs_create('user_emails', $email, [...]);            // fails if it already exists
 *     fs_delete('sessions', $hash);
 *     $id = fs_next_id('reports');                        // 1, 2, 3 ... (auto increment)
 *
 *     // Several writes that must succeed or fail together:
 *     fs_commit([fs_w_set('reports', 5, $data), fs_w_update('counters', 'x', [...])]);
 *
 * Documents come back as plain PHP arrays. Every document also gets '_id' (its document ID).
 */

// Written for PHP 8.0 and newer (XAMPP 8.0 works).

final class FirestoreException extends RuntimeException
{
    /** HTTP code from Google (404, 409...) */
    public $http;
    /** Google's error status, e.g. NOT_FOUND, ALREADY_EXISTS */
    public $status;

    public function __construct(string $message, int $http = 0, string $status = '')
    {
        parent::__construct($message);
        $this->http = $http;
        $this->status = $status;
    }
}

/** Wrap binary data (photos) so it is stored as a Firestore "bytes" field. */
final class FsBytes
{
    /** @var string */
    public $data;

    public function __construct(string $data)
    {
        $this->data = $data;
    }
}

// array_is_list() only exists from PHP 8.1
if (!function_exists('array_is_list')) {
    function array_is_list(array $a): bool
    {
        $i = 0;
        foreach ($a as $k => $_) {
            if ($k !== $i++) {
                return false;
            }
        }
        return true;
    }
}

// ---------------------------------------------------------------- settings

function fs_project_id(): string
{
    static $id = null;
    if ($id === null) {
        $id = (string)(config('firebase.project_id') ?: (fs_service_account()['project_id'] ?? ''));
        if ($id === '') {
            throw new FirestoreException('Firebase project_id is missing. See api/config/config.php');
        }
    }
    return $id;
}

/** Full document path prefix, e.g. projects/my-app/databases/(default)/documents */
function fs_root(): string
{
    return 'projects/' . fs_project_id() . '/databases/' . (config('firebase.database_id') ?: '(default)') . '/documents';
}

function fs_base_url(): string
{
    return rtrim((string)(config('firebase.api_url') ?: 'https://firestore.googleapis.com/v1'), '/');
}

function fs_doc_name(string $collection, string|int $id): string
{
    $id = (string)$id;
    if ($id === '' || str_contains($id, '/')) {
        throw new InvalidArgumentException("Invalid document id for $collection");
    }
    return fs_root() . '/' . $collection . '/' . $id;
}

function fs_service_account(): array
{
    static $sa = null;
    if ($sa === null) {
        $file = (string)config('firebase.service_account_file');
        if (!is_file($file)) {
            throw new FirestoreException(
                'Firebase key file not found. Download it from Firebase console > Project settings > '
                . 'Service accounts > Generate new private key, and save it as api/config/firebase-service-account.json'
            );
        }
        $sa = json_decode((string)file_get_contents($file), true);
        if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) {
            throw new FirestoreException('The Firebase key file is not a valid service account JSON file');
        }
        if (($sa['project_id'] ?? '') !== config('firebase.project_id')) {
            throw new FirestoreException('The service account must belong to the configured Firebase project');
        }
    }
    return $sa;
}

// ---------------------------------------------------------------- login to Google (OAuth)

/**
 * Access token for the Firestore REST API. Google tokens last 1 hour, so it is
 * saved in api/cache/ and reused until 5 minutes before it expires.
 */
function fs_access_token(): string
{
    static $memo = null;
    if ($memo !== null && $memo['exp'] > time() + 60) {
        return $memo['token'];
    }
    $cacheDir = (string)config('firebase.cache_dir');
    $cacheFile = $cacheDir . '/google-token.json';
    if (is_file($cacheFile)) {
        $c = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($c) && ($c['exp'] ?? 0) > time() + 300 && ($c['for'] ?? '') === fs_service_account()['client_email']) {
            $memo = $c;
            return $c['token'];
        }
    }

    $sa = fs_service_account();
    $tokenUrl = (string)(config('firebase.token_url') ?: ($sa['token_uri'] ?? 'https://oauth2.googleapis.com/token'));
    $now = time();
    $b64 = fn(string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    $header = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = $b64(json_encode([
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore',
        'aud'   => $tokenUrl,
        'iat'   => $now,
        'exp'   => $now + 3600,
    ]));
    $key = openssl_pkey_get_private($sa['private_key']);
    if ($key === false || !openssl_sign("$header.$claims", $signature, $key, OPENSSL_ALGO_SHA256)) {
        throw new FirestoreException('Cannot read the private key in the Firebase key file');
    }
    $jwt = "$header.$claims." . $b64($signature);

    [$code, $body] = fs_http('POST', $tokenUrl, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion'  => $jwt,
    ]), ['Content-Type: application/x-www-form-urlencoded'], false);
    $json = json_decode($body, true);
    if ($code !== 200 || empty($json['access_token'])) {
        throw new FirestoreException('Google login failed (HTTP ' . $code . '): ' . ($json['error_description'] ?? $json['error'] ?? substr($body, 0, 200)), $code);
    }

    $memo = ['token' => $json['access_token'], 'exp' => $now + (int)($json['expires_in'] ?? 3600), 'for' => $sa['client_email']];
    if (is_dir($cacheDir) || @mkdir($cacheDir, 0775, true)) {
        @file_put_contents($cacheFile, json_encode($memo), LOCK_EX);
    }
    return $memo['token'];
}

// ---------------------------------------------------------------- HTTP

/** @return array{0:int,1:string} [http code, body] */
function fs_http(string $method, string $url, ?string $body = null, array $headers = [], bool $auth = true): array
{
    if (!function_exists('curl_init')) {
        throw new FirestoreException('The PHP cURL extension is off. In XAMPP, enable "extension=curl" in php.ini and restart Apache.');
    }
    $ch = curl_init($url);
    if ($auth) {
        $headers[] = 'Authorization: Bearer ' . fs_access_token();
    }
    $opts = [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 30,
    ];
    // XAMPP on Windows has no CA list, so HTTPS to Google fails without this file
    $ca = (string)config('firebase.ca_bundle');
    if ($ca !== '' && is_file($ca)) {
        $opts[CURLOPT_CAINFO] = $ca;
    }
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    if ($res === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new FirestoreException("Cannot reach Firebase: $err");
    }
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$code, (string)$res];
}

/** Call the Firestore REST API and return the decoded JSON. */
function fs_call(string $method, string $pathOrUrl, ?array $payload = null): array
{
    $url = str_starts_with($pathOrUrl, 'http') ? $pathOrUrl : fs_base_url() . '/' . $pathOrUrl;
    $GLOBALS['fs_stats']['calls'] = ($GLOBALS['fs_stats']['calls'] ?? 0) + 1;
    $body = $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    [$code, $res] = fs_http($method, $url, $body, ['Content-Type: application/json']);
    $json = json_decode($res, true);
    if ($code >= 400) {
        $err = is_array($json) ? ($json[0]['error'] ?? $json['error'] ?? []) : [];
        throw new FirestoreException(
            'Firestore error ' . $code . ': ' . ($err['message'] ?? substr($res, 0, 200)),
            $code,
            (string)($err['status'] ?? '')
        );
    }
    return is_array($json) ? $json : [];
}

// ---------------------------------------------------------------- value encoding

/** PHP value -> Firestore typed value */
function fs_encode($v): array
{
    if ($v === null) {
        return ['nullValue' => null];
    }
    if (is_bool($v)) {
        return ['booleanValue' => $v];
    }
    if (is_int($v)) {
        return ['integerValue' => (string)$v];
    }
    if (is_float($v)) {
        return ['doubleValue' => $v];
    }
    if (is_string($v)) {
        return ['stringValue' => $v];
    }
    if ($v instanceof FsBytes) {
        return ['bytesValue' => base64_encode($v->data)];
    }
    if (is_array($v)) {
        if (array_is_list($v)) {
            return ['arrayValue' => $v ? ['values' => array_map('fs_encode', $v)] : new stdClass()];
        }
        return ['mapValue' => ['fields' => fs_encode_fields($v)]];
    }
    throw new InvalidArgumentException('Cannot store this value type in Firestore: ' . get_debug_type($v));
}

function fs_encode_fields(array $data): array|stdClass
{
    $out = [];
    foreach ($data as $k => $v) {
        if (in_array($k, ['_id', '_update_time'], true)) {
            continue;
        }
        $out[(string)$k] = fs_encode($v);
    }
    return $out ?: new stdClass();
}

/** Firestore typed value -> PHP value */
function fs_decode(array $v)
{
    $type = array_key_first($v);
    $val = $v[$type];
    return match ($type) {
        'nullValue'      => null,
        'booleanValue'   => (bool)$val,
        'integerValue'   => (int)$val,
        'doubleValue'    => (float)$val,
        'stringValue', 'timestampValue', 'referenceValue' => (string)$val,
        'bytesValue'     => new FsBytes(base64_decode((string)$val)),
        'arrayValue'     => array_map('fs_decode', $val['values'] ?? []),
        'mapValue'       => fs_decode_fields($val['fields'] ?? []),
        'geoPointValue'  => ['latitude' => (float)($val['latitude'] ?? 0), 'longitude' => (float)($val['longitude'] ?? 0)],
        default          => null,
    };
}

function fs_decode_fields(array $fields): array
{
    $out = [];
    foreach ($fields as $k => $v) {
        $out[$k] = fs_decode($v);
    }
    return $out;
}

/** A Firestore document (name + fields) -> PHP array with '_id' */
function fs_decode_doc(array $doc): array
{
    $name = (string)($doc['name'] ?? '');
    $data = fs_decode_fields($doc['fields'] ?? []);
    $data['_id'] = substr($name, strrpos($name, '/') + 1);
    $data['_update_time'] = $doc['updateTime'] ?? null;
    return $data;
}

// ---------------------------------------------------------------- reading

/** One document, or null when it does not exist. */
function fs_get(string $collection, string|int $id): ?array
{
    try {
        $doc = fs_call('GET', fs_doc_name($collection, $id));
    } catch (FirestoreException $e) {
        if ($e->http === 404) {
            return null;
        }
        throw $e;
    }
    return fs_decode_doc($doc);
}

/**
 * Query a collection.
 *   $filters: [['field', '==', value], ['field', '>=', value], ['field', 'in', [..]], ...]  (joined with AND)
 *   $orderBy: [['field', 'desc'], ...]
 *
 * Firestore rule of thumb used in this project, so no index setup is needed in the console:
 *   - equality filters (==) on any number of fields are fine
 *   - a range filter (<, >=, ...) or orderBy only on ONE field, with no other filters
 * For anything else, read with simple filters and sort or filter in PHP (see core/reports.php).
 */
function fs_query(string $collection, array $filters = [], array $orderBy = [], ?int $limit = null, ?array $select = null): array
{
    $ops = [
        '==' => 'EQUAL', '!=' => 'NOT_EQUAL', '<' => 'LESS_THAN', '<=' => 'LESS_THAN_OR_EQUAL',
        '>' => 'GREATER_THAN', '>=' => 'GREATER_THAN_OR_EQUAL', 'in' => 'IN', 'array-contains' => 'ARRAY_CONTAINS',
    ];
    $q = ['from' => [['collectionId' => $collection]]];
    $ff = [];
    foreach ($filters as [$field, $op, $value]) {
        if (!isset($ops[$op])) {
            throw new InvalidArgumentException("Unknown filter operator $op");
        }
        $ff[] = ['fieldFilter' => ['field' => ['fieldPath' => $field], 'op' => $ops[$op], 'value' => fs_encode($value)]];
    }
    if (count($ff) === 1) {
        $q['where'] = $ff[0];
    } elseif ($ff) {
        $q['where'] = ['compositeFilter' => ['op' => 'AND', 'filters' => $ff]];
    }
    foreach ($orderBy as $o) {
        $q['orderBy'][] = ['field' => ['fieldPath' => $o[0]], 'direction' => strtolower($o[1] ?? 'asc') === 'desc' ? 'DESCENDING' : 'ASCENDING'];
    }
    if ($limit !== null) {
        $q['limit'] = $limit;
    }
    if ($select !== null) {
        $q['select'] = ['fields' => array_map(fn($f) => ['fieldPath' => $f], $select)];
    }

    $rows = fs_call('POST', fs_root() . ':runQuery', ['structuredQuery' => $q]);
    $out = [];
    foreach ($rows as $row) {
        if (isset($row['document'])) {
            $out[] = fs_decode_doc($row['document']);
        }
    }
    return $out;
}

/** First match of a query, or null. */
function fs_first(string $collection, array $filters): ?array
{
    return fs_query($collection, $filters, [], 1)[0] ?? null;
}

// ---------------------------------------------------------------- writing

/** Write builders for fs_commit(). */
function fs_w_set(string $collection, string|int $id, array $data): array
{
    return ['update' => ['name' => fs_doc_name($collection, $id), 'fields' => fs_encode_fields($data)]];
}

function fs_w_create(string $collection, string|int $id, array $data): array
{
    return fs_w_set($collection, $id, $data) + ['currentDocument' => ['exists' => false]];
}

/**
 * Change only the given fields. With $mustExist=false it also creates the document.
 * $append adds items to list fields without reading them first, e.g. ['history' => [$entry]].
 */
function fs_w_update(string $collection, string|int $id, array $fields, bool $mustExist = true, array $append = []): array
{
    unset($fields['_id']);
    $w = [
        'update'     => ['name' => fs_doc_name($collection, $id), 'fields' => fs_encode_fields($fields)],
        'updateMask' => ['fieldPaths' => array_map('fs_field_path', array_keys($fields))],
    ];
    foreach ($append as $field => $items) {
        $w['updateTransforms'][] = [
            'fieldPath'             => fs_field_path($field),
            'appendMissingElements' => ['values' => array_map('fs_encode', array_values($items))],
        ];
    }
    if ($mustExist) {
        $w['currentDocument'] = ['exists' => true];
    }
    return $w;
}

function fs_w_delete(string $collection, string|int $id): array
{
    return ['delete' => fs_doc_name($collection, $id)];
}

/** Add $by to a number field (creates the document if needed). */
function fs_w_increment(string $collection, string|int $id, string $field, int $by = 1): array
{
    return [
        'update'           => ['name' => fs_doc_name($collection, $id), 'fields' => new stdClass()],
        'updateMask'       => ['fieldPaths' => []],
        'updateTransforms' => [['fieldPath' => fs_field_path($field), 'increment' => ['integerValue' => (string)$by]]],
    ];
}

/** Field names with characters other than letters, digits and _ need backticks. */
function fs_field_path(string $field): string
{
    return preg_match('/^[A-Za-z_][A-Za-z_0-9]*$/', $field) ? $field : '`' . str_replace('`', '\\`', $field) . '`';
}

/**
 * Apply several writes atomically (all or nothing). Firestore allows 500 per commit;
 * longer lists are split, and then only each chunk is atomic.
 */
function fs_commit(array $writes): array
{
    $results = [];
    foreach (array_chunk($writes, 450) as $chunk) {
        $res = fs_call('POST', fs_root() . ':commit', ['writes' => $chunk]);
        array_push($results, ...($res['writeResults'] ?? []));
    }
    return $results;
}

function fs_set(string $collection, string|int $id, array $data): void
{
    fs_commit([fs_w_set($collection, $id, $data)]);
}

/** @return bool false when the document already exists */
function fs_create(string $collection, string|int $id, array $data): bool
{
    try {
        fs_commit([fs_w_create($collection, $id, $data)]);
        return true;
    } catch (FirestoreException $e) {
        if ($e->status === 'ALREADY_EXISTS' || $e->http === 409) {
            return false;
        }
        throw $e;
    }
}

function fs_update(string $collection, string|int $id, array $fields): void
{
    fs_commit([fs_w_update($collection, $id, $fields)]);
}

function fs_delete(string $collection, string|int $id): void
{
    fs_commit([fs_w_delete($collection, $id)]);
}

/**
 * Next number for a collection (like MySQL AUTO_INCREMENT). Stored in counters/{name}.
 * Firestore applies the increment atomically, so two people never get the same number.
 */
function fs_next_id(string $name): int
{
    $res = fs_commit([fs_w_increment('counters', $name, 'value')]);
    $val = $res[0]['transformResults'][0] ?? null;
    if (!is_array($val)) {
        throw new FirestoreException("Could not get the next id for $name");
    }
    return (int)fs_decode($val);
}

/** Reserve $count numbers at once. Returns them in order, e.g. [41, 42, 43]. */
function fs_next_ids(string $name, int $count): array
{
    if ($count < 1) {
        return [];
    }
    $res = fs_commit([fs_w_increment('counters', $name, 'value', $count)]);
    $last = (int)fs_decode($res[0]['transformResults'][0] ?? ['integerValue' => '0']);
    if ($last < $count) {
        throw new FirestoreException("Could not reserve ids for $name");
    }
    return range($last - $count + 1, $last);
}

/** Random document id (for logs where the number does not matter). */
function fs_random_id(): string
{
    return bin2hex(random_bytes(10));
}
