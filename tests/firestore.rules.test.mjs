// Rules tests for firestore.rules (run against the Firestore emulator).
//
//   npm i -D @firebase/rules-unit-testing firebase
//   firebase emulators:exec --only firestore --project demo-roadreport "node --test tests/"
//
// Needs Java and firebase-tools (the emulator downloads once).
import { readFileSync } from 'node:fs'
import { before, after, beforeEach, describe, it } from 'node:test'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore'

const PROJECT = 'demo-roadreport'
let env

const U = {
  admin: 'uid-admin',
  adminOff: 'uid-admin-inactive',
  officerA: 'uid-officer-a',
  officerB: 'uid-officer-b',
  repA: 'uid-reporter-a',
  repB: 'uid-reporter-b',
  stranger: 'uid-no-profile',
}
const EMAIL = (uid) => `${uid}@example.com`
const as = (uid) => env.authenticatedContext(uid, { email: EMAIL(uid) }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

const profileOf = (uid, role, status = 'active') => ({
  email: EMAIL(uid), full_name: `Name ${uid}`, phone: null, role, status,
  badge_no: null, created_at: new Date(), updated_at: new Date(),
})

const REPORT = {
  report_code: 'RA-2026-000001', status: 'submitted',
  accident_date: '2026-10-01', accident_time: '10:00', accident_type_id: 'hit_and_run',
  injury_status: 'none', location_text: 'Somewhere', latitude: 14.8, longitude: 120.8,
  officer_id: U.officerA, reporter_id: U.repA, created_at: new Date(),
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})
after(async () => { await env.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', U.admin), profileOf(U.admin, 'admin'))
    await setDoc(doc(db, 'users', U.adminOff), profileOf(U.adminOff, 'admin', 'inactive'))
    await setDoc(doc(db, 'users', U.officerA), profileOf(U.officerA, 'officer'))
    await setDoc(doc(db, 'users', U.officerB), profileOf(U.officerB, 'officer'))
    await setDoc(doc(db, 'users', U.repA), profileOf(U.repA, 'reporter'))
    await setDoc(doc(db, 'users', U.repB), profileOf(U.repB, 'reporter'))
    await setDoc(doc(db, 'reports', 'r1'), REPORT)
    await setDoc(doc(db, 'report_photos', 'p1'), { report_id: 'r1', data: 'AAAA' })
    await setDoc(doc(db, 'notifications', 'n1'), {
      user_id: U.admin, title: 'T', message: 'M', read: false, created_at: new Date(),
    })
    await setDoc(doc(db, 'settings', 's1'), { value: 1 })
    await setDoc(doc(db, 'counters', 'reports_2026'), { value: 1 })
  })
})

describe('reading reports and photos', () => {
  it('admin can read', async () => { await assertSucceeds(getDoc(doc(as(U.admin), 'reports', 'r1'))) })
  it('assigned officer can read', async () => { await assertSucceeds(getDoc(doc(as(U.officerA), 'reports', 'r1'))) })
  it('other officer cannot', async () => { await assertFails(getDoc(doc(as(U.officerB), 'reports', 'r1'))) })
  it('owner reporter can read', async () => { await assertSucceeds(getDoc(doc(as(U.repA), 'reports', 'r1'))) })
  it('other reporter cannot', async () => { await assertFails(getDoc(doc(as(U.repB), 'reports', 'r1'))) })
  it('signed in without a profile cannot', async () => { await assertFails(getDoc(doc(as(U.stranger), 'reports', 'r1'))) })
  it('inactive admin cannot', async () => { await assertFails(getDoc(doc(as(U.adminOff), 'reports', 'r1'))) })
  it('anonymous cannot', async () => { await assertFails(getDoc(doc(anon(), 'reports', 'r1'))) })
  it('admin can list reports', async () => { await assertSucceeds(getDocs(collection(as(U.admin), 'reports'))) })
  it('a reporter cannot list every report', async () => { await assertFails(getDocs(collection(as(U.repA), 'reports'))) })
  it('a reporter can list their own reports', async () => {
    await assertSucceeds(getDocs(query(collection(as(U.repA), 'reports'), where('reporter_id', '==', U.repA))))
  })
  it('photos: admin and assigned officer only', async () => {
    await assertSucceeds(getDoc(doc(as(U.admin), 'report_photos', 'p1')))
    await assertSucceeds(getDoc(doc(as(U.officerA), 'report_photos', 'p1')))
    await assertFails(getDoc(doc(as(U.officerB), 'report_photos', 'p1')))
    await assertFails(getDoc(doc(as(U.repA), 'report_photos', 'p1')))
  })
})

describe('writing reports', () => {
  it('admin can update status', async () => {
    await assertSucceeds(updateDoc(doc(as(U.admin), 'reports', 'r1'), { status: 'verified' }))
  })
  it('admin cannot set an unknown status', async () => {
    await assertFails(updateDoc(doc(as(U.admin), 'reports', 'r1'), { status: 'banana' }))
  })
  it('admin cannot change report_code or created_at', async () => {
    await assertFails(updateDoc(doc(as(U.admin), 'reports', 'r1'), { report_code: 'RA-2026-999999' }))
    await assertFails(updateDoc(doc(as(U.admin), 'reports', 'r1'), { created_at: new Date('2020-01-01') }))
  })
  it('officers and reporters cannot update or delete', async () => {
    await assertFails(updateDoc(doc(as(U.officerA), 'reports', 'r1'), { status: 'on_scene' }))
    await assertFails(updateDoc(doc(as(U.repA), 'reports', 'r1'), { status: 'verified' }))
    await assertFails(deleteDoc(doc(as(U.repA), 'reports', 'r1')))
  })
  it('admin can create a valid report, not an invalid one', async () => {
    await assertSucceeds(setDoc(doc(as(U.admin), 'reports', 'r2'), { ...REPORT, report_code: 'RA-2026-000002' }))
    await assertFails(setDoc(doc(as(U.admin), 'reports', 'r3'), { ...REPORT, status: 'banana' }))
    await assertFails(setDoc(doc(as(U.admin), 'reports', 'r4'), { status: 'submitted' }))
  })
})

describe('users', () => {
  it('nobody can create an admin profile for themselves', async () => {
    await assertFails(setDoc(doc(as(U.stranger), 'users', U.stranger), profileOf(U.stranger, 'admin')))
    await assertFails(setDoc(doc(as(U.stranger), 'users', U.stranger), profileOf(U.stranger, 'officer')))
  })
  it('self-registration works only as an active reporter with the allowed keys', async () => {
    await assertSucceeds(setDoc(doc(as(U.stranger), 'users', U.stranger), profileOf(U.stranger, 'reporter')))
  })
  it('self-registration rejects extra keys, wrong email or another uid', async () => {
    await assertFails(setDoc(doc(as(U.stranger), 'users', U.stranger), { ...profileOf(U.stranger, 'reporter'), is_admin: true }))
    await assertFails(setDoc(doc(as(U.stranger), 'users', U.stranger), { ...profileOf(U.stranger, 'reporter'), email: 'other@example.com' }))
    await assertFails(setDoc(doc(as(U.stranger), 'users', 'someone-else'), profileOf('someone-else', 'reporter')))
  })
  it('admin can add an officer or an admin but not a reporter', async () => {
    await assertSucceeds(setDoc(doc(as(U.admin), 'users', 'new-officer'), profileOf('new-officer', 'officer')))
    await assertSucceeds(setDoc(doc(as(U.admin), 'users', 'new-admin'), profileOf('new-admin', 'admin')))
    await assertFails(setDoc(doc(as(U.admin), 'users', 'new-rep'), profileOf('new-rep', 'reporter')))
  })
  it('admin cannot turn a staff user into a reporter, but may promote a reporter', async () => {
    await assertFails(updateDoc(doc(as(U.admin), 'users', U.officerA), { role: 'reporter' }))
    await assertSucceeds(updateDoc(doc(as(U.admin), 'users', U.repA), { role: 'officer' }))
  })
  it('admin cannot change a user email', async () => {
    await assertFails(updateDoc(doc(as(U.admin), 'users', U.officerA), { email: 'x@example.com' }))
  })
  it('a user can edit only their own name and phone', async () => {
    await assertSucceeds(updateDoc(doc(as(U.repA), 'users', U.repA), { full_name: 'New Name', phone: '09123456789', updated_at: serverTimestamp() }))
    for (const patch of [{ role: 'admin' }, { status: 'active', badge_no: 'B1' }, { email: 'x@example.com' }, { badge_no: 'B1' }, { created_at: new Date() }]) {
      await assertFails(updateDoc(doc(as(U.repA), 'users', U.repA), patch))
    }
  })
  it('a user cannot edit someone else', async () => {
    await assertFails(updateDoc(doc(as(U.repA), 'users', U.repB), { full_name: 'Hacked' }))
  })
  it('read: own profile (even inactive) and admin reads all; others no', async () => {
    await assertSucceeds(getDoc(doc(as(U.adminOff), 'users', U.adminOff)))
    await assertSucceeds(getDoc(doc(as(U.admin), 'users', U.repA)))
    await assertFails(getDoc(doc(as(U.repA), 'users', U.repB)))
  })
  it('profiles can never be deleted from the client', async () => {
    await assertFails(deleteDoc(doc(as(U.admin), 'users', U.repA)))
  })
})

describe('audit trail', () => {
  const entry = (actor) => ({ action: 'report.update', actor_id: actor, created_at: serverTimestamp() })
  it('admin can append an entry as themselves', async () => {
    await assertSucceeds(addDoc(collection(as(U.admin), 'audit_logs'), entry(U.admin)))
  })
  it('entries cannot name another actor', async () => {
    await assertFails(addDoc(collection(as(U.admin), 'audit_logs'), entry(U.officerA)))
  })
  it('entries cannot be edited or deleted', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs', 'a1'), { action: 'x', actor_id: U.admin, created_at: new Date() })
    })
    await assertFails(updateDoc(doc(as(U.admin), 'audit_logs', 'a1'), { action: 'y' }))
    await assertFails(deleteDoc(doc(as(U.admin), 'audit_logs', 'a1')))
  })
  it('only admins can read', async () => {
    await assertSucceeds(getDocs(collection(as(U.admin), 'audit_logs')))
    await assertFails(getDocs(collection(as(U.officerA), 'audit_logs')))
  })
})

describe('notifications', () => {
  it('recipient can mark their own row read', async () => {
    await assertSucceeds(updateDoc(doc(as(U.admin), 'notifications', 'n1'), { read: true }))
  })
  it('recipient cannot edit anything else, or mark unread', async () => {
    await assertFails(updateDoc(doc(as(U.admin), 'notifications', 'n1'), { title: 'Changed' }))
    await assertFails(updateDoc(doc(as(U.admin), 'notifications', 'n1'), { read: false }))
  })
  it("another user cannot read or touch someone else's row", async () => {
    await assertFails(getDoc(doc(as(U.officerA), 'notifications', 'n1')))
    await assertFails(updateDoc(doc(as(U.officerA), 'notifications', 'n1'), { read: true }))
  })
  it('only admins create notifications, and they must be unread', async () => {
    const n = { user_id: U.officerA, title: 'T', message: 'M', read: false, created_at: new Date() }
    await assertSucceeds(addDoc(collection(as(U.admin), 'notifications'), n))
    await assertFails(addDoc(collection(as(U.admin), 'notifications'), { ...n, read: true }))
    await assertFails(addDoc(collection(as(U.officerA), 'notifications'), n))
  })
})

describe('settings and counters', () => {
  it('active users read settings, only admins write', async () => {
    await assertSucceeds(getDoc(doc(as(U.repA), 'settings', 's1')))
    await assertFails(getDoc(doc(as(U.stranger), 'settings', 's1')))
    await assertFails(getDoc(doc(as(U.adminOff), 'settings', 's1')))
    await assertFails(updateDoc(doc(as(U.repA), 'settings', 's1'), { value: 2 }))
    await assertSucceeds(updateDoc(doc(as(U.admin), 'settings', 's1'), { value: 2 }))
  })
  it('counters are admin only', async () => {
    await assertSucceeds(getDoc(doc(as(U.admin), 'counters', 'reports_2026')))
    await assertFails(getDoc(doc(as(U.repA), 'counters', 'reports_2026')))
    await assertFails(setDoc(doc(as(U.repA), 'counters', 'reports_2026'), { value: 9 }))
  })
  it('anything else is closed', async () => {
    await assertFails(setDoc(doc(as(U.admin), 'random', 'x'), { a: 1 }))
  })
})
