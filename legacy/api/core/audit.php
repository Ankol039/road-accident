<?php
/**
 * Audit trail (FR-14). Saved in the Firestore collection audit_logs.
 *
 * Log right away:
 *     audit_log($user, 'user.login', 'user', $user['id']);
 * Or add it to the same commit as the change (all or nothing):
 *     $writes[] = audit_write($user, 'report.status', 'report', $id, ['from' => 'submitted', 'to' => 'under_review']);
 */

const AUDIT_ACTIONS = [
    'user.login'       => 'Logged in',
    'user.register'    => 'Registered',
    'user.create'      => 'Created a user',
    'user.update'      => 'Updated a user',
    'user.profile'     => 'Updated own profile',
    'report.create'    => 'Submitted a report',
    'report.status'    => 'Changed report status',
    'report.assign'    => 'Dispatched an officer',
    'report.arrive'    => 'Officer confirmed arrival',
    'report.duplicate' => 'Marked as duplicate (automatic)',
    'report.remark'    => 'Added a remark',
    'report.edit'      => 'Edited report details',
    'report.flag'      => 'Flagged or unflagged a report',
    'report.add_info'  => 'Reporter added information',
    'report.export'    => 'Exported reports',
    'type.save'        => 'Saved an accident category',
    'contact.save'     => 'Saved an emergency contact',
    'settings.save'    => 'Changed system settings',
];

function audit_write(?array $user, string $action, ?string $entityType = null, ?int $entityId = null, array $details = []): array
{
    return fs_w_set('audit_logs', fs_random_id(), [
        'user_id'     => $user ? (int)$user['id'] : null,
        'user_name'   => $user['full_name'] ?? null,
        'user_role'   => $user['role'] ?? null,
        'action'      => $action,
        'entity_type' => $entityType,
        'entity_id'   => $entityId,
        'details'     => $details ?: null,
        'ip_address'  => client_ip(),
        'created_at'  => now(),
    ]);
}

function audit_log(?array $user, string $action, ?string $entityType = null, ?int $entityId = null, array $details = []): void
{
    fs_commit([audit_write($user, $action, $entityType, $entityId, $details)]);
}
