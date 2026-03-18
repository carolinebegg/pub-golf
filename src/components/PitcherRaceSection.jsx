import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildPitcherLeaderboard, formatCurrency } from '../lib/helpers'
import HoleLeaderboard from './HoleLeaderboard'
import PrimaryActionButton from './PrimaryActionButton'

export default function PitcherRaceSection({
  hole,
  team,
  allTeams = [],
  players = [],
  finishesForHole = [],
  pitcherFinish = null,
  onChanged,
}) {
  const playersForTeam = useMemo(
    () =>
      (players || []).filter((p) => p.team_id === team?.id).sort((a, b) => (Number(a.rank) ?? 0) - (Number(b.rank) ?? 0)),
    [players, team?.id]
  )

  const [saving, setSaving] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [myFinish, setMyFinish] = useState(pitcherFinish)
  const [paidBy, setPaidBy] = useState(pitcherFinish?.paid_by_player_id != null ? String(pitcherFinish.paid_by_player_id) : '')
  const [price, setPrice] = useState(
    pitcherFinish?.price != null && pitcherFinish?.price !== '' ? String(pitcherFinish.price) : ''
  )
  const [error, setError] = useState('')
  const canViewLeaderboard = Boolean(myFinish)

  useEffect(() => {
    setShowResults(false)
    setLoading(false)
    setError('')
  }, [hole?.id, team?.id])

  useEffect(() => {
    setMyFinish(pitcherFinish || null)
    if (!pitcherFinish) {
      setShowResults(false)
      setPaidBy('')
      setPrice('')
    } else {
      setPaidBy(pitcherFinish.paid_by_player_id != null ? String(pitcherFinish.paid_by_player_id) : '')
      setPrice(pitcherFinish.price != null && pitcherFinish.price !== '' ? String(pitcherFinish.price) : '')
    }
  }, [pitcherFinish])

  async function markFinished() {
    if (!hole?.id || !team?.id) {
      setError('Missing hole or team.')
      return
    }

    if (myFinish) {
      setError('Finish already recorded. Use reset if you need to submit again.')
      return
    }

    setSaving(true)
    setError('')

    const finishedAt = new Date().toISOString()

    const payload = {
      hole_id: hole.id,
      team_id: team.id,
      finished_at: finishedAt,
      paid_by_player_id: paidBy || null,
      price: price !== '' && Number.isFinite(Number(price)) ? Number(price) : null,
    }

    const { error: saveError } = await supabase
      .from('pitcher_finishes')
      .upsert(payload, {
        onConflict: 'hole_id,team_id',
      })

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setMyFinish({
      hole_id: hole.id,
      team_id: team.id,
      finished_at: finishedAt,
      paid_by_player_id: paidBy || null,
      price: payload.price,
    })

    if (onChanged) {
      await onChanged()
    }

    setShowResults(true)
    setSaving(false)
  }

  async function saveDetails() {
    if (!hole?.id || !team?.id || !myFinish) return

    setSavingPayment(true)
    setError('')

    const { error: updateError } = await supabase
      .from('pitcher_finishes')
      .update({
        paid_by_player_id: paidBy || null,
        price: price !== '' && Number.isFinite(Number(price)) ? Number(price) : null,
      })
      .eq('hole_id', hole.id)
      .eq('team_id', team.id)

    if (updateError) {
      setError(updateError.message)
      setSavingPayment(false)
      return
    }

    if (onChanged) await onChanged()
    setSavingPayment(false)
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

    if (onChanged) {
      await onChanged()
    }

    setShowResults(false)
    setSaving(false)
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
        teamLabel: t ? (t.theme || 'Team') : 'Unknown team',
      }
    })
  }, [showResults, finishesForHole, allTeams])

  return (
    <div style={styles.wrap}>
      <section style={styles.detailsSection}>
        <h5 style={styles.detailsSectionTitle}>Details</h5>
        <div style={styles.detailsInlineGrid}>
          <label style={styles.detailsField}>
            <span style={styles.detailsLabel}>Who paid <em style={styles.detailsOptionalTag}>(optional)</em></span>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              style={styles.detailsInput}
            >
              <option value="">No payer selected</option>
              {playersForTeam.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.detailsField}>
            <span style={styles.detailsLabel}>Price (USD) <em style={styles.detailsOptionalTag}>(optional)</em></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={styles.detailsInput}
              placeholder="0.00"
            />
          </label>
        </div>
        {price !== '' && Number(price) >= 0 ? (
          <div style={styles.detailsInlineNote}>Price preview: {formatCurrency(price)}</div>
        ) : null}
        {myFinish ? (
          <button
            type="button"
            onClick={saveDetails}
            disabled={savingPayment}
            style={styles.savePaymentButton}
          >
            {savingPayment ? 'Saving...' : 'Save payment'}
          </button>
        ) : null}
      </section>

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
        <HoleLeaderboard
          layout="stacked"
          sections={[
            {
              id: 'finish-order',
              title: 'Finish order',
              loading,
              rows: leaderboard,
              emptyText: 'No finishes yet.',
              getKey: (row) => row.id || row.team_id,
              columns: (row) => ({
                primary: row.teamLabel,
                secondary: new Date(row.finished_at).toLocaleTimeString(),
                stat: `+${row.rankScore}`,
              }),
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
  detailsSection: {
    display: 'grid',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #dde8df',
    background: '#f8faf8',
  },
  detailsSectionTitle: {
    margin: 0,
    fontSize: '0.78rem',
    color: '#4a6054',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  detailsInlineGrid: {
    display: 'grid',
    gap: 8,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  },
  detailsField: {
    display: 'grid',
    gap: 6,
  },
  detailsLabel: {
    fontSize: '0.9rem',
    color: '#1f3027',
    fontWeight: 700,
  },
  detailsOptionalTag: {
    fontStyle: 'normal',
    color: '#72847b',
    fontWeight: 600,
  },
  detailsInput: {
    padding: 10,
    borderRadius: 10,
    border: '1px solid #cdd7cf',
    fontSize: 15,
    background: '#fff',
  },
  detailsInlineNote: {
    color: '#5f6e65',
    fontSize: 13,
  },
  savePaymentButton: {
    justifySelf: 'start',
    border: 'none',
    background: 'transparent',
    color: '#1f5c3b',
    fontWeight: 700,
    padding: 0,
    cursor: 'pointer',
    fontSize: '0.84rem',
  },
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
    cursor: 'pointer',
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
  error: {
    color: '#a12626',
    margin: 0,
    fontWeight: 700,
  },
}
