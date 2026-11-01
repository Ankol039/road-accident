/**
 * Users. Replaces admin-users.php + js-release-20261020b/pages/admin-users.js.
 *
 * The directory of staff: administrators, traffic officers and public users.
 * A filter bar (search, role, status) over a paged table, and one dialog that
 * both adds a user and edits one.
 *
 * Adding a user opens a Firebase sign-in account as well as the Firestore
 * profile — see src/services/users.service.js for why that goes through the
 * Identity Toolkit REST API rather than the client SDK.
 */
import { useMemo, useState } from 'react'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { useActor } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import {
  listUsers,
  openCasesByOfficer,
  createStaffUser,
  updateStaffUser,
  sendPasswordReset,
  ROLE_LABELS,
} from '../services/users.service.js'
import Modal from '../components/Modal.jsx'
import Pager from '../components/Pager.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDate } from '../utils/date.js'
import { errorMessage, ValidationError } from '../lib/errors.js'
import { ADMIN_CREATABLE_ROLES } from '../lib/constants.js'

const PAGE_SIZE = 25

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  role: 'officer',
  status: 'active',
  badge_no: '',
  password: '',
}

export default function Users() {
  const actor = useActor()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState(null) // the user being edited, null = new
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const debouncedQ = useDebounced(q, 300)

  const { data: users, loading, error, reload } = useAsync(
    () => listUsers({ role: role || undefined, status: status || undefined, search: debouncedQ }),
    [debouncedQ, role, status],
    [],
  )

  // The workload of each officer, in its own load so a missing index cannot
  // blank the table.
  const { data: openCases } = useAsync(() => openCasesByOfficer(), [], {})

  const rows = users || []
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  )

  const isSelf = (uid) => uid === actor?.uid

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setMessage('')
    setDialogOpen(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'officer',
      status: user.status || 'active',
      badge_no: user.badge_no || '',
      password: '',
    })
    setErrors({})
    setMessage('')
    setDialogOpen(true)
  }

  const close = () => {
    setEditing(null)
    setDialogOpen(false)
    setErrors({})
    setMessage('')
  }

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      if (editing) {
        const { changed } = await updateStaffUser(
          editing.id,
          {
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
            status: form.status,
            badge_no: form.badge_no,
          },
          actor,
          editing,
        )
        toast.success(changed.length ? 'User saved' : 'Nothing changed')
      } else {
        await createStaffUser(form, actor)
        toast.success('User created')
      }
      close()
      reload()
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.errors)
        setMessage('Please fix the highlighted fields')
      } else {
        setMessage(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    setBusy(true)
    try {
      await sendPasswordReset(form.email)
      toast.success(`A reset link was sent to ${form.email}`)
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const self = editing ? isSelf(editing.id) : false
  const roleOptions = editing?.role === 'reporter'
    ? [...ADMIN_CREATABLE_ROLES, editing.role]
    : ADMIN_CREATABLE_ROLES

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Users</h1>
        <button type="button" className="btn btn-guide" onClick={openAdd}>
          Add a user
        </button>
      </div>

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
        }}
      >
        <input
          type="search"
          className="form-control"
          name="q"
          placeholder="Search name, email or badge"
          aria-label="Search users"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="form-select"
          name="role"
          aria-label="Role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All roles</option>
          <option value="admin">Administrators</option>
          <option value="officer">Traffic officers</option>
          <option value="reporter">Public users</option>
        </select>
        <select
          className="form-select"
          name="status"
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Active and inactive</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit" className="btn btn-outline-secondary btn-sm">
          Search
        </button>
      </form>

      {error && (
        <div className="alert alert-danger" role="alert">
          {errorMessage(error, 'Could not load the users.')}
        </div>
      )}

      <div className="table-responsive panel p-0">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-secondary">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="text-secondary">
                  No users match.
                </td>
              </tr>
            )}
            {visible.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.full_name}</strong>
                  {isSelf(u.id) && <span className="small text-secondary"> (you)</span>}
                  <span className="small text-secondary d-block">{u.email}</span>
                </td>
                <td>
                  {ROLE_LABELS[u.role] || u.role}
                  {u.badge_no && (
                    <span className="small text-secondary d-block">Badge {u.badge_no}</span>
                  )}
                </td>
                <td>{u.phone || ''}</td>
                <td>
                  {/* The green and red pills are the ones the app already has. */}
                  <StatusBadge
                    status={u.status === 'active' ? 'verified' : 'rejected'}
                    label={u.status === 'active' ? 'Active' : 'Inactive'}
                  />
                  {u.role === 'officer' && (
                    <span className="small text-secondary d-block">
                      {openCases?.[u.id] || 0} open case(s)
                    </span>
                  )}
                </td>
                <td className="small">{formatDate(u.created_at)}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => openEdit(u)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={currentPage}
        totalPages={totalPages}
        total={rows.length}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        hasPrev={currentPage > 1}
        hasNext={currentPage < totalPages}
      />

      <Modal
        open={dialogOpen}
        title={editing ? `Edit ${editing.full_name}` : 'Add a user'}
        onClose={close}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn-guide" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {message ? (
            <div className="alert alert-danger" role="alert">
              {message}
            </div>
          ) : null}

          <div className="mb-3">
            <label className="form-label" htmlFor="u-name">
              Full name
            </label>
            <input
              id="u-name"
              name="full_name"
              className={`form-control${errors.full_name ? ' is-invalid' : ''}`}
              value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
            />
            {errors.full_name ? (
              <div className="invalid-feedback d-block">{errors.full_name}</div>
            ) : null}
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="u-email">
              Email
            </label>
            <input
              id="u-email"
              name="email"
              type="email"
              className={`form-control${errors.email ? ' is-invalid' : ''}`}
              value={form.email}
              readOnly={Boolean(editing)}
              onChange={(e) => setField('email', e.target.value)}
            />
            {errors.email ? (
              <div className="invalid-feedback d-block">{errors.email}</div>
            ) : null}
            {editing ? (
              <div className="form-text">
                The sign-in email is fixed once the account exists.
              </div>
            ) : null}
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="u-phone">
              Mobile number (optional)
            </label>
            <input
              id="u-phone"
              name="phone"
              className={`form-control${errors.phone ? ' is-invalid' : ''}`}
              placeholder="09XXXXXXXXX"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
            {errors.phone ? (
              <div className="invalid-feedback d-block">{errors.phone}</div>
            ) : null}
          </div>

          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="form-label" htmlFor="u-role">
                Role
              </label>
              <select
                id="u-role"
                name="role"
                className={`form-select${errors.role ? ' is-invalid' : ''}`}
                value={form.role}
                disabled={self}
                onChange={(e) => setField('role', e.target.value)}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {errors.role ? <div className="invalid-feedback d-block">{errors.role}</div> : null}
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="u-status">
                Status
              </label>
              <select
                id="u-status"
                name="status"
                className={`form-select${errors.status ? ' is-invalid' : ''}`}
                value={form.status}
                disabled={self}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive (cannot log in)</option>
              </select>
              {errors.status ? (
                <div className="invalid-feedback d-block">{errors.status}</div>
              ) : null}
            </div>
          </div>

          <p className="small text-secondary">
            Public users register themselves in the mobile app. Add administrators and traffic officers here.
            Administrators log in on this website; traffic officers use the mobile app.
          </p>
          {self ? (
            <p className="small text-secondary">
              You cannot change your own role or deactivate yourself.
            </p>
          ) : null}

          {form.role === 'officer' ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="u-badge">
                Badge number
              </label>
              <input
                id="u-badge"
                name="badge_no"
                className={`form-control${errors.badge_no ? ' is-invalid' : ''}`}
                placeholder="TO-0045"
                value={form.badge_no}
                onChange={(e) => setField('badge_no', e.target.value)}
              />
              {errors.badge_no ? (
                <div className="invalid-feedback d-block">{errors.badge_no}</div>
              ) : null}
            </div>
          ) : null}

          {editing ? (
            <div className="mb-1">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={resetPassword}
                disabled={busy || !form.email}
              >
                Send password reset email
              </button>
              <div className="form-text">
                The person chooses the new password themselves, from the link in the email.
              </div>
            </div>
          ) : (
            <div className="mb-1">
              <label className="form-label" htmlFor="u-pass">
                Password
              </label>
              <input
                id="u-pass"
                name="password"
                type="password"
                autoComplete="new-password"
                className={`form-control${errors.password ? ' is-invalid' : ''}`}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
              />
              {errors.password ? (
                <div className="invalid-feedback d-block">{errors.password}</div>
              ) : null}
              <div className="form-text">
                At least 8 characters with letters and numbers. Give it to the person privately.
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
