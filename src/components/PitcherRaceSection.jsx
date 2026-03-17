import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildPitcherLeaderboard } from '../lib/helpers'

export default function PitcherRaceSection({
  hole,
  team,
  allTeams = [],
  onChanged,
}) {
  const [finishes, setFinishes] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
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
  }, [hole])

  useEffect(() => {
    if (!hole?.id) return

    const loadTimer = window.setTimeout(() => {
      void loadFinishesForHole(hole.id)
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [hole, loadFinishesForHole])

  const myFinish = useMemo(() => {
    return finishes.find((row) => row.team_id === team.id) || null
  }, [finishes, team.id])

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

    const { error: saveError } = await supabase
      .from('pitcher_finishes')
      .upsert(
        {
          hole_id: hole.id,
          team_id: team.id,
          finished_at: new Date().toISOString(),
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

    setMessage('Pitcher finish recorded.')
    await loadFinishesForHole()
    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function resetFinish() {
    if (!myFinish?.id) return

    const confirmed = window.confirm('Reset your team finish so it can be submitted again?')
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('pitcher_finishes')
      .delete()
      .eq('id', myFinish.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    setMessage('Finish reset. You can record it again.')
    await loadFinishesForHole()
    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  const leaderboard = useMemo(() => {
    return buildPitcherLeaderboard(finishes).map((row) => {
      const t = allTeams.find((teamRow) => teamRow.id === row.team_id)
      return {
        ...row,
        teamLabel: t ? (t.theme || t.name || `Team ${t.team_number}`) : 'Unknown team',
      }
    })
  }, [finishes, allTeams])

  const myLeaderboardRow = useMemo(() => {
    return leaderboard.find((row) => row.team_id === team.id) || null
  }, [leaderboard, team.id])

  return (
    <div style={styles.wrap}>
      <section style={styles.actionBlock}>
        <h4 style={styles.sectionTitle}>Finish pitcher</h4>
        <p style={styles.helperText}>
          Tap once when your team finishes the pitcher. First finish gets 0, then +1, +2, and so on.
        </p>

        {myFinish ? (
          <p style={styles.confirmText}>
            Finish recorded at <strong>{new Date(myFinish.finished_at).toLocaleTimeString()}</strong>
            {myLeaderboardRow ? ` • Place #${myLeaderboardRow.rankScore + 1}` : ''}
          </p>
        ) : (
          <p style={styles.muted}>No finish recorded yet.</p>
        )}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={markFinished}
            disabled={saving || loading || Boolean(myFinish)}
            style={styles.button}
          >
            {saving ? 'Saving...' : myFinish ? 'Finish recorded' : 'Finish pitcher'}
          </button>

          {myFinish ? (
            <button
              type="button"
              onClick={resetFinish}
              disabled={saving || loading}
              style={styles.secondaryButton}
            >
              {saving ? 'Working...' : 'Reset finish'}
            </button>
          ) : null}
        </div>
      </section>

      <section style={styles.resultsPanel}>
        <div style={styles.resultsHeader}>
          <h3 style={styles.heading}>Results</h3>
          <button
            type="button"
            onClick={() => setShowResults((current) => !current)}
            style={styles.secondaryButton}
          >
            {showResults ? 'Hide results' : 'Show results'}
          </button>
        </div>

        {showResults ? (
          loading ? (
            <p style={styles.muted}>Loading...</p>
          ) : (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span>Rank</span>
                <span>Team</span>
                <span>Time</span>
                <span>Score</span>
              </div>

              {leaderboard.map((row) => (
                <div key={row.id} style={styles.tableRow}>
                  <span style={styles.rankCell}>#{row.rankScore + 1}</span>
                  <span style={styles.teamCell}>{row.teamLabel}</span>
                  <span style={styles.timeCell}>{new Date(row.finished_at).toLocaleTimeString()}</span>
                  <span style={styles.scoreCell}>{row.rankScore}</span>
                </div>
              ))}

              {!leaderboard.length ? (
                <div style={styles.emptyRow}>No finishes yet. Use the button above to record the first finish.</div>
              ) : null}
            </div>
          )
        ) : (
          <p style={styles.helperCopy}>Show results to view finish order and scores.</p>
        )}
      </section>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 6, display: 'grid', gap: 12 },
  actionBlock: {
    display: 'grid',
    gap: 8,
    paddingTop: 4,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#1f3027',
    fontWeight: 800,
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
    borderRadius: 11,
    border: 'none',
    background: 'transparent',
    color: '#294637',
    fontWeight: 700,
    fontSize: '0.84rem',
  },
  resultsPanel: {
    display: 'grid',
    gap: 8,
    borderTop: '1px solid #e4ece6',
    paddingTop: 10,
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  heading: {
    margin: 0,
    fontSize: '0.92rem',
    color: '#194c31',
    fontWeight: 800,
  },
  table: {
    display: 'grid',
    gap: 6,
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) auto 52px',
    gap: 8,
    color: '#6a7d72',
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 800,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) auto 52px',
    gap: 8,
    alignItems: 'center',
    padding: '9px 0',
    borderTop: '1px solid #e4ece6',
    fontSize: '0.9rem',
  },
  rankCell: {
    color: '#1f5a3a',
    fontWeight: 800,
  },
  teamCell: {
    color: '#1f3027',
    fontWeight: 700,
    minWidth: 0,
  },
  timeCell: {
    color: '#5f6e65',
    whiteSpace: 'nowrap',
  },
  scoreCell: {
    color: '#1f5a3a',
    fontWeight: 800,
    textAlign: 'right',
  },
  emptyRow: {
    color: '#666',
    fontSize: '0.88rem',
    paddingTop: 6,
  },
  helperCopy: {
    margin: 0,
    color: '#5f6e65',
    fontSize: '0.84rem',
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