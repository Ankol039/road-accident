<?php
/** Helpers for reading the request. */

function require_method(string ...$methods): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $methods, true)) {
        json_error('Method not allowed. Use ' . implode(' or ', $methods), 405);
    }
}

/**
 * Body fields from a JSON body (application/json) or a normal form post
 * (multipart/form-data, used when photos are uploaded).
 */
function input(): array
{
    static $data = null;
    if ($data !== null) {
        return $data;
    }
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== false) {
        $decoded = json_decode(file_get_contents('php://input') ?: '', true);
        $data = is_array($decoded) ? $decoded : [];
    } else {
        $data = $_POST;
    }
    return $data;
}

/** A trimmed string field, or null when it is missing or empty. */
function str_field(array $src, string $key): ?string
{
    if (!isset($src[$key]) || is_array($src[$key])) {
        return null;
    }
    $v = trim((string)$src[$key]);
    return $v === '' ? null : $v;
}

function int_query(string $key, ?int $default = null): ?int
{
    if (!isset($_GET[$key]) || $_GET[$key] === '') {
        return $default;
    }
    return filter_var($_GET[$key], FILTER_VALIDATE_INT) === false ? $default : (int)$_GET[$key];
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

/** Absolute base URL of the API, e.g. http://192.168.1.5/road-accident-system/api */
function api_base_url(): string
{
    $configured = (string)config('api_base_url', '');
    if ($configured !== '') return rtrim($configured, '/');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $pos = strpos($script, '/api/');
    $base = $pos !== false ? substr($script, 0, $pos + 4) : '';
    return "$scheme://$host$base";
}
