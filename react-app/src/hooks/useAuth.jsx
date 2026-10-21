/**
 * Auth context: the signed-in Firebase user plus their Firestore profile.
 *
 * On boot we:
 *   1. wait for Firebase Auth to restore the session
 *   2. load (or backfill) the `users/{uid}` profile document
 *   3. check the role is allowed into this portal (STAFF_ROLES)
 *
 * Anything not allowed is signed out, matching the PHP app's guard which
 * redirected non-admins back to the login page.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { signIn as svcSignIn, signOut as svcSignOut, watchAuth, loadProfile, ensureProfile, canUsePortal } from '../services/auth.service.js'
import { errorMessage } from '../lib/errors.js'
import { isFirebaseConfigured } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      setError('Firebase is not configured yet. Add your web app keys to .env.')
      return undefined
    }
    return watchAuth(async (fbUser) => {
      if (!fbUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const found = (await loadProfile(fbUser.uid)) || (await ensureProfile(fbUser))
        if (!canUsePortal(found)) {
          await svcSignOut()
          setUser(null)
          setProfile(null)
          setError('This account is not an administrator. Use the RoadReport mobile app instead.')
        } else {
          setUser(fbUser)
          setProfile(found)
        }
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    const fbUser = await svcSignIn(email, password)
    const found = (await loadProfile(fbUser.uid)) || (await ensureProfile(fbUser))
    if (!canUsePortal(found)) {
      await svcSignOut()
      throw new Error('This account is not an administrator.')
    }
    setUser(fbUser)
    setProfile(found)
    return fbUser
  }, [])

  const signOut = useCallback(async () => {
    await svcSignOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ user, profile, loading, error, setError, signIn, signOut, isAdmin: profile?.role === 'admin' }),
    [user, profile, loading, error, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Convenience: the actor object the audit log expects. */
export function useActor() {
  const { user, profile } = useAuth()
  if (!user) return null
  return { uid: user.uid, id: user.uid, email: user.email, role: profile?.role, full_name: profile?.full_name }
}
