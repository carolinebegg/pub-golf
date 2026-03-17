import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (hole?.id) {
      loadFinishes()
    }
  }, [hole?.id])

  async function loadFinishes() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('pitcher_finishes')
      .select('*')
      .eq('hole_id', hole.id)
      .order('finished_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setFinishes(data || [])
    setLoading(false)
  }

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
    await loadFinishes()
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
    await loadFinishes()
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
      <div style={styles.card}>
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

        <div style={styles.buttonRow}>
          <button onClick={markFinished} disabled={saving} style={styles.button}>
            {saving
              ? 'Saving...'
              : myFinish
              ? 'Update to current time'
              : 'We finished our pitcher'}
          </button>

          {myFinish && (
            <button onClick={deleteFinish} disabled={saving} style={styles.dangerButton}>
              {saving ? 'Working...' : 'Delete finish'}
            </button>
          )}
        </div>
      </div>

      <div>
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
      </div>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 12, display: 'grid', gap: 12 },
  card: {
    padding: 12,
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #eee',
  },
  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  teamLabel: {
    fontWeight: 600,
  },
  heading: {
    marginBottom: 8,
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    padding: 12,
    borderRadius: 10,
    border: 'none',
    background: '#111',
    color: '#fff',
    fontWeight: 600,
  },
  dangerButton: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #b33',
    background: '#fff5f5',
    color: '#8a1f1f',
    fontWeight: 600,
  },
  list: {
    display: 'grid',
    gap: 8,
    marginTop: 10,
  },
  row: {
    padding: 10,
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  emptyRow: {
    padding: 10,
    background: '#fafafa',
    borderRadius: 10,
    border: '1px dashed #ddd',
    color: '#666',
  },
  muted: {
    color: '#666',
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