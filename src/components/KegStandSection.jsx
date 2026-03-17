import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  buildKegStandTeamLeaderboard,
  calculateTeamAverageKegSeconds,
  formatSeconds,
} from '../lib/helpers'

export default function KegStandSection({
  hole,
  team,
  allTeams = [],
  onChanged,
}) {
  const [memberName, setMemberName] = useState('')
  const [seconds, setSeconds] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)

  const [entries, setEntries] = useState([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadEntriesForHole = useCallback(async (holeIdParam = hole?.id) => {
    if (!holeIdParam) return

    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('keg_stand_entries')
      .select('*')
      .eq('hole_id', holeIdParam)
      .order('seconds', { ascending: false })
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setEntries(data || [])
    setLoading(false)
  }, [hole])

  useEffect(() => {
    if (!hole?.id) return

    const loadTimer = window.setTimeout(() => {
      void loadEntriesForHole(hole.id)
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [hole, loadEntriesForHole])

  async function handleSubmit(e) {
    e.preventDefault()

    if (!team?.id || !hole?.id) {
      setError('Missing hole or team.')
      return
    }

    if (!memberName || seconds === '') {
      setError('Select a member and enter seconds.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      hole_id: hole.id,
      team_id: team.id,
      member_name: memberName,
      seconds: Number(seconds),
    }

    let result

    if (editingEntryId) {
      result = await supabase
        .from('keg_stand_entries')
        .update(payload)
        .eq('id', editingEntryId)
    } else {
      result = await supabase.from('keg_stand_entries').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    setMemberName('')
    setSeconds('')
    setEditingEntryId(null)
    setMessage(editingEntryId ? 'Keg stand updated.' : 'Keg stand added.')

    await loadEntriesForHole()
    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  function startEdit(entry) {
    setEditingEntryId(entry.id)
    setMemberName(entry.member_name)
    setSeconds(String(entry.seconds))
    setMessage('')
    setError('')
  }

  function cancelEdit() {
    setEditingEntryId(null)
    setMemberName('')
    setSeconds('')
    setMessage('')
    setError('')
  }

  async function handleDelete(entryId) {
    const confirmed = window.confirm('Delete this keg stand entry?')
    if (!confirmed) return

    setDeletingId(entryId)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('keg_stand_entries')
      .delete()
      .eq('id', entryId)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingId(null)
      return
    }

    if (editingEntryId === entryId) {
      cancelEdit()
    }

    setMessage('Keg stand entry deleted.')
    await loadEntriesForHole()
    setDeletingId(null)

    if (onChanged) {
      await onChanged()
    }
  }

  const enrichedEntries = useMemo(() => {
    return entries.map((entry) => {
      const entryTeam = allTeams.find((t) => t.id === entry.team_id)
      return {
        ...entry,
        teamLabel: entryTeam
          ? `Team ${entryTeam.team_number}: ${entryTeam.theme || entryTeam.name}`
          : 'Unknown team',
      }
    })
  }, [entries, allTeams])

  const teamEntries = useMemo(() => {
    return enrichedEntries.filter((entry) => entry.team_id === team.id)
  }, [enrichedEntries, team.id])

  const teamAverage = useMemo(() => {
    return calculateTeamAverageKegSeconds(teamEntries)
  }, [teamEntries])

  const teamLeaderboard = useMemo(() => {
    return buildKegStandTeamLeaderboard(entries).map((row) => {
      const t = allTeams.find((teamRow) => teamRow.id === row.team_id)
      return {
        ...row,
        teamLabel: t
          ? `Team ${t.team_number}: ${t.theme || t.name}`
          : 'Unknown team',
      }
    })
  }, [entries, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.primaryAction}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <h5 style={styles.sectionTitle}>{editingEntryId ? 'Edit entry' : 'Add entry'}</h5>

          <label style={styles.fieldLabel}>
            Team member
            <select
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              style={styles.input}
            >
              <option value="">Select team member</option>
              {team.members?.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Seconds
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              style={styles.input}
            />
          </label>

          <div style={styles.buttonRow}>
            <button
              type="submit"
              disabled={saving || !memberName || seconds === ''}
              style={styles.button}
            >
              {saving
                ? 'Saving...'
                : editingEntryId
                ? 'Update entry'
                : 'Add keg entry'}
            </button>

            {editingEntryId ? (
              <button type="button" onClick={cancelEdit} style={styles.secondaryButton}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {teamAverage !== null && (
        <p style={styles.teamAverageCard}>
          Your team average: <strong>{formatSeconds(teamAverage)}</strong>
        </p>
      )}

      {teamEntries.length > 0 && (
        <section style={styles.simpleSection}>
          <h3 style={styles.heading}>Your team entries</h3>
          <div style={styles.list}>
            {teamEntries.map((entry) => (
              <div key={entry.id} style={styles.row}>
                <div style={styles.rowText}>
                  <strong>{entry.member_name}</strong> — {formatSeconds(entry.seconds)}
                </div>
                <div style={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    style={styles.smallSecondaryButton}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    style={styles.smallDangerButton}
                  >
                    {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={styles.resultsPanel}>
        <div style={styles.resultsHeader}>
          <h3 style={styles.heading}>Keg stand results</h3>
          <button
            type="button"
            onClick={() => setShowLeaderboard((v) => !v)}
            style={styles.secondaryButton}
          >
            {showLeaderboard ? 'Hide results' : 'Show results'}
          </button>
        </div>

        {showLeaderboard ? (
          <>
            <div style={styles.subsection}>
              <h4 style={styles.subHeading}>Individual leaderboard</h4>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div style={styles.list}>
                  {enrichedEntries.map((entry, index) => (
                    <div key={entry.id} style={styles.row}>
                      <span style={styles.rowText}>#{index + 1} — {entry.member_name}: {formatSeconds(entry.seconds)} ({entry.teamLabel})</span>
                    </div>
                  ))}
                  {!enrichedEntries.length && <div style={styles.emptyRow}>No entries yet.</div>}
                </div>
              )}
            </div>

            <div style={styles.subsection}>
              <h4 style={styles.subHeading}>Team averages</h4>
              <div style={styles.list}>
                {teamLeaderboard.map((row, index) => (
                  <div key={row.team_id} style={styles.row}>
                    <span style={styles.rowText}>#{index + 1} — {row.teamLabel}: {formatSeconds(row.average)} avg → hole score {row.rankScore}</span>
                  </div>
                ))}
                {!teamLeaderboard.length && <div style={styles.emptyRow}>No team results yet.</div>}
              </div>
            </div>
          </>
        ) : (
          <p style={styles.helperCopy}>Open results to compare individual and team averages.</p>
        )}
      </section>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 8, display: 'grid', gap: 10 },
  primaryAction: {
    background: '#fff',
    borderRadius: 12,
    padding: 10,
    border: '1px solid #dde6de',
  },
  simpleSection: {
    padding: '2px 0',
    display: 'grid',
    gap: 8,
  },
  resultsPanel: {
    background: '#fff',
    border: '1px solid #dde6de',
    borderRadius: 12,
    padding: 10,
    display: 'grid',
    gap: 9,
  },
  form: { display: 'grid', gap: 8 },
  sectionTitle: {
    margin: 0,
    fontSize: '0.92rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#5e7167',
    fontWeight: 800,
  },
  fieldLabel: {
    display: 'grid',
    gap: 5,
    fontSize: '0.9rem',
    color: '#2e4639',
    fontWeight: 700,
  },
  input: {
    padding: 11,
    borderRadius: 11,
    border: '1px solid #ccd6ce',
    fontSize: 15,
    background: '#fff',
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
    padding: '10px 12px',
    minHeight: 40,
    borderRadius: 11,
    border: '1px solid #ced8d0',
    background: '#fff',
    fontWeight: 700,
  },
  smallSecondaryButton: {
    padding: '6px 8px',
    borderRadius: 9,
    border: '1px solid #d6e1d8',
    background: '#f7fbf8',
    color: '#30533f',
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  smallDangerButton: {
    padding: '6px 8px',
    borderRadius: 9,
    border: '1px solid #e3c7c7',
    background: '#fff',
    color: '#8a1f1f',
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  teamAverageCard: {
    margin: 0,
    color: '#264736',
    fontSize: '0.9rem',
  },
  subsection: {
    display: 'grid',
    gap: 6,
  },
  subHeading: {
    margin: 0,
    fontSize: '0.84rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6a7d72',
  },
  heading: {
    margin: 0,
    fontSize: '0.94rem',
    color: '#194c31',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  list: { display: 'grid', gap: 8 },
  row: {
    padding: '8px 0',
    borderTop: '1px solid #e7efe8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  rowText: {
    color: '#2c4236',
    fontSize: '0.9rem',
    lineHeight: 1.35,
  },
  rowActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  emptyRow: {
    padding: '8px 0',
    color: '#666',
    fontSize: '0.88rem',
  },
  helperCopy: {
    margin: 0,
    color: '#5f6e65',
    fontSize: '0.88rem',
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