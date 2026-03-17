import { useEffect, useMemo, useState } from 'react'
import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import LeaderboardCard from './LeaderboardCard'
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
  existingScore = null,
  pitcherFinish = null,
  holeStatus = 'not-started',
  guinnessVotes = [],
  kegEntriesForHole = [],
  pitcherFinishesForHole = [],
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
                existingScore={existingScore}
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

function GuinnessVotingForm({ hole, votingTeam, allTeams, votes = [], onChanged }) {
  const existingVote =
    votes.find(
      (vote) =>
        vote.hole_id === hole.id &&
        vote.voting_team_id === votingTeam.id,
    ) || null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showLeaderboards, setShowLeaderboards] = useState(false)
  const [bestSelection, setBestSelection] = useState(() => {
    if (!existingVote) return ''
    if (!existingVote.best_voted_member_name || !existingVote.best_voted_team_id) return ''
    return `${existingVote.best_voted_team_id}::${existingVote.best_voted_member_name}`
  })
  const [worstSelection, setWorstSelection] = useState(() => {
    if (!existingVote) return ''
    if (!existingVote.worst_voted_member_name || !existingVote.worst_voted_team_id) return ''
    return `${existingVote.worst_voted_team_id}::${existingVote.worst_voted_member_name}`
  })

  // Keep local selections in sync if votes for this team+hole change after a refresh
  useEffect(() => {
    if (!existingVote) {
      setBestSelection('')
      setWorstSelection('')
      return
    }

    const nextBest =
      existingVote.best_voted_member_name && existingVote.best_voted_team_id
        ? `${existingVote.best_voted_team_id}::${existingVote.best_voted_member_name}`
        : ''

    const nextWorst =
      existingVote.worst_voted_member_name && existingVote.worst_voted_team_id
        ? `${existingVote.worst_voted_team_id}::${existingVote.worst_voted_member_name}`
        : ''

    setBestSelection(nextBest)
    setWorstSelection(nextWorst)
  }, [existingVote])

  // Utility shared with overall Guinness leaderboards to aggregate counts by member + team
  function buildGuinnessMemberLeaderboard(voteRows, teamRows, prefix) {
    const nameField = `${prefix}_voted_member_name`
    const teamField = `${prefix}_voted_team_id`

    const teamById = new Map(teamRows.map((team) => [team.id, team]))
    const counts = new Map()

    for (const vote of voteRows) {
      const memberName = vote?.[nameField]
      const teamId = vote?.[teamField]
      if (!memberName || !teamId) continue

      const key = `${teamId}::${memberName}`
      const current = counts.get(key) || {
        memberName,
        teamId,
        teamName: teamById.get(teamId)?.name || teamById.get(teamId)?.theme || null,
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
    const rows = []
    for (const team of allTeams) {
      if (!Array.isArray(team.members)) continue
      if (team.id === votingTeam.id) continue
      for (const member of team.members) {
        if (!member) continue
        rows.push({
          key: `${team.id}::${member}`,
          memberName: member,
          teamId: team.id,
          teamLabel: team.name || team.theme || 'Team',
        })
      }
    }
    return rows
  }, [allTeams, votingTeam.id])

  const holeVotes = useMemo(
    () => votes.filter((vote) => vote.hole_id === hole.id),
    [votes, hole.id],
  )

  const bestLeaderboard = useMemo(
    () => buildGuinnessMemberLeaderboard(holeVotes, allTeams, 'best').slice(0, 5),
    [holeVotes, allTeams],
  )

  const worstLeaderboard = useMemo(
    () => buildGuinnessMemberLeaderboard(holeVotes, allTeams, 'worst').slice(0, 5),
    [holeVotes, allTeams],
  )

  const hasVote =
    Boolean(
      existingVote &&
        ((existingVote.best_voted_member_name && existingVote.best_voted_team_id) ||
          (existingVote.worst_voted_member_name && existingVote.worst_voted_team_id)),
    )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!bestSelection && !worstSelection) {
      setError('Select at least one vote.')
      return
    }

    if (bestSelection && worstSelection && bestSelection === worstSelection) {
      setError('Best and worst split cannot be the exact same person.')
      return
    }

    const [bestTeamId, bestMemberName] = bestSelection ? bestSelection.split('::') : [null, null]
    const [worstTeamId, worstMemberName] = worstSelection
      ? worstSelection.split('::')
      : [null, null]

    setSaving(true)

    const { error: upsertError } = await supabase.from('guinness_split_votes').upsert(
      {
        hole_id: hole.id,
        voting_team_id: votingTeam.id,
        best_voted_member_name: bestMemberName || null,
        best_voted_team_id: bestTeamId || null,
        worst_voted_member_name: worstMemberName || null,
        worst_voted_team_id: worstTeamId || null,
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

    setSaving(false)
    setMessage('Votes saved.')

    if (onChanged) {
      await onChanged()
    }
  }

  async function handleReset() {
    if (!hole?.id || !votingTeam?.id || !hasVote) return

    setSaving(true)
    setError('')
    setMessage('')

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
    setSaving(false)
    setMessage('Votes removed. You can vote again.')

    if (onChanged) {
      await onChanged()
    }
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
              <option key={option.key} value={option.key}>
                {option.memberName} — {option.teamLabel}
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
              <option key={option.key} value={option.key}>
                {option.memberName} — {option.teamLabel}
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
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <LeaderboardCard
              sections={[
                {
                  id: 'best-split-g-hole',
                  title: 'Best Split G',
                  loading: false,
                  rows: bestLeaderboard,
                  emptyText: 'No votes yet.',
                  getKey: (row) => `${row.teamId}::${row.memberName}`,
                  renderRow: (row, index) => (
                    <>
                      <span style={{ fontSize: '1.1rem', minWidth: 28, textAlign: 'center' }}>
                        {index === 0
                          ? '🥇'
                          : index === 1
                          ? '🥈'
                          : index === 2
                          ? '🥉'
                          : `#${index + 1}`}
                      </span>
                      <div style={{ flex: 1, display: 'grid', gap: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: '#1f3027', fontSize: '0.9rem' }}>
                          {row.memberName}
                        </span>
                        <span style={{ color: '#6a7d72', fontSize: '0.8rem' }}>
                          {row.teamName || 'Team'}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#1f5a3a',
                          fontSize: '0.88rem',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.votes} vote{row.votes === 1 ? '' : 's'}
                      </span>
                    </>
                  ),
                },
              ]}
            />

            <LeaderboardCard
              sections={[
                {
                  id: 'worst-split-g-hole',
                  title: 'Worst Split G',
                  loading: false,
                  rows: worstLeaderboard,
                  emptyText: 'No votes yet.',
                  getKey: (row) => `${row.teamId}::${row.memberName}`,
                  renderRow: (row, index) => (
                    <>
                      <span style={{ fontSize: '1.1rem', minWidth: 28, textAlign: 'center' }}>
                        {index === 0
                          ? '🥇'
                          : index === 1
                          ? '🥈'
                          : index === 2
                          ? '🥉'
                          : `#${index + 1}`}
                      </span>
                      <div style={{ flex: 1, display: 'grid', gap: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: '#1f3027', fontSize: '0.9rem' }}>
                          {row.memberName}
                        </span>
                        <span style={{ color: '#6a7d72', fontSize: '0.8rem' }}>
                          {row.teamName || 'Team'}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#1f5a3a',
                          fontSize: '0.88rem',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.votes} vote{row.votes === 1 ? '' : 's'}
                      </span>
                    </>
                  ),
                },
              ]}
            />
          </div>
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
