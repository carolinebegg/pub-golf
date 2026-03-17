import { useMemo, useState } from 'react'
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
    splitGBonus:
      existingScore?.split_g_bonus === 0 || existingScore?.split_g_bonus
        ? String(existingScore.split_g_bonus)
        : '',
    bonusPenalty:
      existingScore?.bonus_penalty === 0 || existingScore?.bonus_penalty
        ? String(existingScore.bonus_penalty)
        : '',
    notes: existingScore?.notes ?? '',
  }
}

export default function StandardHoleForm({
  hole,
  team,
  existingScore = null,
  onChanged,
}) {
  const [form, setForm] = useState(() => getInitialFormState(existingScore))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showAdjustments, setShowAdjustments] = useState(
    Boolean(existingScore?.split_g_bonus || existingScore?.bonus_penalty)
  )

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

  async function handleSubmit(event) {
    event.preventDefault()

    if (!hole?.id || !team?.id) {
      setError('Missing hole or team.')
      return
    }

    const parsedSips = Number(form.sips)
    if (!Number.isFinite(parsedSips) || parsedSips <= 0) {
      setError('Enter a valid sip count (1 or more).')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    const payload = {
      team_id: team.id,
      hole_id: hole.id,
      drink_name: form.drinkName.trim() || null,
      sips: parsedSips,
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
      <section style={styles.previewRow}>
        <div style={styles.previewHeader}>
          <strong>Score preview</strong>
          <span style={styles.previewValue}>{computedPreviewScore ?? '-'}</span>
        </div>
        <p style={styles.previewHelp}>
          Starts with sips, then penalties and bonuses are applied automatically.
        </p>
      </section>

      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>Score</h5>

        <div style={styles.inlineGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Number of sips <em style={styles.requiredTag}>(required)</em></span>
            <input
              type="number"
              min="1"
              required
              value={form.sips}
              onChange={(e) => updateField('sips', e.target.value)}
              style={styles.input}
              placeholder="1"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Drink name <em style={styles.optionalTag}>(optional)</em></span>
            <input
              value={form.drinkName}
              onChange={(e) => updateField('drinkName', e.target.value)}
              style={styles.input}
              placeholder="Example: Guinness"
            />
          </label>
        </div>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.isGuinness}
            onChange={(e) => updateField('isGuinness', e.target.checked)}
          />
          Guinness bonus (-1)
        </label>
      </section>

      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>Details</h5>

        <div style={styles.inlineGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Who paid <em style={styles.optionalTag}>(optional)</em></span>
            <select
              value={form.paidBy}
              onChange={(e) => updateField('paidBy', e.target.value)}
              style={styles.input}
            >
              <option value="">No payer selected</option>
              {team.members?.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Price (USD) <em style={styles.optionalTag}>(optional)</em></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              style={styles.input}
              placeholder="0.00"
            />
          </label>
        </div>

        {form.price !== '' && Number(form.price) >= 0 ? (
          <div style={styles.inlineNote}>Price preview: {formatCurrency(form.price)}</div>
        ) : null}
      </section>

      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>Adjustments</h5>

        {hole.has_bunker ? (
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.bunkerCompleted}
              onChange={(e) => updateField('bunkerCompleted', e.target.checked)}
            />
            Bunker completed
          </label>
        ) : null}

        {hole.has_water ? (
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.waterViolated}
              onChange={(e) => updateField('waterViolated', e.target.checked)}
            />
            Water violated / peed (+3)
          </label>
        ) : null}

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

        {hole.bar_name === 'Tapster' ? (
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.photoboothMissing}
              onChange={(e) => updateField('photoboothMissing', e.target.checked)}
            />
            No photobooth proof (+2)
          </label>
        ) : null}

        <button
          type="button"
          style={styles.revealButton}
          onClick={() => setShowAdjustments((current) => !current)}
        >
          {showAdjustments ? 'Hide manual adjustments' : 'Manual adjustments'}
        </button>

        {showAdjustments ? (
          <div style={styles.adjustmentGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Split the G bonus</span>
              <input
                type="number"
                value={form.splitGBonus}
                onChange={(e) => updateField('splitGBonus', e.target.value)}
                style={styles.input}
                placeholder="Optional"
              />
              <small style={styles.helperText}>Use a positive number to subtract points.</small>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Manual adjustment</span>
              <input
                type="number"
                value={form.bonusPenalty}
                onChange={(e) => updateField('bonusPenalty', e.target.value)}
                style={styles.input}
                placeholder="Optional"
              />
              <small style={styles.helperText}>Use plus or minus values as needed.</small>
            </label>
          </div>
        ) : null}
      </section>

      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>Notes</h5>

        <label style={styles.field}>
          <span style={styles.label}>Extra notes <em style={styles.optionalTag}>(optional)</em></span>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            style={styles.textarea}
            rows={3}
            placeholder="Anything important about this hole"
          />
        </label>
      </section>

      <div style={styles.buttonRow}>
        <button type="submit" disabled={saving} style={styles.button}>
          {saving ? 'Saving...' : existingScore ? 'Update score' : 'Save score'}
        </button>

        {existingScore ? (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={styles.dangerButton}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        ) : null}
      </div>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </form>
  )
}

const styles = {
  form: {
    display: 'grid',
    gap: 12,
    marginTop: 6,
  },
  previewRow: {
    display: 'grid',
    gap: 4,
    padding: '8px 12px',
    borderRadius: 10,
    background: '#f0f7f2',
    border: '1px solid #c8dfd0',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  previewValue: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#1f5c3b',
  },
  previewHelp: {
    margin: 0,
    color: '#576960',
    fontSize: '0.84rem',
    lineHeight: 1.32,
  },
  section: {
    display: 'grid',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #dde8df',
    background: '#f8faf8',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.78rem',
    color: '#4a6054',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  inlineGrid: {
    display: 'grid',
    gap: 8,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: '0.9rem',
    color: '#1f3027',
    fontWeight: 700,
  },
  requiredTag: {
    fontStyle: 'normal',
    color: '#1a5c3a',
    fontWeight: 700,
  },
  optionalTag: {
    fontStyle: 'normal',
    color: '#72847b',
    fontWeight: 600,
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: '1px solid #cdd7cf',
    fontSize: 15,
    background: '#fff',
  },
  textarea: {
    padding: 10,
    borderRadius: 10,
    border: '1px solid #cdd7cf',
    fontSize: 15,
    resize: 'vertical',
    background: '#fff',
  },
  checkboxRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    color: '#31493c',
    fontSize: '0.9rem',
  },
  revealButton: {
    justifySelf: 'start',
    border: 'none',
    background: 'transparent',
    color: '#1f5c3b',
    fontWeight: 700,
    padding: 0,
    cursor: 'pointer',
    fontSize: '0.84rem',
  },
  adjustmentGrid: {
    display: 'grid',
    gap: 8,
  },
  helperText: {
    color: '#6a7a71',
    fontSize: '0.8rem',
  },
  inlineNote: {
    color: '#5f6e65',
    fontSize: 13,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    padding: 11,
    minHeight: 44,
    borderRadius: 11,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontWeight: 800,
  },
  dangerButton: {
    padding: 11,
    minHeight: 44,
    borderRadius: 11,
    border: 'none',
    background: 'transparent',
    color: '#8a1f1f',
    fontWeight: 700,
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
