import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildPitcherLeaderboard } from '../lib/helpers'
import LeaderboardCard from './LeaderboardCard'
import PrimaryActionButton from './PrimaryActionButton'

export default function PitcherRaceSection({
  hole,
  team,
  allTeams = [],
  finishesForHole = [],
  pitcherFinish = null,
  onChanged,
}) {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [myFinish, setMyFinish] = useState(pitcherFinish)
  const [error, setError] = useState('')
  const canViewLeaderboard = Boolean(myFinish)

  useEffect(() => {
    setMyFinish(pitcherFinish || null)
    setShowResults(false)
    setLoading(false)
    setError('')
  }, [hole?.id, team?.id, pitcherFinish])

  async function markFinished() {
    if (!hole?.id || !team?.id) {
      setError('Missing hole or team.')
      return
    }

    if (myFinish) {
      setMessage('Finish already recorded. Use reset if you need to submit again.')
      return
    }

    setSaving(true)
    setError('')

    const finishedAt = new Date().toISOString()

    const { error: saveError } = await supabase
      .from('pitcher_finishes')
      .upsert(
        {
          hole_id: hole.id,
          team_id: team.id,
          finished_at: finishedAt,
        },
        {
          onConflict: 'hole_id,team_id',
        }
      )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setMyFinish({
      hole_id: hole.id,
      team_id: team.id,
      finished_at: finishedAt,
    })

    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function resetFinish() {
    if (!hole?.id || !team?.id || !myFinish) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('pitcher_finishes')
      .delete()
      .eq('hole_id', hole.id)
      .eq('team_id', team.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    setMyFinish(null)
    setShowResults(false)

    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function toggleResults() {
    if (!canViewLeaderboard) {
      return
    }

    if (showResults) {
      setShowResults(false)
      return
    }

    setShowResults(true)
  }

  const leaderboard = useMemo(() => {
    if (!showResults) return []

    return buildPitcherLeaderboard(finishesForHole).map((row) => {
      const t = allTeams.find((teamRow) => teamRow.id === row.team_id)
      return {
        ...row,
        teamLabel: t ? (t.theme || t.name || `Team ${t.team_number}`) : 'Unknown team',
      }
    })
  }, [showResults, finishesForHole, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.actionBlock}>
        {myFinish ? (
          <p style={styles.confirmText}>
            Finished at <strong>{new Date(myFinish.finished_at).toLocaleTimeString()}</strong>
          </p>
        ) : null}

        <div style={styles.buttonRow}>
          <PrimaryActionButton
            type="button"
            onClick={markFinished}
            disabled={Boolean(myFinish)}
            isLoading={saving}
            label={myFinish ? 'Finish recorded' : 'Finish pitcher'}
            loadingLabel="Saving..."
          />

          <button
            type="button"
            disabled={!canViewLeaderboard}
            style={{
              ...styles.leaderboardBtn,
              ...(!canViewLeaderboard ? styles.leaderboardBtnDisabled : null),
            }}
            onClick={() => {
              void toggleResults()
            }}
          >
            {showResults ? 'Hide leaderboard' : '🏆 Leaderboard'}
          </button>
        </div>

        {myFinish ? (
          <button
            type="button"
            onClick={resetFinish}
            disabled={saving}
            style={styles.secondaryButton}
          >
            {saving ? 'Working...' : 'Reset finish'}
          </button>
        ) : null}
      </section>

      {showResults && (
        <LeaderboardCard
          sections={[
            {
              id: 'finish-order',
              title: 'Finish order',
              loading,
              rows: leaderboard,
              emptyText: 'No finishes yet.',
              getKey: (row) => row.id || row.team_id,
              renderRow: (row, index) => (
                <>
                  <span style={styles.leaderboardRank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.leaderboardInfo}>
                    <span style={styles.leaderboardName}>{row.teamLabel}</span>
                    <span style={styles.leaderboardMeta}>
                      {new Date(row.finished_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <span style={styles.leaderboardStat}>+{row.rankScore}</span>
                </>
              ),
            },
          ]}
        />
      )}

      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 4, display: 'grid', gap: 12 },
  actionBlock: {
    display: 'grid',
    gap: 10,
    paddingTop: 4,
    justifyItems: 'center',
  },
  confirmText: {
    margin: 0,
    color: '#214634',
    fontSize: '0.9rem',
    lineHeight: 1.34,
    textAlign: 'center',
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    padding: '13px 18px',
    minHeight: 48,
    minWidth: 170,
    borderRadius: 12,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontWeight: 800,
  },
  secondaryButton: {
    padding: 0,
    minHeight: 0,
    border: 'none',
    background: 'transparent',
    color: '#294637',
    fontWeight: 700,
    fontSize: '0.84rem',
    justifySelf: 'center',
  },
  leaderboardBtn: {
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
  },
  leaderboardBtnDisabled: {
    border: '1.5px solid #ccd6ce',
    background: '#f3f5f3',
    color: '#97a29a',
    cursor: 'not-allowed',
  },
  leaderboardRank: {
    fontSize: '1.1rem',
    minWidth: 28,
    textAlign: 'center',
  },
  leaderboardInfo: {
    flex: 1,
    display: 'grid',
    gap: 1,
    minWidth: 0,
  },
  leaderboardName: {
    fontWeight: 700,
    color: '#1f3027',
    fontSize: '0.9rem',
  },
  leaderboardMeta: {
    color: '#6a7d72',
    fontSize: '0.8rem',
  },
  leaderboardStat: {
    fontWeight: 700,
    color: '#1f5a3a',
    fontSize: '0.88rem',
    whiteSpace: 'nowrap',
  },
  leaderboardEmpty: {
    padding: '8px 14px',
    color: '#6a7d72',
    fontSize: '0.88rem',
  },
  success: {
    color: '#17663a',
    margin: 0,
    fontWeight: 700,
  },
  error: {
    color: '#a12626',
    margin: 0,
    fontWeight: 700,
  },
}
