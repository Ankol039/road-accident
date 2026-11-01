/**
 * Login page. Replaces login.php + pages/login.js.
 *
 * Firebase Auth signs the admin in; no token juggling is needed (the SDK keeps
 * the session). After sign-in we honour ?next= so deep links keep working.
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { errorMessage } from '../lib/errors.js'
import { sendReset } from '../services/auth.service.js'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate(next.startsWith('/') ? next : '/admin', { replace: true })
    } catch (error) {
      setMessage({ text: errorMessage(error, 'Could not sign you in.'), error: true })
    } finally {
      setBusy(false)
    }
  }

  const onForgot = async () => {
    if (!email) {
      setMessage({ text: 'Type your email first, then press “Forgot password”.', error: true })
      return
    }
    try {
      await sendReset(email)
      setMessage({ text: 'Password reset email sent. Check your inbox.', error: false })
    } catch (error) {
      setMessage({ text: errorMessage(error), error: true })
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" id="login-form" onSubmit={onSubmit} noValidate>
        <Link to="/" className="text-decoration-none d-inline-block mb-3">
          <Brand />
        </Link>
        <h1 className="h4">Administrator log in</h1>
        <p className="small text-secondary">
          This portal is for Bulacan traffic administrators. Officers and reporters use the
          RoadReport mobile app.
        </p>

        {message && (
          <div
            id="message"
            className={`alert ${message.error ? 'alert-danger' : 'alert-success'} py-2`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-control"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="form-control"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-guide w-100" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>

        <div className="d-flex justify-content-between align-items-center mt-3">
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onForgot}>
            Forgot password
          </button>
          <Link to="/" className="small text-secondary">
            Back to home
          </Link>
        </div>
      </form>
    </div>
  )
}
