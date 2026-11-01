/**
 * Notifications service (the `notifications` collection).
 * Ported from api/core/notify.php + api/notifications/*.php.
 */
import {
  ref,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  patchDoc,
  writeBatch,
  serverTimestamp,
} from '../lib/firestore.js'
import { db } from '../lib/firebase.js'
import { COLLECTIONS } from '../lib/constants.js'

/** Notifications for one user, newest first. */
export async function listNotifications(uid, { unreadOnly = false, max = 50 } = {}) {
  const parts = [where('user_id', '==', uid)]
  if (unreadOnly) parts.push(where('read', '==', false))
  parts.push(orderBy('created_at', 'desc'), limit(max))
  const snap = await getDocs(query(ref(COLLECTIONS.notifications), ...parts))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Count of unread notifications, for the sidebar pill. */
export async function unreadCount(uid) {
  const snap = await getDocs(
    query(ref(COLLECTIONS.notifications), where('user_id', '==', uid), where('read', '==', false), limit(99)),
  )
  return snap.size
}

export const markRead = (id) => patchDoc(COLLECTIONS.notifications, id, { read: true })

/** Mark every unread notification for this user as read. */
export async function markAllRead(uid) {
  let total = 0
  // Firestore batches hold at most 500 writes; keep going if the inbox is larger.
  while (true) {
    const snap = await getDocs(
      query(ref(COLLECTIONS.notifications), where('user_id', '==', uid), where('read', '==', false), limit(500)),
    )
    if (!snap.size) return total
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
    await batch.commit()
    total += snap.size
    if (snap.size < 500) return total
  }
}

/**
 * Send a notification to one user.
 *
 * The PHP API wrote these rows in the same batch as the status change; here
 * the rules only let admins create them, so the portal does it and a failure
 * never breaks the action that triggered it.
 */
export async function notifyUser(uid, { title, message, kind = 'info', report_code = null }) {
  if (!uid) return null
  try {
    const created = await addDoc(ref(COLLECTIONS.notifications), {
      user_id: uid,
      report_code,
      title,
      message,
      kind,
      read: false,
      created_at: serverTimestamp(),
    })
    return created.id
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Could not write notification:', error?.message)
    return null
  }
}

/** Convenience wrapper for the traffic officer who is working a report. */
export const notifyOfficer = (officerId, title, message, report) =>
  notifyUser(officerId, {
    title,
    message,
    kind: 'status',
    report_code: report?.report_code || null,
  })
