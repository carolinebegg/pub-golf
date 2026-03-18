import { useEffect, useMemo, useState } from 'react'
import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import HoleLeaderboard from './HoleLeaderboard'
import PrimaryActionButton from './PrimaryActionButton'
import { supabase } from '../lib/supabase'
import {
  calculateStandardHoleScore,
  formatHoleTimeRange,
  getHoleDisplayLabel,
  getEffectiveHoleType,
} from '../lib/helpers'

export default function HoleDetailsModal({
  hole = null,
  selectedTeam = null,
  allTeams = [],
  players = [],
  existingScore = null,
  pitcherFinish = null,
  bunkerEntryForHole = null,
  holeStatus = 'not-started',
  guinnessVotes = [],
  kegEntriesForHole = [],
  pitcherFinishesForHole = [],
  bunkerHazardEntries = [],
  onChanged,
  onClose,
}) {
  useEffect(() => {
    if (!hole) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [hole, onClose])

  if (!hole) return null

  const holeType = getEffectiveHoleType(hole)
  const holeTypeLabel = getHoleDisplayLabel(hole, holeType)
  const statusLabel = getStatusLabel(holeStatus)
  const scorePreview = calculateStandardHoleScore(existingScore)
  const isGuinnessHole = Boolean(hole?.has_guinness)

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div className="breakdown-overlay" onMouseDown={handleBackdropMouseDown} role="presentation">
      <section
        className="breakdown-modal hole-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Hole ${hole.hole_number} details`}
      >
        <div className="breakdown-modal-header">
          <div>
            <p className="breakdown-modal-eyebrow">Hole Details</p>
            <h3 className="breakdown-modal-title">Hole {hole.hole_number} - {hole.bar_name}</h3>
            <p className="breakdown-modal-members">{holeTypeLabel} • {formatHoleTimeRange(hole)}</p>
          </div>

          <button type="button" className="breakdown-close-button" onClick={() => onClose?.()}>
            X
          </button>
        </div>

        <div className="breakdown-modal-summary hole-detail-summary">
          <div className="hole-detail-summary-item">
            <span className="breakdown-summary-label">Type</span>
            <strong className="breakdown-summary-value">{holeTypeLabel}</strong>
          </div>

          <div className="hole-detail-summary-item">
            <span className="breakdown-summary-label">Your status</span>
            <strong className="breakdown-summary-value">{statusLabel}</strong>
          </div>
        </div>

        <div className="breakdown-modal-scroll hole-detail-scroll">
          <section className="hole-detail-section">
            <h4 className="hole-detail-section-title">Rule</h4>
            <p className="hole-detail-section-copy">{getRuleCopy({ hole, holeType })}</p>
          </section>

          {hole.notes ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Notes</h4>
              <p className="hole-detail-section-copy">{hole.notes}</p>
            </section>
          ) : null}

          {!selectedTeam ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Team access</h4>
              <p className="hole-detail-section-copy">Log in to your team to submit or edit this hole.</p>
            </section>
          ) : null}

          {selectedTeam && holeType === 'standard' && !isGuinnessHole ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Enter score</h4>
              <p className="hole-detail-section-copy">
                {existingScore ? (
                  <>
                    Current score: <strong>{scorePreview ?? '-'}</strong>
                  </>
                ) : (
                  'No score submitted yet.'
                )}
              </p>
              <StandardHoleForm
                key={`standard-${hole.id}-${selectedTeam.id}-${existingScore?.id ?? 'new'}`}
                hole={hole}
                team={selectedTeam}
                players={players}
                existingScore={existingScore}
                bunkerEntryForHole={bunkerEntryForHole}
                bunkerHazardEntries={bunkerHazardEntries}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && isGuinnessHole ? (
            <section className="hole-detail-section">
              <GuinnessVotingForm
                hole={hole}
                votingTeam={selectedTeam}
                allTeams={allTeams}
                players={players}
                votes={guinnessVotes}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && holeType === 'keg_stand' ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Add entry</h4>
              <KegStandSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                players={players}
                entriesForHole={kegEntriesForHole}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && holeType === 'pitcher' ? (
            <section className="hole-detail-section">
              <PitcherRaceSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                finishesForHole={pitcherFinishesForHole}
                pitcherFinish={pitcherFinish}
                onChanged={onChanged}
              />
            </section>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function GuinnessVotingForm({ hole, votingTeam, allTeams, players = [], votes = [], onChanged }) {
  const existingVote =
    votes.find(
      (vote) =>
        vote.hole_id === hole.id &&
        vote.voting_team_id === votingTeam.id,
    ) || null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showLeaderboards, setShowLeaderboards] = useState(false)
  const [bestSelection, setBestSelection] = useState(() => {
    if (!existingVote?.best_voted_player_id) return ''
    return String(existingVote.best_voted_player_id)
  })
  const [worstSelection, setWorstSelection] = useState(() => {
    if (!existingVote?.worst_voted_player_id) return ''
    return String(existingVote.worst_voted_player_id)
  })

  useEffect(() => {
    if (!existingVote) {
      setBestSelection('')
      setWorstSelection('')
      return
    }
    setBestSelection(existingVote.best_voted_player_id ? String(existingVote.best_voted_player_id) : '')
    setWorstSelection(existingVote.worst_voted_player_id ? String(existingVote.worst_voted_player_id) : '')
  }, [existingVote])

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  )
  const teamById = useMemo(
    () => new Map(allTeams.map((t) => [t.id, t])),
    [allTeams]
  )

  function buildGuinnessLeaderboardByPlayerId(voteRows, prefix) {
    const playerIdField = `${prefix}_voted_player_id`
    const counts = new Map()

    for (const vote of voteRows) {
      const pid = vote?.[playerIdField]
      if (!pid) continue

      const player = playerById.get(pid)
      const teamId = player?.team_id
      const key = pid
      const current = counts.get(key) || {
        playerId: pid,
        memberName: player?.name ?? '—',
        teamId: teamId ?? null,
        teamName: teamId ? (teamById.get(teamId)?.theme || teamById.get(teamId)?.name || null) : null,
        votes: 0,
      }
      current.votes += 1
      counts.set(key, current)
    }

    return Array.from(counts.values()).sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes
      if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName)
      return String(a.teamName || '').localeCompare(String(b.teamName || ''))
    })
  }

  const options = useMemo(() => {
    return players
      .filter((p) => p.team_id !== votingTeam.id)
      .sort((a, b) => (Number(a.rank) ?? 0) - (Number(b.rank) ?? 0))
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        teamId: p.team_id,
        teamLabel: teamById.get(p.team_id)?.theme || teamById.get(p.team_id)?.name || 'Team',
      }))
  }, [players, votingTeam.id, teamById])

  const holeVotes = useMemo(
    () => votes.filter((vote) => vote.hole_id === hole.id),
    [votes, hole.id],
  )

  const bestLeaderboard = useMemo(
    () => buildGuinnessLeaderboardByPlayerId(holeVotes, 'best').slice(0, 5),
    [holeVotes, playerById, teamById],
  )

  const worstLeaderboard = useMemo(
    () => buildGuinnessLeaderboardByPlayerId(holeVotes, 'worst').slice(0, 5),
    [holeVotes, playerById, teamById],
  )

  const hasVote = Boolean(
    existingVote &&
      (existingVote.best_voted_player_id || existingVote.worst_voted_player_id),
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!bestSelection && !worstSelection) {
      setError('Select at least one vote.')
      return
    }

    if (bestSelection && worstSelection && bestSelection === worstSelection) {
      setError('Best and worst split cannot be the exact same person.')
      return
    }

    const bestPlayer = bestSelection ? playerById.get(bestSelection) : null
    const worstPlayer = worstSelection ? playerById.get(worstSelection) : null

    setSaving(true)

    const { error: upsertError } = await supabase.from('guinness_split_votes').upsert(
      {
        hole_id: hole.id,
        voting_team_id: votingTeam.id,
        best_voted_player_id: bestSelection || null,
        best_voted_team_id: bestPlayer?.team_id ?? null,
        worst_voted_player_id: worstSelection || null,
        worst_voted_team_id: worstPlayer?.team_id ?? null,
      },
      {
        onConflict: 'hole_id,voting_team_id',
      },
    )

    if (upsertError) {
      setError(upsertError.message || 'Failed to save votes.')
      setSaving(false)
      return
    }

    if (onChanged) {
      await onChanged()
    }

    setShowLeaderboards(true)
    setSaving(false)
  }

  async function handleReset() {
    if (!hole?.id || !votingTeam?.id || !hasVote) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('guinness_split_votes')
      .delete()
      .eq('hole_id', hole.id)
      .eq('voting_team_id', votingTeam.id)

    if (deleteError) {
      setError(deleteError.message || 'Failed to remove votes.')
      setSaving(false)
      return
    }

    setBestSelection('')
    setWorstSelection('')

    if (onChanged) {
      await onChanged()
    }

    setShowLeaderboards(true)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="hole-guinness-form">
      <div
        className="hole-guinness-grid"
        style={{ display: 'grid', gap: 12 }}
      >
        <label className="team-field" style={{ marginBottom: 4 }}>
          <span className="team-field-label">Best Split G</span>
          <select
            value={bestSelection}
            onChange={(e) => setBestSelection(e.target.value)}
            className="team-input"
          >
            <option value="">No vote</option>
            {options.map((option) => (
              <option key={option.playerId} value={option.playerId}>
                {option.playerName} ({option.teamLabel})
              </option>
            ))}
          </select>
        </label>

        <label className="team-field">
          <span className="team-field-label">Worst Split G</span>
          <select
            value={worstSelection}
            onChange={(e) => setWorstSelection(e.target.value)}
            className="team-input"
          >
            <option value="">No vote</option>
            {options.map((option) => (
              <option key={option.playerId} value={option.playerId}>
                {option.playerName} ({option.teamLabel})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 16,
        }}
      >
        <PrimaryActionButton
          type="submit"
          disabled={hasVote}
          isLoading={saving}
          label={hasVote ? 'Vote submitted' : 'Submit vote'}
          loadingLabel="Saving..."
        />

        <button
          type="button"
          onClick={() => setShowLeaderboards((current) => !current)}
          style={{
            padding: '13px 18px',
            minHeight: 48,
            minWidth: 170,
            borderRadius: 12,
            border: '1.5px solid #2d6a4a',
            background: '#fff',
            color: '#2d6a4a',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          {showLeaderboards ? 'Hide leaderboard' : '🏆 Leaderboard'}
        </button>
      </div>

      {hasVote ? (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              void handleReset()
            }}
            disabled={saving}
            style={{
              padding: 0,
              minHeight: 0,
              border: 'none',
              background: 'transparent',
              color: '#294637',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Working...' : 'Change my vote'}
          </button>
        </div>
      ) : null}

      {error ? <p className="team-error">{error}</p> : null}

      {showLeaderboards ? (
        <div
          className="hole-detail-section"
          style={{ paddingTop: 24, borderTop: 'none' }}
        >
          <HoleLeaderboard
            layout="split"
            gridMinWidth={220}
            sections={[
              {
                id: 'best-split-g-hole',
                title: 'Best Split G',
                rows: bestLeaderboard,
                emptyText: 'No votes yet.',
                getKey: (row) => row.playerId,
                columns: (row) => ({
                  primary: row.memberName,
                  secondary: row.teamName || 'Team',
                  stat: `${row.votes} vote${row.votes === 1 ? '' : 's'}`,
                }),
              },
              {
                id: 'worst-split-g-hole',
                title: 'Worst Split G',
                rows: worstLeaderboard,
                emptyText: 'No votes yet.',
                getKey: (row) => row.playerId,
                columns: (row) => ({
                  primary: row.memberName,
                  secondary: row.teamName || 'Team',
                  stat: `${row.votes} vote${row.votes === 1 ? '' : 's'}`,
                }),
              },
            ]}
          />
        </div>
      ) : null}
    </form>
  )
}

function getRuleCopy({ hole, holeType }) {
  if (holeType === 'pitcher') {
    return hole?.rule_text || 'Each team finishes one pitcher. Tap "Finish pitcher" once your team is done. Finish order sets score: 1st = 0, 2nd = +1, 3rd = +2, and so on.'
  }

  if (holeType === 'keg_stand') {
    return hole?.rule_text || 'Add keg stand entries for your team. Team average seconds determines ranking for this hole.'
  }

  return hole?.rule_text || 'Submit your standard score for this hole.'
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'in-progress':
      return 'In progress'
    case 'not-started':
    default:
      return 'Not started'
  }
}
