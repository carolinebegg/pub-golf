import { useEffect, useMemo, useRef, useState } from 'react'
import TeamSelector from './TeamSelector'

const STORAGE_KEY = 'pub-golf-team-login'

export default function TeamLogin({
  teams = [],
  loggedInTeam = null,
  summary = null,
  onLogin,
  onLogout,
  onEnterScore,
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(loggedInTeam?.id || '')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const joinCodeInputRef = useRef(null)

  useEffect(() => {
    if (loggedInTeam || !selectedTeamId) return

    const nextFrame = window.requestAnimationFrame(() => {
      joinCodeInputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(nextFrame)
    }
  }, [selectedTeamId, loggedInTeam])

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId) || null
  }, [teams, selectedTeamId])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!selectedTeam) {
      setError('Choose your team.')
      return
    }

    if (!joinCode.trim()) {
      setError('Enter your join code.')
      return
    }

    if (joinCode.trim() !== selectedTeam.join_code) {
      setError('Incorrect join code.')
      return
    }

    const safeTeam = {
      id: selectedTeam.id,
      theme: selectedTeam.theme,
      emoji: selectedTeam.emoji,
      members: selectedTeam.members || [],
      join_code: selectedTeam.join_code,
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTeam))
    } catch {
      // ignore localStorage failure
    }

    onLogin?.(safeTeam)
    setJoinCode('')
    setMessage(`Logged in as ${selectedTeam.theme || 'Team'}.`)
  }

  function handleLogoutClick() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore localStorage failure
    }

    setSelectedTeamId('')
    setJoinCode('')
    setError('')
    setMessage('')
    onLogout?.()
  }

  if (loggedInTeam) {
    const totalHoles = summary?.totalHoles ?? 0
    const progressLabel = totalHoles > 0 ? `${summary?.completedHoles ?? 0} / ${totalHoles}` : '—'
    const primaryTeamName = loggedInTeam.theme || 'Team'

    return (
      <section className="team-panel-wrap">
        <div className="team-panel-card">
          {loggedInTeam.emoji ? (
            <span className="team-panel-emoji" aria-hidden="true">
              {loggedInTeam.emoji}
            </span>
          ) : null}
          <div>
            <p className="team-panel-eyebrow">Logged In</p>
            <h2 className="team-panel-title">{primaryTeamName}</h2>
          </div>

          {loggedInTeam.members?.length ? (
            <div className="team-members-row">
              {loggedInTeam.members.map((member) => (
                <span key={member} className="team-member-pill">
                  {member}
                </span>
              ))}
            </div>
          ) : (
            <p className="team-panel-muted">No team members listed yet.</p>
          )}

          <div className="team-summary-grid">
            <div className="team-summary-item">
              <span className="team-summary-label">Score</span>
              <span className="team-summary-value">
                {summary?.totalScore !== null && summary?.totalScore !== undefined
                  ? summary.totalScore
                  : '—'}
              </span>
            </div>

            <div className="team-summary-item">
              <span className="team-summary-label">Progress</span>
              <span className="team-summary-value">{progressLabel}</span>
            </div>

            <div className="team-summary-item team-summary-item-wide">
              <span className="team-summary-label">Current Hole</span>
              <span className="team-summary-value team-summary-note">
                {summary?.currentHoleName || 'Hole progress unavailable'}
              </span>
            </div>
          </div>

          <div className="team-panel-actions">
            <button
              type="button"
              onClick={onEnterScore}
              className="primary-button"
              disabled={!summary?.totalHoles}
            >
              Enter Score
            </button>

            <button type="button" onClick={handleLogoutClick} className="secondary-button">
              Log out
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="team-panel-wrap">
      <form onSubmit={handleSubmit} className="team-panel-card">
        <div>
          <p className="team-panel-eyebrow">Team Access</p>
          <h2 className="team-panel-title">Team Login</h2>
          <p className="team-panel-subtitle">Select your team and enter the join code to submit scores.</p>
        </div>

        <TeamSelector
          teams={teams}
          selectedTeamId={selectedTeamId}
          onChange={(value) => setSelectedTeamId(value)}
          label="Team"
        />

        <label className="team-field">
          <span className="team-field-label">Join code</span>
          <input
            ref={joinCodeInputRef}
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter join code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="team-input"
          />
        </label>

        <button type="submit" className="primary-button">
          Join Game
        </button>

        {message ? <p className="team-success">{message}</p> : null}
        {error ? <p className="team-error">{error}</p> : null}
      </form>
    </section>
  )
}

export const TEAM_LOGIN_STORAGE_KEY = STORAGE_KEY