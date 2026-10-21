/**
 * Audit trail service.
 *
 * The PHP API wrote to `audit_logs` from api/core/audit.php. Every mutation in
 * this app calls logAudit() so the Audit trail screen still shows who did what.
 * Firestore rules allow admins to create these but never to edit or delete them.
 */
import { ref, addDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp } from '../lib/firestore.js'
import { COLLECTIONS } from '../lib/constants.js'

/** Record one action. Never throws — auditing must not break the main action. */
export async function logAudit({ actor, action, entity, entityId, details }) {
  try {
    await addDoc(ref(COLLECTIONS.auditLogs), {
      actor_id: actor?.uid || actor?.id || null,
      actor_name: actor?.full_name || actor?.email || 'System',
      actor_role: actor?.role || null,
      action,
      entity: entity || null,
      entity_id: entityId || null,
      details: details || null,
      created_at: serverTimestamp(),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Could not write audit entry:', error?.message)
  }
}

/**
 * Page through the audit trail.
 * @param {{action?:string, from?:string, to?:string, pageSize?:number, cursor?:any}} opts
 */
export async function listAudit({ action, from, to, pageSize = 25, cursor } = {}) {
  const parts = []
  if (action) parts.push(where('action', '==', action))
  if (from) parts.push(where('created_at', '>=', new Date(`${from}T00:00:00`)))
  if (to) parts.push(where('created_at', '<=', new Date(`${to}T23:59:59`)))
  parts.push(orderBy('created_at', 'desc'))
  if (cursor) parts.push(startAfter(cursor))
  parts.push(limit(pageSize + 1))

  const snap = await getDocs(query(ref(COLLECTIONS.auditLogs), ...parts))
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const page = hasMore ? docs.slice(0, pageSize) : docs
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() })),
    cursor: hasMore ? page[page.length - 1] : null,
    total: null,
  }
}
