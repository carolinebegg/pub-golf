import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calculateStandardHoleScore, formatCurrency } from '../lib/helpers'

function getInitialFormState(existingScore) {
  return {
    drinkName: existingScore?.drink_name ?? '',
    sips: existingScore?.sips ?? '',
    isGuinness: existingScore?.is_guinness ?? false,
    paidBy: existingScore?.paid_by ?? '',
    price: existingScore?.price ?? '',
    bunkerCompleted: existingScore?.bunker_completed ?? false,
    waterViolated: existingScore?.water_violated ?? false,
    spilledDrink: existingScore?.spilled_drink ?? false,
    threwUp: existingScore?.threw_up ?? false,
    photoboothMissing: existingScore?.photobooth_missing ?? false,
    splitGBonus: existingScore?.split_g_bonus ?? 0,
    bonusPenalty: existingScore?.bonus_penalty ?? 0,
    notes: existingScore?.notes ?? '',
  }
}

export default function StandardHoleForm({
  hole,
  team,
  existingScore = null,
  onChanged,
}) {
  const [form, setForm] = useState(getInitialFormState(existingScore))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(getInitialFormState(existingScore))
    setMessage('')
    setError('')
  }, [existingScore?.id, hole?.id, team?.id])

  const computedPreviewScore = useMemo(() => {
    return calculateStandardHoleScore({
      sips: form.sips,
      is_guinness: form.isGuinness,
      water_violated: form.waterViolated,
      threw_up: form.threwUp,
      spilled_drink: form.spilledDrink,
      photobooth_missing: form.photoboothMissing,
      bonus_penalty: form.bonusPenalty,
      split_g_bonus: form.splitGBonus,
    })
  }, [form])

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!hole?.id || !team?.id) {
      setError('Missing hole or team.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    const payload = {
      team_id: team.id,
      hole_id: hole.id,
      drink_name: form.drinkName.trim() || null,
      sips: Number(form.sips || 0),
      is_guinness: Boolean(form.isGuinness),
      paid_by: form.paidBy || null,
      price: form.price === '' ? null : Number(form.price),
      bunker_completed: Boolean(form.bunkerCompleted),
      water_violated: Boolean(form.waterViolated),
      spilled_drink: Boolean(form.spilledDrink),
      threw_up: Boolean(form.threwUp),
      photobooth_missing: Boolean(form.photoboothMissing),
      split_g_bonus: Number(form.splitGBonus || 0),
      bonus_penalty: Number(form.bonusPenalty || 0),
      notes: form.notes.trim() || null,
    }

    const { error: upsertError } = await supabase
      .from('scores')
      .upsert(payload, {
        onConflict: 'team_id,hole_id',
      })

    if (upsertError) {
      setError(upsertError.message)
      setSaving(false)
      return
    }

    setMessage(existingScore ? 'Score updated.' : 'Score saved.')
    setSaving(false)

    if (onChanged) {
      await onChanged()
    }
  }

  async function handleDelete() {
    if (!existingScore?.id) return

    const confirmed = window.confirm('Delete this score?')
    if (!confirmed) return

    setDeleting(true)
    setMessage('')
    setError('')

    const { error: deleteError } = await supabase
      .from('scores')
      .delete()
      .eq('id', existingScore.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    setForm(getInitialFormState(null))
    setMessage('Score deleted.')
    setDeleting(false)

    if (onChanged) {
      await onChanged()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.headerRow}>
        <div>
          <strong>{hole.bar_name}</strong>
          <div style={styles.muted}>Playing as {team.name}</div>
        </div>
        <div style={styles.scorePill}>Preview score: {computedPreviewScore ?? '—'}</div>
      </div>

      <input
        placeholder="Drink name"
        value={form.drinkName}
        onChange={(e) => updateField('drinkName', e.target.value)}
        style={styles.input}
      />

      <input
        placeholder="Number of sips"
        type="number"
        min="0"
        value={form.sips}
        onChange={(e) => updateField('sips', e.target.value)}
        style={styles.input}
      />

      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.isGuinness}
          onChange={(e) => updateField('isGuinness', e.target.checked)}
        />
        Guinness (-1)
      </label>

      <select
        value={form.paidBy}
        onChange={(e) => updateField('paidBy', e.target.value)}
        style={styles.input}
      >
        <option value="">Who paid?</option>
        {team.members?.map((member) => (
          <option key={member} value={member}>
            {member}
          </option>
        ))}
      </select>

      <input
        placeholder="Price"
        type="number"
        min="0"
        step="0.01"
        value={form.price}
        onChange={(e) => updateField('price', e.target.value)}
        style={styles.input}
      />

      {form.price !== '' && Number(form.price) >= 0 && (
        <div style={styles.muted}>Price: {formatCurrency(form.price)}</div>
      )}

      {hole.has_bunker && (
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.bunkerCompleted}
            onChange={(e) => updateField('bunkerCompleted', e.target.checked)}
          />
          Bunker completed
        </label>
      )}

      {hole.has_water && (
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.waterViolated}
            onChange={(e) => updateField('waterViolated', e.target.checked)}
          />
          Water violated / peed (+3)
        </label>
      )}

      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.spilledDrink}
          onChange={(e) => updateField('spilledDrink', e.target.checked)}
        />
        Spilled drink (+1)
      </label>

      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.threwUp}
          onChange={(e) => updateField('threwUp', e.target.checked)}
        />
        Threw up (+5)
      </label>

      {hole.bar_name === 'Tapster' && (
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.photoboothMissing}
            onChange={(e) => updateField('photoboothMissing', e.target.checked)}
          />
          No photobooth proof (+2)
        </label>
      )}

      <input
        placeholder="Split the G bonus"
        type="number"
        value={form.splitGBonus}
        onChange={(e) => updateField('splitGBonus', e.target.value)}
        style={styles.input}
      />

      <input
        placeholder="Extra bonus / penalty"
        type="number"
        value={form.bonusPenalty}
        onChange={(e) => updateField('bonusPenalty', e.target.value)}
        style={styles.input}
      />

      <textarea
        placeholder="Notes"
        value={form.notes}
        onChange={(e) => updateField('notes', e.target.value)}
        style={styles.textarea}
        rows={3}
      />

      <div style={styles.buttonRow}>
        <button type="submit" disabled={saving} style={styles.button}>
          {saving ? 'Saving...' : existingScore ? 'Update score' : 'Save score'}
        </button>

        {existingScore && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={styles.dangerButton}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </form>
  )
}

const styles = {
  form: {
    display: 'grid',
    gap: 10,
    marginTop: 14,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  scorePill: {
    padding: '8px 12px',
    borderRadius: 999,
    background: '#f4f4f4',
    border: '1px solid #ddd',
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ccc',
    fontSize: 16,
  },
  textarea: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ccc',
    fontSize: 16,
    resize: 'vertical',
  },
  checkboxRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
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
  muted: {
    color: '#666',
    fontSize: 14,
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