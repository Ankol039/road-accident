<?php
/**
 * Every response uses the same JSON shape, so web and mobile can handle it the same way:
 *   success: { "success": true,  "data": ..., "message": "..." }
 *   error:   { "success": false, "message": "...", "errors": { "field": "problem" } }
 */

function json_response(array $body, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_ok($data = null, string $message = 'OK', int $code = 200): void
{
    json_response(['success' => true, 'message' => $message, 'data' => $data], $code);
}

function json_error(string $message, int $code = 400, array $errors = []): void
{
    $body = ['success' => false, 'message' => $message];
    if ($errors) {
        $body['errors'] = $errors;
    }
    json_response($body, $code);
}

/** Placeholder used by endpoints that a member still has to build. */
function not_implemented(string $owner, string $what): void
{
    json_error("Not built yet: $what (owner: $owner)", 501);
}
