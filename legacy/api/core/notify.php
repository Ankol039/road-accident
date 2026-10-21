<?php
/**
 * Notifications (FR-09). Saves in-app notifications (Firestore collection "notifications")
 * that the website and the mobile app show. If email is turned on in config.php,
 * the same message is also emailed. A failed email never stops the request.
 *
 *     $writes = array_merge($writes, notification_writes([$reporterId], 'Report updated', 'Status is now: Verified', $report));
 *     fs_commit($writes);
 *     send_queued_emails();   // after the commit
 */

/** Writes for one notification per user (ids are reserved in one call). */
function notification_writes(array $userIds, string $title, string $message, ?array $report = null): array
{
    $userIds = array_values(array_unique(array_map('intval', array_filter($userIds))));
    $ids = fs_next_ids('notifications', count($userIds));
    $writes = [];
    foreach ($userIds as $i => $uid) {
        $writes[] = fs_w_set('notifications', $ids[$i], [
            'id'          => $ids[$i],
            'user_id'     => $uid,
            'report_id'   => $report ? (int)$report['id'] : null,
            'report_code' => $report['report_code'] ?? null,
            'title'       => mb_substr($title, 0, 120),
            'message'     => mb_substr($message, 0, 255),
            'is_read'     => false,
            'created_at'  => now(),
        ]);
        $GLOBALS['email_queue'][] = [$uid, $title, $message];
    }
    return $writes;
}

function notify_user(int $userId, string $title, string $message, ?array $report = null): void
{
    fs_commit(notification_writes([$userId], $title, $message, $report));
    send_queued_emails();
}

function admin_ids(): array
{
    return array_map(
        fn($u) => (int)($u['id'] ?? $u['_id']),
        fs_query('users', [['role', '==', 'admin'], ['status', '==', 'active']])
    );
}

/** Email whatever notifications were saved during this request (only if mail is enabled). */
function send_queued_emails(): void
{
    $queue = $GLOBALS['email_queue'] ?? [];
    $GLOBALS['email_queue'] = [];
    if (!$queue || !config('mail.enabled')) {
        return;
    }
    try {
        require_once __DIR__ . '/../lib/PHPMailer/Exception.php';
        require_once __DIR__ . '/../lib/PHPMailer/PHPMailer.php';
        require_once __DIR__ . '/../lib/PHPMailer/SMTP.php';
        foreach ($queue as [$uid, $title, $message]) {
            $u = find_user((int)$uid);
            if (!$u || empty($u['email'])) {
                continue;
            }
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = config('mail.host');
            $mail->Port = (int)config('mail.port');
            $mail->SMTPAuth = true;
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Username = config('mail.username');
            $mail->Password = config('mail.password');
            $mail->Timeout = 10;
            $mail->CharSet = 'UTF-8';
            $mail->setFrom(config('mail.username'), (string)config('mail.from_name', app_setting('system_name')));
            $mail->addAddress($u['email'], $u['full_name']);
            $mail->Subject = $title;
            $mail->Body = "Hi {$u['full_name']},\n\n$message\n\nOpen the app to see the details.\n\n- " . app_setting('system_name');
            $mail->send();
        }
    } catch (Throwable $e) {
        // Keep going: the in-app notification is already saved
        error_log('Email failed: ' . $e->getMessage());
    }
}
