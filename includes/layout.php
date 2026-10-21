<?php
/**
 * Shared page parts for the admin website (administrators only).
 * Every page in web/ starts with:
 *
 *     <?php
 *     require __DIR__ . '/includes/layout.php';
 *     page_head('Dashboard · RoadReport', ['leaflet']);
 *     ?>
 *
 * This file only prints the parts that were the same on every page (the <head> and the logo).
 * The page content and the JavaScript in js/pages/ are unchanged: the browser still logs in
 * with the PHP API (api/) and draws the menu, tables, charts and maps.
 * Owner: Jan Russel
 */

const APP_NAME = 'RoadReport';

/** Extra stylesheets a page can ask for (besides Bootstrap and css/app.css). */
const EXTRA_CSS = [
    'leaflet' => 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
];

/** Escape text for HTML. */
function h(?string $text): string
{
    return htmlspecialchars((string)$text, ENT_QUOTES, 'UTF-8');
}

/**
 * Prints <!doctype html> up to </head>.
 * $css: keys of EXTRA_CSS, e.g. ['leaflet'] for pages with a map.
 * $extraFiles: app-relative stylesheets loaded after css/app.css, e.g. ['css/landing.css'].
 */
function page_head(string $title, array $css = [], array $extraFiles = []): void
{
    $title = h($title);
    $extra = '';
    foreach ($css as $name) {
        $extra .= '  <link href="' . h(EXTRA_CSS[$name]) . '" rel="stylesheet">' . "\n";
    }
    $after = '';
    foreach ($extraFiles as $file) {
        $after .= '  <link href="' . h($file) . '" rel="stylesheet">' . "\n";
    }
    echo <<<HTML
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0e1214">
  <title>{$title}</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
{$extra}  <link href="css/app.css" rel="stylesheet">
{$after}</head>

HTML;
}

/** The RoadReport logo (same markup as brand() in js/app.js). $light = white text for dark backgrounds. */
function brand(bool $light = false): string
{
    $svg = '<svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><rect x="10" y="10" width="44" height="44" rx="6" transform="rotate(45 32 32)" fill="#F2B705" stroke="#23272B" stroke-width="4"/><rect x="29" y="18" width="6" height="18" rx="3" fill="#23272B"/><circle cx="32" cy="43" r="3.5" fill="#23272B"/></svg>';
    return '<span class="brand ' . ($light ? 'brand-light' : '') . '">' . $svg . '<span>' . APP_NAME . '</span></span>';
}
