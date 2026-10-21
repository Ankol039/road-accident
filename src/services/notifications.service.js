/**
 * Notifications service (the `notifications` collection).
 * Ported from api/core/notify.php + api/notifications/*.php.
 */
import {
  ref,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  patchDoc,
  writeBatch,
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
  const snap = await getDocs(
    query(ref(COLLECTIONS.notifications), where('user_id', '==', uid), where('read', '==', false), limit(500)),
  )
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
  return snap.size
}
