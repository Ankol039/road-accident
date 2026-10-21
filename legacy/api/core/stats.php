<?php
/**
 * Statistics shared by the dashboard (FR-10), the period summaries (FR-12)
 * and the exports (FR-15). Official numbers count only verified accident records,
 * so unverified public reports are not counted as accidents.
 */

/** Count rows by a key function, biggest first. */
function count_by(array $rows, callable $key, ?int $limit = null): array
{
    $counts = [];
    foreach ($rows as $r) {
        $k = $key($r);
        if ($k === null || $k === '') {
            continue;
        }
        $counts[$k] = ($counts[$k] ?? 0) + 1;
    }
    arsort($counts);
    return $limit ? array_slice($counts, 0, $limit, true) : $counts;
}

function top_key(array $counts): ?string
{
    return $counts ? (string)array_key_first($counts) : null;
}

/** Period key and label for an accident date. */
function period_of(string $date, string $period): array
{
    $t = strtotime($date);
    switch ($period) {
        case 'daily':
            return [$date, date('D, M j, Y', $t)];
        case 'weekly':
            $monday = strtotime('monday this week', $t);
            $sunday = strtotime('+6 days', $monday);
            $label = date('M j', $monday) . ' – ' . (date('M', $monday) === date('M', $sunday) ? date('j', $sunday) : date('M j', $sunday)) . ', ' . date('Y', $sunday);
            return [date('o-\WW', $t), $label];
        case 'annual':
            return [date('Y', $t), date('Y', $t)];
        default: // monthly
            return [date('Y-m', $t), date('F Y', $t)];
    }
}

/** Default date range for each period when none is given. */
function default_range(string $period): array
{
    return match ($period) {
        'daily'  => [date('Y-m-d', strtotime('-29 days')), date('Y-m-d')],
        'weekly' => [date('Y-m-d', strtotime('monday this week -11 weeks')), date('Y-m-d')],
        'annual' => ['2000-01-01', date('Y-m-d')],
        default  => [date('Y-m-01', strtotime('first day of -11 months')), date('Y-m-d')],
    };
}

/**
 * FR-12 summary rows, one per period, newest first.
 * Empty periods inside the range are included (with zeros) for daily, weekly and monthly.
 */
function period_summary(array $reports, string $period, string $from, string $to): array
{
    $types = accident_types_map();
    $groups = [];
    foreach ($reports as $r) {
        if ($r['accident_date'] < $from || $r['accident_date'] > $to) {
            continue;
        }
        [$key] = period_of($r['accident_date'], $period);
        $groups[$key][] = $r;
    }
    // Fill empty periods so the table and charts have no gaps
    if ($period !== 'annual') {
        $step = ['daily' => '+1 day', 'weekly' => '+1 week', 'monthly' => '+1 month'][$period];
        $t = strtotime($period === 'monthly' ? date('Y-m-01', strtotime($from)) : ($period === 'weekly' ? date('Y-m-d', strtotime('monday this week', strtotime($from))) : $from));
        for ($i = 0; $t <= strtotime($to) && $i < 400; $i++, $t = strtotime($step, $t)) {
            [$key] = period_of(date('Y-m-d', $t), $period);
            $groups[$key] ??= [];
        }
    }
    krsort($groups);
    $rows = [];
    foreach ($groups as $key => $list) {
        $sample = $list[0]['accident_date'] ?? null;
        $label = $sample ? period_of($sample, $period)[1] : period_label_from_key($key, $period);
        $injury = count_by($list, fn($r) => $r['injury_status']);
        $rows[] = [
            'period'           => (string)$key,
            'label'            => $label,
            'total'            => count($list),
            'with_injuries'    => $injury['injuries'] ?? 0,
            'fatalities'       => $injury['fatalities'] ?? 0,
            'no_injuries'      => $injury['none'] ?? 0,
            'unknown_injuries' => $injury['unknown'] ?? 0,
            'vehicles'         => array_sum(array_map(fn($r) => array_sum(array_column($r['vehicles'] ?? [], 'quantity')), $list)),
            'resolved'         => count(array_filter($list, fn($r) => $r['status'] === 'resolved')),
            'top_type'         => ($t = top_key(count_by($list, fn($r) => (int)$r['accident_type_id']))) !== null
                ? ($types[(int)$t]['name'] ?? $list[0]['accident_type'] ?? null) : null,
            'top_municipality' => top_key(count_by($list, fn($r) => $r['municipality'] ?? null)),
        ];
    }
    return $rows;
}

function period_label_from_key(string $key, string $period): string
{
    return match ($period) {
        'daily'   => date('D, M j, Y', strtotime($key)),
        'monthly' => date('F Y', strtotime($key . '-01')),
        'weekly'  => period_of(date('Y-m-d', strtotime(str_replace('-W', 'W', $key))), 'weekly')[1],
        default   => $key,
    };
}

/** One-line totals under a summary table. */
function summary_totals(array $rows): array
{
    $sum = fn($k) => array_sum(array_column($rows, $k));
    return [
        'total' => $sum('total'), 'with_injuries' => $sum('with_injuries'), 'fatalities' => $sum('fatalities'),
        'no_injuries' => $sum('no_injuries'), 'unknown_injuries' => $sum('unknown_injuries'),
        'vehicles' => $sum('vehicles'), 'resolved' => $sum('resolved'),
    ];
}
