import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildPitcherLeaderboard } from '../lib/helpers'

export default function PitcherRaceSection({
  hole,
  team,
  allTeams = [],
  pitcherFinish = null,
  onChanged,
}) {
  const [finishes, setFinishes] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [myFinish, setMyFinish] = useState(pitcherFinish)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadFinishesForHole = useCallback(async (holeIdParam = hole?.id) => {
    if (!holeIdParam) return

    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('pitcher_finishes')
      .select('*')
      .eq('hole_id', holeIdParam)
      .order('finished_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setFinishes(data || [])
    setLoading(false)
  }, [hole?.id])

  useEffect(() => {
    setMyFinish(pitcherFinish || null)
    setFinishes([])
    setShowResults(false)
    setLoading(false)
    setError('')
    setMessage('')
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
    setMessage('')

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
    setMessage('Pitcher finish recorded.')

    if (showResults) {
      await loadFinishesForHole()
    }

    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function resetFinish() {
    if (!hole?.id || !team?.id || !myFinish) return

    const confirmed = window.confirm('Reset your team finish so it can be submitted again?')
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

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
    setMessage('Finish reset. You can record it again.')

    if (showResults) {
      await loadFinishesForHole()
    }

    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function toggleResults() {
    if (showResults) {
      setShowResults(false)
      return
    }

    setShowResults(true)
    await loadFinishesForHole()
  }

  const leaderboard = useMemo(() => {
    if (!showResults) return []

    return buildPitcherLeaderboard(finishes).map((row) => {
      const t = allTeams.find((teamRow) => teamRow.id === row.team_id)
      return {
        ...row,
        teamLabel: t ? (t.theme || t.name || `Team ${t.team_number}`) : 'Unknown team',
      }
    })
  }, [showResults, finishes, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.actionBlock}>
        <p style={styles.helperText}>
          Tap once when your team finishes the pitcher. First finish gets 0, then +1, +2, and so on.
        </p>

        {myFinish ? (
          <p style={styles.confirmText}>
            Finished at <strong>{new Date(myFinish.finished_at).toLocaleTimeString()}</strong>
          </p>
        ) : (
          <p style={styles.muted}>No finish recorded yet.</p>
        )}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={markFinished}
            disabled={saving || Boolean(myFinish)}
            style={styles.button}
          >
            {saving ? 'Saving...' : myFinish ? 'Finish recorded' : 'Finish pitcher'}
          </button>

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
        </div>
      </section>

      <div style={styles.leaderboardToggle}>
        <button
          type="button"
          style={styles.leaderboardBtn}
          onClick={() => {
            void toggleResults()
          }}
        >
          {showResults ? 'Hide leaderboard' : '🏆 Leaderboard'}
        </button>
      </div>

      {showResults && (
        <div style={styles.leaderboardCard}>
          <div style={styles.leaderboardSectionHeader}>Finish order</div>
          {loading ? (
            <div style={styles.leaderboardEmpty}>Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div style={styles.leaderboardEmpty}>No finishes yet.</div>
          ) : (
            leaderboard.map((row, index) => (
              <div key={row.id || row.team_id} style={styles.leaderboardRow}>
                <span style={styles.leaderboardRank}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </span>
                <div style={styles.leaderboardInfo}>
                  <span style={styles.leaderboardName}>{row.teamLabel}</span>
                  <span style={styles.leaderboardMeta}>{new Date(row.finished_at).toLocaleTimeString()}</span>
                </div>
                <span style={styles.leaderboardStat}>+{row.rankScore}</span>
              </div>
            ))
          )}
        </div>
      )}

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 4, display: 'grid', gap: 12 },
  actionBlock: {
    display: 'grid',
    gap: 8,
    paddingTop: 4,
  },
  helperText: {
    margin: 0,
    color: '#4b5f54',
    fontSize: '0.9rem',
    lineHeight: 1.36,
  },
  confirmText: {
    margin: 0,
    color: '#214634',
    fontSize: '0.9rem',
    lineHeight: 1.34,
  },
  muted: {
    color: '#5f6e65',
    margin: 0,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    padding: '11px 14px',
    minHeight: 44,
    borderRadius: 11,
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
  },
  leaderboardToggle: {
    paddingTop: 4,
  },
  leaderboardBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1.5px solid #2d6a4a',
    background: 'transparent',
    color: '#2d6a4a',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  leaderboardCard: {
    border: '1.5px solid #b8d9c4',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#f6fbf7',
  },
  leaderboardSectionHeader: {
    background: '#2d6a4a',
    color: '#fff',
    padding: '6px 14px',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  leaderboardRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: '9px 14px',
    borderTop: '1px solid #e3ede6',
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
