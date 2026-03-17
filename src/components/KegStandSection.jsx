import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (hole?.id) {
      loadEntries()
    }
  }, [hole?.id])

  async function loadEntries() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('keg_stand_entries')
      .select('*')
      .eq('hole_id', hole.id)
      .order('seconds', { ascending: false })
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setEntries(data || [])
    setLoading(false)
  }

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

    await loadEntries()
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
    await loadEntries()
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
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.sectionTitle}>
          {editingEntryId ? 'Edit keg stand' : 'Add keg stand'}
        </div>

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

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Keg stand seconds"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          style={styles.input}
        />

        <div style={styles.buttonRow}>
          <button
            type="submit"
            disabled={saving || !memberName || seconds === ''}
            style={styles.button}
          >
            {saving
              ? 'Saving...'
              : editingEntryId
              ? 'Update keg stand'
              : 'Add keg stand'}
          </button>

          {editingEntryId && (
            <button type="button" onClick={cancelEdit} style={styles.secondaryButton}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {teamAverage !== null && (
        <div style={styles.teamAverageCard}>
          Your team average: <strong>{formatSeconds(teamAverage)}</strong>
        </div>
      )}

      {teamEntries.length > 0 && (
        <div style={styles.subsection}>
          <h3 style={styles.heading}>Your team entries</h3>
          <div style={styles.list}>
            {teamEntries.map((entry) => (
              <div key={entry.id} style={styles.row}>
                <div>
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
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowLeaderboard((v) => !v)}
        style={styles.secondaryButton}
      >
        {showLeaderboard ? 'Hide keg stand leaderboards' : 'Show keg stand leaderboards'}
      </button>

      {showLeaderboard && (
        <>
          <div style={styles.subsection}>
            <h3 style={styles.heading}>Individual keg stand leaderboard</h3>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div style={styles.list}>
                {enrichedEntries.map((entry, index) => (
                  <div key={entry.id} style={styles.row}>
                    #{index + 1} — {entry.member_name}: {formatSeconds(entry.seconds)} ({entry.teamLabel})
                  </div>
                ))}
                {!enrichedEntries.length && <div style={styles.emptyRow}>No entries yet.</div>}
              </div>
            )}
          </div>

          <div style={styles.subsection}>
            <h3 style={styles.heading}>Team average leaderboard</h3>
            <div style={styles.list}>
              {teamLeaderboard.map((row, index) => (
                <div key={row.team_id} style={styles.row}>
                  #{index + 1} — {row.teamLabel}: {formatSeconds(row.average)} avg → hole score{' '}
                  {row.rankScore}
                </div>
              ))}
              {!teamLeaderboard.length && <div style={styles.emptyRow}>No team results yet.</div>}
            </div>
          </div>
        </>
      )}

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 12, display: 'grid', gap: 12 },
  form: { display: 'grid', gap: 10 },
  sectionTitle: { fontWeight: 700 },
  input: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ccc',
    fontSize: 16,
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
  secondaryButton: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ccc',
    background: '#fff',
    fontWeight: 600,
  },
  smallSecondaryButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #ccc',
    background: '#fff',
  },
  smallDangerButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #b33',
    background: '#fff5f5',
    color: '#8a1f1f',
  },
  teamAverageCard: {
    padding: 12,
    background: '#f7f7f7',
    borderRadius: 10,
    border: '1px solid #e5e5e5',
  },
  subsection: {
    display: 'grid',
    gap: 8,
  },
  heading: {
    margin: 0,
  },
  list: { display: 'grid', gap: 8 },
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
  rowActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  emptyRow: {
    padding: 10,
    background: '#fafafa',
    borderRadius: 10,
    border: '1px dashed #ddd',
    color: '#666',
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