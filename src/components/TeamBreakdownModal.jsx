import { useEffect } from 'react'
import { formatCurrency, formatSeconds } from '../lib/helpers'

const SCORE_ADJUSTMENT_TOKENS = {
  teamKaraoke: '[adj:team-karaoke]',
  fadoBestGSplit: '[adj:fado-best-g-split]',
  fadoWorstGSplit: '[adj:fado-worst-g-split]',
  worm: '[adj:worm]',
  tapsterPhotobooth: '[adj:tapster-photobooth]',
  guinnessGlass: '[adj:guinness-glass]',
  vlogIrish: '[adj:vlog-irish]',
  moonStranger: '[adj:moon-stranger]',
}

function stripAdjustmentTokens(notes) {
  const raw = typeof notes === 'string' ? notes : ''

  return raw
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.teamKaraoke, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.fadoBestGSplit, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.fadoWorstGSplit, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.guinnessGlass, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.worm, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.tapsterPhotobooth, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.vlogIrish, '')
    .replaceAll(SCORE_ADJUSTMENT_TOKENS.moonStranger, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function TeamBreakdownModal({ team = null, players = [], onClose }) {
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
                  {hole.score === null ? 'Not completed yet' : renderHoleDetails(hole, players)}
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
  return team.theme || team.teamName || 'Team'
}

function ordinal(n) {
  if (!Number.isFinite(n) || n < 1) return String(n)
  const s = String(n)
  const last = s.slice(-1)
  const lastTwo = s.slice(-2)
  if (lastTwo === '11' || lastTwo === '12' || lastTwo === '13') return `${n}th`
  if (last === '1') return `${n}st`
  if (last === '2') return `${n}nd`
  if (last === '3') return `${n}rd`
  return `${n}th`
}

function formatMembers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return 'No team members listed'
  }

  return members.filter(Boolean).join(' • ')
}

function renderHoleDetails(hole, players = []) {
  if (hole.holeType === 'keg_stand') {
    const avg = hole.details?.average
    const entries = hole.details?.entries ?? []

    if (avg === null || avg === undefined) {
      return 'No keg stand entries'
    }

    const bestEntry = entries.length
      ? entries.reduce((best, e) => {
          const s = Number(e?.seconds)
          const bestS = Number(best?.seconds)
          return Number.isFinite(s) && (!Number.isFinite(bestS) || s > bestS) ? e : best
        }, null)
      : null
    const bestSeconds = bestEntry != null && Number.isFinite(Number(bestEntry.seconds)) ? bestEntry.seconds : null
    const bestPlayerName = bestEntry?.player_id != null
      ? players.find((p) => p.id === bestEntry.player_id)?.name ?? null
      : null
    const avgStr = formatSeconds(avg)
    const bestStr = bestSeconds != null ? formatSeconds(bestSeconds) : null
    return (
      <>
        Average: <strong>{avgStr}</strong>
        {bestStr != null && (
          <>
            <span style={{ fontWeight: 'normal' }}> • </span>
            Best: <strong>{bestStr}</strong>{bestPlayerName ? ` (${bestPlayerName})` : ''}
          </>
        )}
      </>
    )
  }

  if (hole.holeType === 'pitcher') {
    const rank = hole.details?.rank
    if (rank == null) return 'No finish recorded'

    const place = Number(rank) + 1
    const ord = ordinal(place)
    return (
      <>
        Finish: <strong>{ord} place</strong>
      </>
    )
  }

  if (hole.details?.isGuinnessVoteHole) {
    if (hole.score === null) return 'No votes yet'
    const parts = []
    if (hole.details.bestAward) parts.push('Best Split G (−3)')
    if (hole.details.worstAward) parts.push('Worst Split G (+3)')
    if (!parts.length) parts.push('No best/worst award')
    return parts.join(' • ')
  }

  const details = hole.details || {}

  if (hole.holeType === 'standard' && hole.bunkerEntry) {
    const who =
      hole.bunkerEntry.player_id != null
        ? players.find((p) => p.id === hole.bunkerEntry.player_id)?.name ?? 'Someone'
        : 'Someone'
    const shot = hole.bunkerEntry.shot_name || 'bunker hazard shot'
    const extras = []

    if (details.notes) {
      const cleanNotes = stripAdjustmentTokens(details.notes)
      if (cleanNotes) extras.push(cleanNotes)
    }

    const base = `${who} (${shot})`
    if (!extras.length) return base

    return `${base} • ${extras.join(' • ')}`
  }
  const bits = []
  const rawNotes = typeof details.notes === 'string' ? details.notes : ''

  const hasTeamKaraoke = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.teamKaraoke)
  const hasFadoBestGSplit = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.fadoBestGSplit)
  const hasFadoWorstGSplit = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.fadoWorstGSplit)
  const hasWorm = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.worm)
  const hasTapsterPhotobooth = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.tapsterPhotobooth)
  const hasGuinnessGlass = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.guinnessGlass)
  const hasVlogIrish = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.vlogIrish)
  const hasMoonStranger = rawNotes.includes(SCORE_ADJUSTMENT_TOKENS.moonStranger)

  const drinkerName = details.player_id != null ? players.find((p) => p.id === details.player_id)?.name : null
  if (drinkerName) bits.push(drinkerName)
  if (details.sips !== null && details.sips !== undefined) {
    const n = details.sips
    bits.push(`${n} ${Number(n) === 1 ? 'sip' : 'sips'}`)
  }
  if (details.drink_name) bits.push(details.drink_name)
  const paidByName = details.paid_by_player_id != null
    ? players.find((p) => p.id === details.paid_by_player_id)?.name
    : null
  const price = details.price !== null && details.price !== undefined ? details.price : null

  const flags = []
  if (details.is_guinness) flags.push('Guinness')
  if (details.water_violated) flags.push('water violated')
  if (details.spilled_drink) flags.push('spilled drink')
  if (details.threw_up) flags.push('threw up')
  if (details.photobooth_missing) flags.push('no photobooth proof')

  if (hasTeamKaraoke) flags.push('team karaoke (-5)')
  if (hasFadoBestGSplit) flags.push('best g split (-1)')
  if (hasFadoWorstGSplit) flags.push('worst g split (+3)')
  if (hasWorm) flags.push('do the worm (-2)')
  if (hasTapsterPhotobooth) flags.push('tapster photobooth (-4)')
  if (hasGuinnessGlass) flags.push('steal a Guinness glass (-2)')
  if (hasVlogIrish) flags.push('vlog with Irish person (-2)')
  if (hasMoonStranger) flags.push('moon a stranger (-2)')

  const adjustedSplitGBonus =
    Number(details.split_g_bonus || 0) -
    (hasFadoBestGSplit ? 1 : 0)

  const adjustedBonusPenalty =
    Number(details.bonus_penalty || 0) -
    (hasTeamKaraoke ? -5 : 0) -
    (hasFadoWorstGSplit ? 3 : 0) -
    (hasWorm ? -2 : 0) -
    (hasTapsterPhotobooth ? -4 : 0) -
    (hasGuinnessGlass ? -2 : 0) -
    (hasVlogIrish ? -2 : 0) -
    (hasMoonStranger ? -2 : 0)

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

  if (paidByName && price != null && Number.isFinite(Number(price))) {
    text = text ? `${text} | ${formatCurrency(price)} (${paidByName})` : `${formatCurrency(price)} (${paidByName})`
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
