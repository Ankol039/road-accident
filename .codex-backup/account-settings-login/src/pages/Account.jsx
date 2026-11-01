/**
 * My account. Replaces account.php + js-release-20261020b/pages/account.js.
 *
 * Edit name and phone; the email is read-only (email changes are made by an
 * administrator). Change the password through changePassword() which re-auths
 * before updating.
 */
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { changePassword } from '../services/auth.service.js'
import { updateUser } from '../services/users.service.js'
import { useToast } from '../hooks/useToast.jsx'
import { ValidationError } from '../lib/errors.js'

export default function Account() {
  const { profile, user, reloadProfile } = useAuth()
  const { toast } = useToast()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErrors, setPwErrors] = useState({})

  const onSaveProfile = async (e) => {
    e.preventDefault()
    setProfileErrors({})
    if (!user?.uid) return
    setProfileBusy(true)
    try {
      await updateUser(user.uid, { full_name: fullName.trim(), phone: phone.trim() || null }, profile)
      await reloadProfile()
      toast.success('Profile saved')
    } catch (error) {
      if (error instanceof ValidationError) setProfileErrors(error.errors || {})
      else toast.failure(error?.message || 'Could not save the profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  const onChangePassword = async (e) => {
    e.preventDefault()
    setPwErrors({})
    if (newPw !== confirmPw) {
      setPwErrors({ password_confirmation: 'The passwords do not match.' })
      return
    }
    if ((newPw || '').length < 8) {
      setPwErrors({ password: 'Use at least 8 characters.' })
      return
    }
    setPwBusy(true)
    try {
      await changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password changed')
    } catch (error) {
      const msg = error?.message || 'Could not change the password.'
      if (/wrong-password|invalid-credential|auth\/wrong/i.test(msg)) {
        setPwErrors({ current_password: 'The current password is incorrect.' })
      } else if (/weak-password/i.test(msg)) {
        setPwErrors({ password: 'Choose a stronger password.' })
      } else if (/requires-recent-login/i.test(msg)) {
        setPwErrors({ current_password: 'Sign in again, then change your password.' })
      } else {
        toast.failure(msg)
      }
    } finally {
      setPwBusy(false)
    }
  }

  const roleLabel =
    profile?.role === 'admin' ? 'Administrator' : profile?.role === 'officer' ? 'Traffic officer' : profile?.role || ''

  return (
    <div className="form-page">
      <h1 className="h3 mb-1">My account</h1>
      <p className="text-secondary">
        {roleLabel}
        {profile?.badge_no ? `, badge ${profile.badge_no}` : ''}
      </p>
      <div className="row g-4">
        <div className="col-md-7">
          <form className="panel" id="profile-form" noValidate onSubmit={onSaveProfile}>
            <h2 className="h5">Profile</h2>
            <div className="mb-3">
              <label className="form-label" htmlFor="full_name">
                Full name
              </label>
              <input
                id="full_name"
                className={`form-control${profileErrors.full_name ? ' is-invalid' : ''}`}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              {profileErrors.full_name && <div className="invalid-feedback">{profileErrors.full_name}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={profile?.email || user?.email || ''}
                readOnly
              />
              <div className="form-text">Email changes are made by an administrator.</div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                className="form-control"
                placeholder="09XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <button className="btn btn-guide" type="submit" disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>
        <div className="col-md-5">
          <form className="panel" id="password-form" noValidate onSubmit={onChangePassword}>
            <h2 className="h5">Change password</h2>
            <div className="mb-3">
              <label className="form-label" htmlFor="pw-current">
                Current password
              </label>
              <input
                id="pw-current"
                type="password"
                className={`form-control${pwErrors.current_password ? ' is-invalid' : ''}`}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              {pwErrors.current_password && <div className="invalid-feedback">{pwErrors.current_password}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="pw-new">
                New password
              </label>
              <input
                id="pw-new"
                type="password"
                className={`form-control${pwErrors.password ? ' is-invalid' : ''}`}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              {pwErrors.password && <div className="invalid-feedback">{pwErrors.password}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="pw-confirm">
                Confirm new password
              </label>
              <input
                id="pw-confirm"
                type="password"
                className={`form-control${pwErrors.password_confirmation ? ' is-invalid' : ''}`}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
              {pwErrors.password_confirmation && <div className="invalid-feedback">{pwErrors.password_confirmation}</div>}
            </div>
            <button className="btn btn-guide" type="submit" disabled={pwBusy}>
              {pwBusy ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
