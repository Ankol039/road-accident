/**
 * Login page. Replaces login.php + pages/login.js.
 *
 * Firebase Auth signs the admin in; no token juggling is needed (the SDK keeps
 * the session). After sign-in we honour ?next= so deep links keep working.
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import States from '../components/States.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { errorMessage } from '../lib/errors.js'
import { sendReset } from '../services/auth.service.js'

// Match Landing.jsx's 46 trails and squared depth distribution. Deterministic
// phases keep traffic spread out without timers or random changes on render.
const ROAD_STREAKS = Array.from({ length: 46 }, (_, index) => {
  const depth = ((index * 17) % 46 + 0.5) / 46
  const duration = 1.2 / ((0.002 + depth * 0.006) * 60)
  return {
    '--rr-streak-y': `${(46 + depth * depth * 54 * 0.95).toFixed(2)}%`,
    '--rr-streak-length': `${(30 + depth * 140).toFixed(2)}px`,
    '--rr-streak-opacity': (0.35 + depth * 0.3).toFixed(2),
    '--rr-streak-duration': `${duration.toFixed(2)}s`,
    '--rr-streak-delay': `${(-duration * ((index * 0.618 + 0.2) % 1)).toFixed(2)}s`,
    '--rr-streak-direction': index % 2 ? 'reverse' : 'normal',
    '--rr-streak-color': index % 2 ? '#f3efe6' : '#e4572e',
  }
})

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

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
    <div className="auth-page rr-login-page">
      <div className="rr-login-tape" aria-hidden="true" />
      <div className="rr-login-glow" aria-hidden="true" />
      <div className="rr-login-road" aria-hidden="true">
        {ROAD_STREAKS.map((style, index) => <span key={index} className="rr-login-streak" style={style} />)}
      </div>
      <form className="auth-card rr-login-card" id="login-form" onSubmit={onSubmit} noValidate>
        <div className="rr-login-lamps" aria-hidden="true"><span /><span /><span /></div>
        <Link to="/" className="text-decoration-none d-inline-block mb-3">
          <Brand />
        </Link>
        <span className="rr-login-eyebrow">Bulacan admin portal</span>
        <h1>Staff log in</h1>
        <p className="small text-secondary">
          This portal is for authorized administrators and traffic officers. Reporters use the RoadReport mobile app.
        </p>



        <div className="mb-3">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <div className="rr-login-field">
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
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <div className="rr-login-field">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            className="form-control"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" id="password-toggle" className="rr-login-toggle" aria-controls="password" aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((value) => !value)}>
            <svg className="rr-login-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
            <svg className="rr-login-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.8M6 6C3.4 8.3 2 12 2 12s3.5 7 10 7c1.8 0 3.5-.6 5-1.5" /></svg>
          </button>
          </div>
        </div>

        {message && (
          <div
            id="message"
            className={message.error ? 'rr-login-error' : 'rr-login-success'}
          >
            <States error={message.error ? message.text : null}>
              <p className="rr-state" role="status">{message.text}</p>
            </States>
          </div>
        )}

        <button type="submit" className="btn btn-guide w-100" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>

        <div className="d-flex justify-content-between align-items-baseline mt-3">
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onForgot}>
            Forgot password
          </button>
          <Link to="/" className="small text-secondary">
            Back to home
          </Link>
        </div>
      </form>
      <p className="rr-login-foot" aria-hidden="true">© RoadReport · Bulacan, Philippines · For authorized administrators and traffic officers</p>
    </div>
  )
}
