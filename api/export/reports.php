<?php
/**
 * GET /export/reports.php   (FR-15 data export)   Owner: John
 *
 *   ?format=csv|pdf
 *   &type=reports   (default) the report list, with the same filters as reports/list.php
 *   &type=summary   the FR-12 summary: &period=daily|weekly|monthly|annual&scope=official|all&date_from=&date_to=
 *   &token=...      a download link cannot send the Authorization header
 *
 * Reporter names and contact numbers are included only for admins (officers export their
 * assigned reports without them). Every export is saved in the audit trail.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth(['admin', 'officer']);
$format = ($_GET['format'] ?? 'csv') === 'pdf' ? 'pdf' : 'csv';
$type = ($_GET['type'] ?? 'reports') === 'summary' ? 'summary' : 'reports';
if ($type === 'summary' && $user['role'] !== 'admin') {
    json_error('Only admins can export summaries', 403);
}
$isAdmin = $user['role'] === 'admin';
$filters = report_filters_from_query();
$system = app_setting('system_name');
$stamp = date('Y-m-d_His');

// ---------------------------------------------------------------- build the table
if ($type === 'reports') {
    $rows = load_reports($user, $filters);
    $types = accident_types_map();
    $title = 'Road accident reports';
    $headers = ['Report ID', 'Accident date', 'Time', 'Type', 'Location', 'Barangay', 'Municipality', 'Latitude', 'Longitude',
        'Injuries', 'Vehicles', 'Status', 'Record', 'Assigned officer', 'Date submitted', 'Flagged'];
    if ($isAdmin) {
        array_push($headers, 'Reporter', 'Contact');
    }
    $table = array_map(function ($r) use ($types, $isAdmin) {
        $row = [
            $r['report_code'], $r['accident_date'], substr($r['accident_time'], 0, 5),
            $types[(int)$r['accident_type_id']]['name'] ?? ($r['accident_type'] ?? ''),
            $r['location_text'], $r['barangay'] ?? '', $r['municipality'] ?? '',
            $r['latitude'] ?? '', $r['longitude'] ?? '',
            INJURY_OPTIONS[$r['injury_status']] ?? $r['injury_status'],
            implode(', ', array_map(fn($v) => $v['quantity'] . ' ' . $v['type'], $r['vehicles'] ?? [])),
            status_label($r['status']),
            is_official_record($r) ? 'Verified record' : 'Public report',
            $r['assigned_officer_name'] ?? '', $r['created_at'],
            !empty($r['is_flagged']) ? ($r['flag_reason'] ?: 'Yes') : '',
        ];
        if ($isAdmin) {
            array_push($row, $r['reporter_name'] ?? '', $r['contact_info'] ?? '');
        }
        return $row;
    }, $rows);
    $subtitle = count($rows) . ' report(s)' . describe_filters($filters);
} else {
    $period = in_array($_GET['period'] ?? '', ['daily', 'weekly', 'monthly', 'annual'], true) ? $_GET['period'] : 'monthly';
    $scope = ($_GET['scope'] ?? 'official') === 'all' ? 'all' : 'official';
    [$from, $to] = default_range($period);
    $from = $filters['date_from'] ?? $from;
    $to = $filters['date_to'] ?? $to;
    $summary = period_summary(load_reports($user, $scope === 'official' ? ['official' => true] : []), $period, $from, $to);
    $totals = summary_totals($summary);
    $title = ucfirst($period) . ' accident summary';
    $headers = ['Period', 'Total', 'With injuries', 'Fatalities', 'No injuries', 'Unknown', 'Vehicles', 'Resolved', 'Most common type', 'Top municipality'];
    $table = array_map(fn($s) => [
        $s['label'], $s['total'], $s['with_injuries'], $s['fatalities'], $s['no_injuries'], $s['unknown_injuries'],
        $s['vehicles'], $s['resolved'], $s['top_type'] ?? '', $s['top_municipality'] ?? '',
    ], $summary);
    $table[] = ['TOTAL', $totals['total'], $totals['with_injuries'], $totals['fatalities'], $totals['no_injuries'],
        $totals['unknown_injuries'], $totals['vehicles'], $totals['resolved'], '', ''];
    $subtitle = ($scope === 'official' ? 'Verified accident records only' : 'All public reports') . ", $from to $to";
}

audit_log($user, 'report.export', 'report', null, ['format' => $format, 'type' => $type, 'rows' => count($table), 'filters' => $filters]);

$filename = strtolower(str_replace(' ', '-', $title)) . "_$stamp.$format";

// ---------------------------------------------------------------- CSV
if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // so Excel shows ñ and other letters correctly
    fputcsv($out, [$system . ' - ' . $title]);
    fputcsv($out, [$subtitle . '. Generated ' . date('M j, Y g:i A') . ' by ' . $user['full_name']]);
    fputcsv($out, []);
    fputcsv($out, $headers);
    foreach ($table as $row) {
        // A leading = + - @ would run as a formula in Excel
        fputcsv($out, array_map(fn($c) => is_string($c) && preg_match('/^[=+\-@]/', $c) ? "'$c" : $c, $row));
    }
    fclose($out);
    exit;
}

// ---------------------------------------------------------------- PDF (FPDF library, api/lib/fpdf)
require_once __DIR__ . '/../lib/fpdf/fpdf.php';

final class ReportPdf extends FPDF
{
    public string $headTitle = '';
    public string $headSub = '';

    public function Header(): void
    {
        $this->SetFont('Helvetica', 'B', 13);
        $this->Cell(0, 7, pdf_text($this->headTitle), 0, 1);
        $this->SetFont('Helvetica', '', 8.5);
        $this->SetTextColor(90, 90, 90);
        $this->Cell(0, 5, pdf_text($this->headSub), 0, 1);
        $this->SetTextColor(0, 0, 0);
        $this->Ln(2);
    }

    public function Footer(): void
    {
        $this->SetY(-12);
        $this->SetFont('Helvetica', '', 7.5);
        $this->SetTextColor(120, 120, 120);
        $this->Cell(0, 5, pdf_text('Generated ' . date('M j, Y g:i A') . '   |   Page ' . $this->PageNo() . ' of {nb}'), 0, 0, 'R');
    }
}

function pdf_text($s): string
{
    $s = (string)$s;
    $out = @iconv('UTF-8', 'windows-1252//TRANSLIT', $s);
    return $out === false ? $s : $out;
}

/** Wrap text into lines that fit $w millimetres. */
function pdf_lines(FPDF $pdf, string $text, float $w): array
{
    $text = pdf_text($text);
    $lines = [];
    foreach (explode("\n", $text) as $para) {
        $line = '';
        foreach (preg_split('/\s+/', $para) as $word) {
            $try = $line === '' ? $word : "$line $word";
            if ($pdf->GetStringWidth($try) <= $w - 2) {
                $line = $try;
                continue;
            }
            if ($line !== '') {
                $lines[] = $line;
            }
            // Very long word: cut it
            while ($pdf->GetStringWidth($word) > $w - 2 && strlen($word) > 1) {
                $cut = strlen($word);
                while ($cut > 1 && $pdf->GetStringWidth(substr($word, 0, $cut)) > $w - 2) {
                    $cut--;
                }
                $lines[] = substr($word, 0, $cut);
                $word = substr($word, $cut);
            }
            $line = $word;
        }
        $lines[] = $line;
    }
    return $lines ?: [''];
}

// Columns kept in the PDF (the CSV has all of them), with widths in mm for A4 landscape (277 mm usable)
if ($type === 'reports') {
    $keep = $isAdmin
        ? ['Report ID' => 25, 'Accident date' => 20, 'Time' => 11, 'Type' => 25, 'Location' => 50, 'Municipality' => 23,
           'Injuries' => 22, 'Status' => 24, 'Record' => 20, 'Assigned officer' => 30, 'Reporter' => 27]
        : ['Report ID' => 27, 'Accident date' => 22, 'Time' => 12, 'Type' => 30, 'Location' => 66, 'Municipality' => 28,
           'Injuries' => 26, 'Status' => 30, 'Record' => 36];
} else {
    $keep = ['Period' => 46, 'Total' => 18, 'With injuries' => 24, 'Fatalities' => 22, 'No injuries' => 22, 'Unknown' => 20,
             'Vehicles' => 20, 'Resolved' => 20, 'Most common type' => 45, 'Top municipality' => 40];
}
$idx = array_map(fn($h) => array_search($h, $headers, true), array_keys($keep));
$widths = array_values($keep);
$numeric = $type === 'summary' ? [1, 2, 3, 4, 5, 6, 7] : [];

$pdf = new ReportPdf('L', 'mm', 'A4');
$pdf->headTitle = "$system - $title";
$pdf->headSub = $subtitle . '. Prepared by ' . $user['full_name'] . '.';
$pdf->AliasNbPages();
$pdf->SetMargins(10, 10, 10);
$pdf->SetAutoPageBreak(true, 14);
$pdf->AddPage();

$drawHead = function () use ($pdf, $keep, $widths, $numeric) {
    $pdf->SetFont('Helvetica', 'B', 8);
    $pdf->SetFillColor(35, 39, 43);
    $pdf->SetTextColor(255, 255, 255);
    foreach (array_keys($keep) as $i => $h) {
        $pdf->Cell($widths[$i], 7, pdf_text($h), 0, 0, in_array($i, $numeric, true) ? 'R' : 'L', true);
    }
    $pdf->Ln();
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('Helvetica', '', 7.5);
};
$drawHead();

if (!$table) {
    $pdf->Cell(0, 10, 'No reports match these filters.', 0, 1);
}
foreach ($table as $n => $row) {
    $cells = array_map(fn($i) => $i === false ? '' : (string)$row[$i], $idx);
    $wrapped = array_map(fn($c, $i) => pdf_lines($pdf, $c, $widths[$i]), $cells, array_keys($cells));
    $lines = max(array_map('count', $wrapped));
    $h = 4 * $lines + 2;
    if ($pdf->GetY() + $h > $pdf->GetPageHeight() - 14) {
        $pdf->AddPage();
        $drawHead();
    }
    $isTotal = $type === 'summary' && $n === count($table) - 1;
    $pdf->SetFillColor($isTotal ? 242 : ($n % 2 ? 247 : 255), $isTotal ? 183 : ($n % 2 ? 247 : 255), $isTotal ? 5 : ($n % 2 ? 247 : 255));
    if ($isTotal) {
        $pdf->SetFont('Helvetica', 'B', 8);
    }
    $x = $pdf->GetX();
    $y = $pdf->GetY();
    foreach ($wrapped as $i => $cellLines) {
        $pdf->Rect($x, $y, $widths[$i], $h, 'F');
        $pdf->SetXY($x, $y + 1);
        foreach ($cellLines as $line) {
            $pdf->Cell($widths[$i], 4, $line, 0, 2, in_array($i, $numeric, true) ? 'R' : 'L');
        }
        $x += $widths[$i];
    }
    $pdf->SetXY(10, $y + $h);
}

$pdf->Output('D', $filename);

function describe_filters(array $f): string
{
    $parts = [];
    if (!empty($f['status'])) $parts[] = 'status ' . status_label($f['status']);
    if (!empty($f['accident_type_id'])) $parts[] = 'type ' . (accident_types_map()[$f['accident_type_id']]['name'] ?? $f['accident_type_id']);
    if (!empty($f['municipality'])) $parts[] = $f['municipality'];
    if (!empty($f['barangay'])) $parts[] = 'Brgy. ' . $f['barangay'];
    if (!empty($f['date_from']) || !empty($f['date_to'])) $parts[] = ($f['date_from'] ?? '...') . ' to ' . ($f['date_to'] ?? '...');
    if (!empty($f['q'])) $parts[] = 'search "' . $f['q'] . '"';
    if (!empty($f['flagged'])) $parts[] = 'flagged only';
    if (!empty($f['official'])) $parts[] = 'verified records only';
    return $parts ? ', filtered by ' . implode(', ', $parts) : '';
}
