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

    setMessage(myFinish ? 'Finish time updated.' : 'Pitcher finish saved.')
    await loadFinishesForHole()
    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function deleteFinish() {
    if (!myFinish?.id) return

    const confirmed = window.confirm('Delete your team’s pitcher finish?')
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

    setMessage('Pitcher finish deleted.')
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
        teamLabel: t
          ? `Team ${t.team_number}: ${t.theme || t.name}`
          : 'Unknown team',
      }
    })
  }, [finishes, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.card}>
        <div style={styles.headingRow}>
          <strong>Your team</strong>
          <span style={styles.teamLabel}>{team.name}</span>
        </div>

        {myFinish ? (
          <p style={styles.muted}>
            Finished at: {new Date(myFinish.finished_at).toLocaleTimeString()}
          </p>
        ) : (
          <p style={styles.muted}>No finish recorded yet.</p>
        )}

        <p style={styles.helperText}>
          First team to finish gets the best score. Times are ranked automatically.
        </p>

        <div style={styles.buttonRow}>
          <button type="button" onClick={markFinished} disabled={saving || loading} style={styles.button}>
            {saving
              ? 'Saving...'
              : myFinish
              ? 'Update to current time'
              : 'We finished our pitcher'}
          </button>

          {myFinish && (
            <button type="button" onClick={deleteFinish} disabled={saving || loading} style={styles.dangerButton}>
              {saving ? 'Working...' : 'Delete finish'}
            </button>
          )}
        </div>
      </section>

      <section style={styles.resultsPanel}>
        <h3 style={styles.heading}>Pitcher finish order</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={styles.list}>
            {leaderboard.map((row, index) => (
              <div key={row.id} style={styles.row}>
                <div>
                  #{index + 1} — {row.teamLabel} → hole score {row.rankScore}
                </div>
                <div style={styles.muted}>
                  {new Date(row.finished_at).toLocaleTimeString()}
                </div>
              </div>
            ))}

            {!leaderboard.length && <div style={styles.emptyRow}>No teams have finished yet.</div>}
          </div>
        )}
      </section>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 12, display: 'grid', gap: 10 },
  card: {
    padding: 11,
    borderRadius: 12,
    background: '#f6f8ff',
    border: '1px solid #ced9f4',
    display: 'grid',
    gap: 8,
  },
  resultsPanel: {
    padding: 11,
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #dde6de',
  },
  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  teamLabel: {
    fontWeight: 700,
  },
  heading: {
    marginBottom: 8,
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    color: '#194c31',
  },
  helperText: {
    margin: 0,
    color: '#4b5a82',
    fontSize: '0.88rem',
    lineHeight: 1.34,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    padding: 11,
    borderRadius: 11,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontWeight: 800,
  },
  dangerButton: {
    padding: 11,
    borderRadius: 11,
    border: '1px solid #b33',
    background: '#fff5f5',
    color: '#8a1f1f',
    fontWeight: 700,
  },
  list: {
    display: 'grid',
    gap: 8,
    marginTop: 10,
  },
  row: {
    padding: 10,
    background: '#fff',
    borderRadius: 11,
    border: '1px solid #dde6de',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  emptyRow: {
    padding: 10,
    background: '#fafafa',
    borderRadius: 11,
    border: '1px dashed #ddd',
    color: '#666',
  },
  muted: {
    color: '#5f6e65',
    margin: 0,
  },
  success: {
    color: '#17663a',
    margin: 0,
  },
  error: {
    color: '#a12626',
    margin: 0,
  },
}