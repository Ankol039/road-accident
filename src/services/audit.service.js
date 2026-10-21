/**
 * Audit trail service.
 *
 * The PHP API wrote to `audit_logs` from api/core/audit.php. Every mutation in
 * this app calls logAudit() so the Audit trail screen still shows who did what.
 * Firestore rules allow admins to create these but never to edit or delete them.
 */
import { ref, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from '../lib/firestore.js'
import { COLLECTIONS } from '../lib/constants.js'

/**
 * How many entries one range may hold. The PHP app used the same number.
 * A longer range needs a smaller window, so the screen says so instead of
 * quietly showing half of the trail.
 */
const MAX_ROWS = 3000

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
 * Read the audit trail for a date range.
 *
 * api/audit/list.php read the whole range from Firestore and then narrowed it
 * down in PHP. The same is done here: the date range is the only filter that
 * runs in Firestore, so the query stays on the single-field index and the
 * screen works whether or not the composite indexes have been deployed.
 *
 * @param {{action?:string, q?:string, from?:string, to?:string, page?:number, perPage?:number}} opts
 */
export async function listAudit({ action, q, from, to, page = 1, perPage = 50 } = {}) {
  const parts = []
  if (from) parts.push(where('created_at', '>=', new Date(`${from}T00:00:00`)))
  if (to) parts.push(where('created_at', '<=', new Date(`${to}T23:59:59`)))
  parts.push(orderBy('created_at', 'desc'))
  parts.push(limit(MAX_ROWS))

  const snap = await getDocs(query(ref(COLLECTIONS.auditLogs), ...parts))
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // The action filter matches the start of the action, like the PHP one did.
  if (action) {
    rows = rows.filter((r) => String(r.action || '').startsWith(action))
  }

  // The search looks through the name, the details and the item it was about.
  if (q) {
    const needle = String(q).trim().toLowerCase()
    rows = rows.filter((r) =>
      [r.actor_name, r.entity_id, JSON.stringify(r.details ?? '')]
        .filter((v) => v !== null && v !== undefined && v !== '')
        .some((v) => String(v).toLowerCase().includes(needle)),
    )
  }

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const current = Math.min(Math.max(1, page), totalPages)

  return {
    rows: rows.slice((current - 1) * perPage, current * perPage),
    total,
    page: current,
    totalPages,
  }
}
