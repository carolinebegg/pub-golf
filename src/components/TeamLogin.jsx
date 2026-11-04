import { useState } from 'react'

export default function TeamLogin({
  loggedInTeam = null,
  summary = null,
  restoring = false,
  notice = '',
  initialJoin = null,
  onJoin,
  onLeave,
  onEnterScore,
  onBack,
}) {
  const [gameCode, setGameCode] = useState(initialJoin?.gameCode || '')
  const [teamCode, setTeamCode] = useState(initialJoin?.teamCode || '')
  const [playerName, setPlayerName] = useState(initialJoin?.playerName || '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!gameCode.trim() || !teamCode.trim() || !playerName.trim()) {
      setError('Enter a game code, team code, and player name.')
      return
    }

    setSubmitting(true)
    try {
      const message = await onJoin?.({
        gameCode,
        teamCode,
        playerName,
      })
      if (message) setError(message)
    } catch (joinError) {
      setError(joinError?.message || 'Could not join that team.')
    } finally {
      setSubmitting(false)
    }
  }

  if (restoring) {
    return (
      <section className="team-panel-wrap">
        <div className="team-panel-card">
          <p className="team-panel-eyebrow">Team access</p>
          <h2 className="team-panel-title">Checking your sign-in</h2>
          <p className="team-panel-muted">Confirming your team with the server.</p>
        </div>
      </section>
    )
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
            <p className="team-panel-eyebrow">Joined</p>
            <h2 className="team-panel-title">{primaryTeamName}</h2>
            {loggedInTeam.playerName ? (
              <p className="team-panel-subtitle">Playing as {loggedInTeam.playerName}</p>
            ) : null}
          </div>

          {loggedInTeam.members?.length ? (
            <div className="team-members-row">
              {loggedInTeam.members.map((member) => (
                <span
                  key={member}
                  className={`team-member-pill${member === loggedInTeam.playerName ? ' is-you' : ''}`}
                >
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
              <span className="team-summary-label">Ranking</span>
              <span className="team-summary-value">
                {summary?.rank != null && Number.isFinite(summary.rank)
                  ? `#${summary.rank}`
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

            <button type="button" onClick={onLeave} className="secondary-button">
              Leave course
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
          <p className="team-panel-eyebrow">Team access</p>
          <h2 className="team-panel-title">Join a team</h2>
          <p className="team-panel-subtitle">
            Enter the game code, team code, and the player name already on that team.
          </p>
        </div>

        <label className="team-field">
          <span className="team-field-label">Game code</span>
          <input
            type="text"
            value={gameCode}
            onChange={(event) => setGameCode(event.target.value)}
            placeholder="Game code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="team-input"
          />
        </label>

        <label className="team-field">
          <span className="team-field-label">Team code</span>
          <input
            type="text"
            value={teamCode}
            onChange={(event) => setTeamCode(event.target.value)}
            placeholder="Team code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="team-input"
          />
        </label>

        <label className="team-field">
          <span className="team-field-label">Your name</span>
          <input
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Name on the team"
            autoComplete="name"
            className="team-input"
          />
        </label>

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Joining...' : 'Join team'}
        </button>

        {notice ? <p className="team-error">{notice}</p> : null}
        {error ? <p className="team-error">{error}</p> : null}
        {onBack ? (
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        ) : null}
      </form>
    </section>
  )
}
