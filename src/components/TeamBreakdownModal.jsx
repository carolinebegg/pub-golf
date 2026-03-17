import { useEffect } from 'react'
import { formatCurrency, formatSeconds } from '../lib/helpers'

const SCORE_ADJUSTMENT_TOKENS = {
  teamKaraoke: '[adj:team-karaoke]',
  fadoBestGSplit: '[adj:fado-best-g-split]',
  fadoWorstGSplit: '[adj:fado-worst-g-split]',
}

function stripAdjustmentTokens(notes) {
  const raw = typeof notes === 'string' ? notes : ''

  return raw
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.teamKaraoke, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.fadoBestGSplit, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.fadoWorstGSplit, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function TeamBreakdownModal({ team = null, onClose }) {
  useEffect(() => {
    if (!team) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [team, onClose])

  if (!team) return null

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div className="breakdown-overlay" onMouseDown={handleBackdropMouseDown} role="presentation">
      <section
        className="breakdown-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${formatTeamTitle(team)} breakdown`}
      >
        <div className="breakdown-modal-header">
          <div>
            <p className="breakdown-modal-eyebrow">Team Breakdown</p>
            <h3 className="breakdown-modal-title">{formatTeamTitle(team)}</h3>
            <p className="breakdown-modal-members">{formatMembers(team.members)}</p>
          </div>

          <button type="button" className="breakdown-close-button" onClick={() => onClose?.()}>
            X
          </button>
        </div>

        <div className="breakdown-modal-summary">
          <div>
            <span className="breakdown-summary-label">Total score</span>
            <strong className="breakdown-summary-value">{team.totalScore}</strong>
          </div>
          <div>
            <span className="breakdown-summary-label">Completed</span>
            <strong className="breakdown-summary-value">{team.holesCompleted} / {team.holeBreakdown.length}</strong>
          </div>
        </div>

        <div className="breakdown-modal-scroll">
          {team.holeBreakdown.map((hole) => (
            <article key={hole.holeId} className="breakdown-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Hole {hole.holeNumber} - {hole.holeName}</h4>
                <p className="breakdown-row-type">{hole.displayTypeLabel || formatHoleType(hole.holeType)}</p>
                <p className="breakdown-row-detail">
                  {hole.score === null ? 'Not completed yet' : renderHoleDetails(hole)}
                </p>
              </div>
              <div className="breakdown-row-score">{hole.score === null ? '-' : hole.score}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function formatTeamTitle(team) {
  if (team.theme) return team.theme
  if (team.teamName) return team.teamName
  if (team.teamNumber !== null && team.teamNumber !== undefined) {
    return `Team ${team.teamNumber}`
  }
  return 'Team'
}

function formatMembers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return 'No team members listed'
  }

  return members.filter(Boolean).join(' • ')
}

function renderHoleDetails(hole) {
  if (hole.holeType === 'keg_stand') {
    const avg = hole.details?.average
    const count = hole.details?.count ?? 0

    if (avg === null || avg === undefined) {
      return 'No keg stand entries'
    }

    return `${count} ${count === 1 ? 'entry' : 'entries'} • ${formatSeconds(avg)} average`
  }

  if (hole.holeType === 'pitcher') {
    const finishedAt = hole.details?.finished_at
    if (!finishedAt) return 'No finish recorded'

    return `Finished at ${new Date(finishedAt).toLocaleTimeString()}`
  }

  const details = hole.details || {}

  if (hole.holeType === 'standard' && details.is_bunker_hazard) {
    const who = details.drinker_name || 'Someone'
    const shot = details.drink_name || 'bunker hazard shot'
    const extras = []

    if (details.notes) {
      const cleanNotes = stripAdjustmentTokens(details.notes)
      if (cleanNotes) extras.push(cleanNotes)
    }

    const base = `Bunker hazard: ${who} (${shot})`
    if (!extras.length) return base

    return `${base} • ${extras.join(' • ')}`
  }
  const bits = []
  const rawNotes = typeof details.notes === 'string' ? details.notes : ''

  const hasTeamKaraoke = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.teamKaraoke)
  const hasFadoBestGSplit = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.fadoBestGSplit)
  const hasFadoWorstGSplit = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.fadoWorstGSplit)

  if (details.drink_name) bits.push(details.drink_name)
  if (details.sips !== null && details.sips !== undefined) bits.push(`${details.sips} sips`)
  if (details.paid_by) bits.push(`paid by ${details.paid_by}`)
  if (details.price !== null && details.price !== undefined) bits.push(formatCurrency(details.price))

  const flags = []
  if (details.is_guinness) flags.push('Guinness')
  if (details.water_violated) flags.push('water violated')
  if (details.spilled_drink) flags.push('spilled drink')
  if (details.threw_up) flags.push('threw up')
  if (details.photobooth_missing) flags.push('no photobooth proof')

  if (hasTeamKaraoke) flags.push('team karaoke (-5)')
  if (hasFadoBestGSplit) flags.push('best g split (-1)')
  if (hasFadoWorstGSplit) flags.push('worst g split (+3)')

  const adjustedSplitGBonus =
    Number(details.split_g_bonus || 0) -
    (hasFadoBestGSplit ? 1 : 0)

  const adjustedBonusPenalty =
    Number(details.bonus_penalty || 0) -
    (hasTeamKaraoke ? -5 : 0) -
    (hasFadoWorstGSplit ? 3 : 0)

  if (adjustedSplitGBonus) flags.push(`Split the G bonus ${adjustedSplitGBonus}`)
  if (adjustedBonusPenalty) flags.push(`bonus/penalty ${adjustedBonusPenalty}`)

  let text = bits.join(' • ')
  if (flags.length) {
    text = text ? `${text} • ${flags.join(' • ')}` : flags.join(' • ')
  }

  const cleanNotes = stripAdjustmentTokens(rawNotes)
  if (cleanNotes) {
    text = text ? `${text} • ${cleanNotes}` : cleanNotes
  }

  return text || 'Standard hole completed'
}

function formatHoleType(holeType) {
  switch (holeType) {
    case 'keg_stand':
      return 'Keg stand'
    case 'pitcher':
      return 'Pitcher race'
    case 'standard':
    default:
      return 'Standard'
  }
}
