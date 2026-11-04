import { useState } from 'react'

export default function OrganizerAuth({
  mode = 'sign-up',
  notice = '',
  onSignUp,
  onSignIn,
  onResetPassword,
  onSetPassword,
  onBack,
  onMode,
}) {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      let result
      if (mode === 'recover') {
        result = await onSetPassword?.({ password })
      } else if (mode === 'forgot') {
        result = await onResetPassword?.({ email })
      } else if (mode === 'sign-in') {
        result = await onSignIn?.({ email, password })
      } else {
        result = await onSignUp?.({ firstName, email, password })
      }
      if (result?.message && result.ok === false) setError(result.message)
      else if (result?.message) setMessage(result.message)
    } catch (authError) {
      setError(authError?.message || 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = {
    'sign-up': 'Create an organizer account',
    'sign-in': 'Organizer sign in',
    forgot: 'Reset your password',
    recover: 'Choose a new password',
  }[mode]

  return (
    <section className="team-panel-wrap">
      <form onSubmit={submit} className="team-panel-card">
        <div>
          <p className="team-panel-eyebrow">Organizer</p>
          <h2 className="team-panel-title">{title}</h2>
          {mode === 'sign-up' ? (
            <p className="team-panel-subtitle">
              Use your email and first name. This account can create more than one course.
            </p>
          ) : null}
        </div>

        {mode === 'sign-up' ? (
          <label className="team-field">
            <span className="team-field-label">First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              className="team-input"
            />
          </label>
        ) : null}

        {mode !== 'recover' ? (
          <label className="team-field">
            <span className="team-field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="team-input"
            />
          </label>
        ) : null}

        {mode !== 'forgot' ? (
          <label className="team-field">
            <span className="team-field-label">{mode === 'recover' ? 'New password' : 'Password'}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="team-input"
            />
          </label>
        ) : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting
            ? 'Working...'
            : mode === 'sign-in'
              ? 'Sign in'
              : mode === 'forgot'
                ? 'Send reset email'
                : mode === 'recover'
                  ? 'Save password'
                  : 'Create account'}
        </button>

        {mode === 'sign-up' ? (
          <button type="button" className="text-button" onClick={() => onMode?.('sign-in')}>
            Already have an account? Sign in
          </button>
        ) : null}
        {mode === 'sign-in' ? (
          <div className="auth-links">
            <button type="button" className="text-button" onClick={() => onMode?.('sign-up')}>
              Create an account
            </button>
            <button type="button" className="text-button" onClick={() => onMode?.('forgot')}>
              Forgot password
            </button>
          </div>
        ) : null}
        {mode === 'forgot' ? (
          <button type="button" className="text-button" onClick={() => onMode?.('sign-in')}>
            Back to sign in
          </button>
        ) : null}

        {message || notice ? <p className="team-success">{message || notice}</p> : null}
        {error ? <p className="team-error">{error}</p> : null}

        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
      </form>
    </section>
  )
}
