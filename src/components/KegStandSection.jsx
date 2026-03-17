import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildKegStandTeamLeaderboard, formatSeconds } from '../lib/helpers'
import LeaderboardCard from './LeaderboardCard'

export default function KegStandSection({
  hole,
  team,
  allTeams = [],
  entriesForHole = [],
  onChanged,
}) {
  const [memberName, setMemberName] = useState('')
  const [seconds, setSeconds] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)

  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
    setDeletingId(null)

    if (onChanged) {
      await onChanged()
    }
  }

  const enrichedEntries = useMemo(() => {
    return entriesForHole.map((entry) => {
      const entryTeam = allTeams.find((t) => t.id === entry.team_id)
      return {
        ...entry,
        teamLabel: entryTeam
          ? `Team ${entryTeam.team_number}: ${entryTeam.theme || entryTeam.name}`
          : 'Unknown team',
      }
    })
  }, [entriesForHole, allTeams])

  const teamEntries = useMemo(() => {
    return enrichedEntries.filter((entry) => entry.team_id === team.id)
  }, [enrichedEntries, team.id])

  const teamLeaderboard = useMemo(() => {
    return buildKegStandTeamLeaderboard(entriesForHole).map((row) => {
      const t = allTeams.find((teamRow) => teamRow.id === row.team_id)
      return {
        ...row,
        teamLabel: t
          ? `Team ${t.team_number}: ${t.theme || t.name}`
          : 'Unknown team',
      }
    })
  }, [entriesForHole, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.primaryAction}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.controlsRow}>
            <select
              aria-label="Team member"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              style={{ ...styles.input, ...styles.memberInput }}
            >
              <option value="">Select team member</option>
              {team.members?.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>

            <input
              aria-label="Seconds"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              style={{ ...styles.input, ...styles.secondsInput }}
            />

            <button
              type="submit"
              disabled={saving || !memberName || seconds === ''}
              style={styles.primaryButton}
            >
              {saving
                ? 'Saving...'
                : editingEntryId
                ? 'Update entry'
                : 'Add entry'}
            </button>
          </div>

          {editingEntryId ? (
            <button type="button" onClick={cancelEdit} style={styles.secondaryButton}>
              Cancel edit
            </button>
          ) : null}
        </form>
      </section>

      {teamEntries.length > 0 && (
        <section style={styles.simpleSection}>
          <h3 style={styles.heading}>Your entries</h3>
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

      <div style={styles.leaderboardToggle}>
        <button
          type="button"
          style={styles.leaderboardBtn}
          onClick={() => setShowLeaderboard((v) => !v)}
        >
          {showLeaderboard ? 'Hide leaderboard' : '🏆 Leaderboard'}
        </button>
      </div>

      {showLeaderboard && (
        <LeaderboardCard
          sections={[
            {
              id: 'individual',
              title: 'Individual times',
              loading: false,
              rows: enrichedEntries,
              emptyText: 'No entries yet.',
              getKey: (entry) => entry.id,
              renderRow: (entry, index) => (
                <>
                  <span style={styles.leaderboardRank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.leaderboardInfo}>
                    <span style={styles.leaderboardName}>{entry.member_name}</span>
                    <span style={styles.leaderboardMeta}>{entry.teamLabel}</span>
                  </div>
                  <span style={styles.leaderboardStat}>{formatSeconds(entry.seconds)}</span>
                </>
              ),
            },
            {
              id: 'teams',
              title: 'Team scores',
              loading: false,
              rows: teamLeaderboard,
              emptyText: 'No team results yet.',
              getKey: (row) => row.team_id,
              renderRow: (row, index) => (
                <>
                  <span style={styles.leaderboardRank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.leaderboardInfo}>
                    <span style={styles.leaderboardName}>{row.teamLabel}</span>
                    <span style={styles.leaderboardMeta}>{formatSeconds(row.average)}</span>
                  </div>
                  <span style={styles.leaderboardStat}>+{row.rankScore}</span>
                </>
              ),
            },
          ]}
        />
      )}

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  )
}

const styles = {
  wrap: { marginTop: 6, display: 'grid', gap: 12 },
  primaryAction: {
    display: 'grid',
    gap: 8,
    paddingTop: 4,
  },
  simpleSection: {
    paddingTop: 10,
    borderTop: '1px solid #e3e9e3',
    display: 'grid',
    gap: 8,
  },
  form: { display: 'grid', gap: 8 },
  controlsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  input: {
    padding: 11,
    borderRadius: 11,
    border: '1px solid #ccd6ce',
    fontSize: 15,
    background: '#fff',
    minHeight: 42,
  },
  memberInput: {
    flex: '1 1 190px',
  },
  secondsInput: {
    flex: '0 1 130px',
  },
  primaryButton: {
    padding: '11px 14px',
    minHeight: 44,
    borderRadius: 11,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontWeight: 800,
  },
  secondaryButton: {
    width: 'fit-content',
    border: 'none',
    background: 'transparent',
    color: '#4f6458',
    padding: 0,
    fontSize: '0.84rem',
    fontWeight: 700,
  },
  smallSecondaryButton: {
    border: 'none',
    background: 'transparent',
    color: '#446355',
    fontWeight: 600,
    fontSize: '0.8rem',
    padding: 0,
  },
  smallDangerButton: {
    border: 'none',
    background: 'transparent',
    color: '#8a1f1f',
    fontWeight: 600,
    fontSize: '0.8rem',
    padding: 0,
  },
  heading: {
    margin: 0,
    fontSize: '0.92rem',
    color: '#194c31',
    fontWeight: 800,
  },
  list: { display: 'grid', gap: 0 },
  row: {
    padding: '7px 0',
    borderTop: '1px solid #e7efe8',
    display: 'grid',
    gap: 2,
  },
  rowText: {
    color: '#2c4236',
    fontSize: '0.9rem',
    lineHeight: 1.35,
  },
  rowActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  leaderboardToggle: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 4,
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
  },
  error: {
    color: '#a12626',
    margin: 0,
  },
}