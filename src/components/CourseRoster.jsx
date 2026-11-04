import { useEffect, useState } from 'react'
import {
  buildRosterGroups,
  createCoursePlayer,
  createCourseTeam,
  DELETE_PLAYER_WARNING,
  DELETE_TEAM_WARNING,
  deleteCoursePlayer,
  deleteCourseTeam,
  loadCourseRoster,
  moveCoursePlayer,
  RELEASE_SIGN_IN_WARNING,
  releaseCoursePlayerSignIn,
  renameCourseTeam,
} from '../lib/roster'

export default function CourseRoster({ courseId, client }) {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [claimedPlayerIds, setClaimedPlayerIds] = useState([])
  const [claimsMessage, setClaimsMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadCourseRoster(client, courseId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.message)
        setLoading(false)
        return
      }
      setTeams(result.teams)
      setPlayers(result.players)
      setClaimedPlayerIds(result.claimedPlayerIds)
      setClaimsMessage(result.claimsMessage || '')
      setLoading(false)
    }).catch((loadError) => {
      if (cancelled) return
      setError(loadError?.message || 'The roster could not be loaded.')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [client, courseId])

  async function reload() {
    const result = await loadCourseRoster(client, courseId)
    if (!result.ok) {
      setError(result.message)
      return result
    }
    setTeams(result.teams)
    setPlayers(result.players)
    setClaimedPlayerIds(result.claimedPlayerIds)
    setClaimsMessage(result.claimsMessage || '')
    return result
  }

  async function run(action, success) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      if (!result?.ok) {
        setError(result?.message || 'The roster could not be updated.')
        return result
      }
      const refreshed = await reload()
      if (refreshed?.ok) setNotice(success)
      return result
    } catch (actionError) {
      const message = actionError?.message || 'The roster could not be updated.'
      setError(message)
      return { ok: false, message }
    } finally {
      setBusy(false)
    }
  }

  return (
    <RosterView
      teams={teams}
      players={players}
      claimedPlayerIds={claimedPlayerIds}
      loading={loading}
      busy={busy}
      notice={notice}
      error={error}
      claimsMessage={claimsMessage}
      onCreateTeam={(name) => run(
        () => createCourseTeam(client, { courseId, name, teams }),
        'Team added.',
      )}
      onRenameTeam={(teamId, name) => run(
        () => renameCourseTeam(client, { courseId, teamId, name, teams }),
        'Team renamed. The join code is unchanged.',
      )}
      onDeleteTeam={(teamId) => run(
        () => deleteCourseTeam(client, { courseId, teamId }),
        'Team deleted. Its players are now unassigned.',
      )}
      onCreatePlayer={(name, teamId) => run(
        () => createCoursePlayer(client, { courseId, name, teamId, teams, players }),
        'Player added.',
      )}
      onMovePlayer={(playerId, teamId) => run(
        () => moveCoursePlayer(client, { courseId, playerId, teamId, teams, players }),
        teamId ? 'Player moved.' : 'Player unassigned.',
      )}
      onDeletePlayer={(playerId) => run(
        () => deleteCoursePlayer(client, { courseId, playerId, players }),
        'Player removed from the course.',
      )}
      onReleaseSignIn={(playerId) => run(
        () => releaseCoursePlayerSignIn(client, { courseId, playerId, players }),
        'Sign-in released. The player can join again.',
      )}
    />
  )
}

export function RosterView({
  teams = [],
  players = [],
  claimedPlayerIds = [],
  loading = false,
  busy = false,
  notice = '',
  error = '',
  claimsMessage = '',
  initialPending = null,
  onCreateTeam,
  onRenameTeam,
  onDeleteTeam,
  onCreatePlayer,
  onMovePlayer,
  onDeletePlayer,
  onReleaseSignIn,
}) {
  const groups = buildRosterGroups(teams, players, claimedPlayerIds)
  const locked = busy || loading
  const [teamName, setTeamName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerTeamId, setPlayerTeamId] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [pending, setPending] = useState(initialPending)
  const [copiedId, setCopiedId] = useState(null)
  const [copyError, setCopyError] = useState('')

  async function addTeam(event) {
    event.preventDefault()
    const result = await onCreateTeam?.(teamName)
    if (result?.ok) setTeamName('')
  }

  async function addPlayer(event) {
    event.preventDefault()
    const result = await onCreatePlayer?.(playerName, playerTeamId || null)
    if (result?.ok) setPlayerName('')
  }

  async function saveRename(event) {
    event.preventDefault()
    const result = await onRenameTeam?.(renamingId, renameValue)
    if (result?.ok) setRenamingId(null)
  }

  async function copyCode(team) {
    if (!team.join_code) return
    try {
      await navigator.clipboard.writeText(team.join_code)
      setCopiedId(team.id)
      setCopyError('')
    } catch {
      setCopiedId(null)
      setCopyError('Select the team code and copy it manually.')
    }
  }

  return (
    <div className="roster-stack">
      {loading ? <p className="team-panel-muted">Loading teams and players...</p> : null}
      {claimsMessage ? <p className="team-panel-muted">{claimsMessage}</p> : null}
      {notice ? <p className="team-success" role="status">{notice}</p> : null}
      {error ? <p className="team-error" role="alert">{error}</p> : null}
      {copyError ? <p className="team-error" role="alert">{copyError}</p> : null}

      <form onSubmit={addTeam} className="roster-card">
        <h3 className="roster-heading">Add a team</h3>
        <label className="team-field">
          <span className="team-field-label">Team name</span>
          <input
            type="text"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            className="team-input"
            autoComplete="off"
            disabled={locked}
          />
        </label>
        <button type="submit" className="primary-button" disabled={locked}>
          Add team
        </button>
      </form>

      <form onSubmit={addPlayer} className="roster-card">
        <h3 className="roster-heading">Add a player</h3>
        <label className="team-field">
          <span className="team-field-label">First name</span>
          <input
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="team-input"
            autoComplete="off"
            disabled={locked}
          />
        </label>
        <label className="team-field">
          <span className="team-field-label">Team</span>
          <select
            className="team-input"
            value={playerTeamId}
            onChange={(event) => setPlayerTeamId(event.target.value)}
            disabled={locked}
          >
            <option value="">Unassigned</option>
            {groups.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.theme}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary-button" disabled={locked}>
          Add player
        </button>
      </form>

      {!loading && groups.teams.length === 0 ? (
        <p className="team-panel-muted">No teams yet. Add one to get a join code.</p>
      ) : null}

      {groups.teams.map((team) => (
        <article key={team.id} className="roster-card">
          {renamingId === team.id ? (
            <form onSubmit={saveRename} className="roster-stack">
              <label className="team-field">
                <span className="team-field-label">Team name</span>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="team-input"
                  autoComplete="off"
                  disabled={locked}
                />
              </label>
              <div className="roster-actions">
                <button type="submit" className="primary-button" disabled={locked}>Save name</button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRenamingId(null)}
                  disabled={locked}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="roster-card-heading">
              <h3 className="roster-heading">{team.emoji ? `${team.emoji} ` : ''}{team.theme}</h3>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRenamingId(team.id)
                  setRenameValue(team.theme || '')
                  setPending(null)
                }}
                disabled={locked}
              >
                Rename
              </button>
            </div>
          )}

          <label className="team-field">
            <span className="team-field-label">Team code</span>
            <span className="roster-code-row">
              <input
                type="text"
                readOnly
                value={team.join_code || ''}
                className="team-input roster-code-input"
                aria-label={`${team.theme} team code`}
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => copyCode(team)}
                disabled={!team.join_code}
              >
                {copiedId === team.id ? 'Copied' : 'Copy'}
              </button>
            </span>
          </label>

          {team.players.length === 0 ? (
            <p className="team-panel-muted">No players on this team yet.</p>
          ) : (
            <div className="roster-stack">
              {team.players.map((player) => (
                <PlayerRow
                  key={`${player.id}-${player.team_id || 'none'}`}
                  player={player}
                  teams={groups.teams}
                  busy={locked}
                  pending={pending?.id === player.id ? pending.kind : ''}
                  onPending={(kind) => setPending({ kind, id: player.id })}
                  onCancel={() => setPending(null)}
                  onMove={(teamId) => onMovePlayer?.(player.id, teamId)}
                  onDelete={() => onDeletePlayer?.(player.id)}
                  onRelease={() => onReleaseSignIn?.(player.id)}
                />
              ))}
            </div>
          )}

          {pending?.kind === 'delete-team' && pending.id === team.id ? (
            <div className="roster-confirm" role="alertdialog" aria-label={`Delete ${team.theme}`}>
              <p>{DELETE_TEAM_WARNING}</p>
              <div className="roster-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeleteTeam?.(team.id)}
                  disabled={locked}
                >
                  Delete team
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPending(null)}
                  disabled={locked}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPending({ kind: 'delete-team', id: team.id })}
              disabled={locked}
            >
              Delete team
            </button>
          )}
        </article>
      ))}

      {!loading ? (
      <section className="roster-card" aria-label="Unassigned players">
        <h3 className="roster-heading">Unassigned</h3>
        {groups.unassigned.length === 0 ? (
          <p className="team-panel-muted">No unassigned players.</p>
        ) : (
          <div className="roster-stack">
            {groups.unassigned.map((player) => (
              <PlayerRow
                key={`${player.id}-unassigned`}
                player={player}
                teams={groups.teams}
                busy={locked}
                pending={pending?.id === player.id ? pending.kind : ''}
                onPending={(kind) => setPending({ kind, id: player.id })}
                onCancel={() => setPending(null)}
                onMove={(teamId) => onMovePlayer?.(player.id, teamId)}
                onDelete={() => onDeletePlayer?.(player.id)}
                onRelease={() => onReleaseSignIn?.(player.id)}
              />
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  )
}

function PlayerRow({
  player,
  teams,
  busy,
  pending,
  onPending,
  onCancel,
  onMove,
  onDelete,
  onRelease,
}) {
  const locked = busy
  const [destination, setDestination] = useState('')
  const otherTeams = teams.filter((team) => team.id !== player.team_id)
  const onTeam = Boolean(player.team_id)

  if (pending === 'delete-player') {
    return (
      <div className="roster-confirm" role="alertdialog" aria-label={`Delete ${player.name}`}>
        <p>{DELETE_PLAYER_WARNING}</p>
        <div className="roster-actions">
          <button type="button" className="danger-button" onClick={onDelete} disabled={locked}>
            Delete player
          </button>
          <button type="button" className="secondary-button" onClick={onCancel} disabled={locked}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (pending === 'release') {
    return (
      <div className="roster-confirm" role="alertdialog" aria-label={`Release sign-in for ${player.name}`}>
        <p>{RELEASE_SIGN_IN_WARNING}</p>
        <div className="roster-actions">
          <button type="button" className="danger-button" onClick={onRelease} disabled={locked}>
            Release sign-in
          </button>
          <button type="button" className="secondary-button" onClick={onCancel} disabled={locked}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="roster-player">
      <div className="roster-player-name">
        <span>{player.name}</span>
        {player.claimed ? <span className="roster-claim">Signed in</span> : null}
      </div>
      <label className="team-field">
        <span className="team-field-label">{onTeam ? 'Move to' : 'Assign to'}</span>
        <select
          className="team-input"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          disabled={locked}
          aria-label={onTeam ? `Move ${player.name}` : `Assign ${player.name}`}
        >
          {onTeam ? <option value="">Unassigned</option> : <option value="">Choose a team</option>}
          {otherTeams.map((team) => (
            <option key={team.id} value={team.id}>{team.theme}</option>
          ))}
        </select>
      </label>
      <div className="roster-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={locked || (!onTeam && !destination)}
          onClick={() => onMove?.(destination || null)}
        >
          {onTeam ? (destination ? 'Move' : 'Unassign') : 'Assign'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onPending?.('delete-player')}
          disabled={locked}
        >
          Delete
        </button>
        {player.claimed ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => onPending?.('release')}
            disabled={locked}
          >
            Release sign-in
          </button>
        ) : null}
      </div>
    </div>
  )
}
