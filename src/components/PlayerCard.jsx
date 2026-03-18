import { useEffect, useState } from 'react'
import { formatSeconds } from '../lib/helpers'

const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F']

/**
 * Expected shape when wired to public.player_stats (backend).
 * Uses keg_stand_length_seconds (numeric 6,2).
 */
function formatStatValue(key, value) {
  if (value == null || value === '') return '—'
  if (key === 'keg_stand_length_seconds') {
    const n = Number(value)
    return Number.isFinite(n) ? formatSeconds(n) : '—'
  }
  return String(value)
}

function rankSortIndex(rank) {
  const r = String(rank ?? '').toUpperCase().trim()
  const i = RANK_ORDER.indexOf(r)
  return i === -1 ? RANK_ORDER.length : i
}

export function sortPlayersByRank(players) {
  return [...players].sort(
    (a, b) => rankSortIndex(a.rank) - rankSortIndex(b.rank)
  )
}

export default function PlayerCard({
  player,
  teamName = '',
  teamEmoji = '',
  stats = null,
}) {
  const [flipped, setFlipped] = useState(false)

  const displayRank = player.rank != null && player.rank !== '' ? String(player.rank) : '—'

  const totalDrinks = stats ? formatStatValue('total_drinks', stats.total_drinks) : '—'
  const bunkerHazards = stats ? formatStatValue('bunker_hazards', stats.bunker_hazards) : '—'
  const averageSips = stats ? formatStatValue('average_sips', stats.average_sips) : '—'
  const kegStandLength = stats ? formatStatValue('keg_stand_length_seconds', stats.keg_stand_length_seconds) : '—'
  const holesCompleted = stats ? formatStatValue('holes_completed', stats.holes_completed) : '—'
  const awards = stats?.awards != null && stats.awards !== '' ? String(stats.awards) : '—'

  function openBack() {
    setFlipped(true)
  }

  function closeBack() {
    setFlipped(false)
  }

  useEffect(() => {
    if (!flipped) return
    function handleEscape(e) {
      if (e.key === 'Escape') closeBack()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [flipped])

  return (
    <>
      <button
        type="button"
        className="player-card"
        onClick={openBack}
        aria-label={`View ${player.name} stats`}
      >
        <div className="player-card-inner">
          <div className="player-card-front">
            <div className="player-card-rank">{displayRank}</div>
            <div className="player-card-name">{player.name || '—'}</div>
            <div className="player-card-team">
              {teamEmoji ? (
                <span className="player-card-emoji" aria-label={teamName || undefined}>
                  {teamEmoji}
                </span>
              ) : (
                teamName || '—'
              )}
            </div>
          </div>
        </div>
      </button>

      {flipped ? (
        <div
          className="player-card-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${player.name} stats`}
          onMouseDown={(e) => e.target === e.currentTarget && closeBack()}
        >
          <div className="player-card-back-panel">
            <button
              type="button"
              className="player-card-close"
              onClick={closeBack}
              aria-label="Close"
            >
              ×
            </button>
            <div className="player-card-back-header">
              <span className="player-card-back-name">{player.name || '—'}</span>
              <span className="player-card-back-team">{teamName || '—'}</span>
              <span className="player-card-back-rank">Rank {displayRank}</span>
            </div>
            <dl className="player-card-stats">
              <div className="player-card-stat">
                <dt>Total drinks</dt>
                <dd>{totalDrinks}</dd>
              </div>
              <div className="player-card-stat">
                <dt>Bunker hazards</dt>
                <dd>{bunkerHazards}</dd>
              </div>
              <div className="player-card-stat">
                <dt>Average sips</dt>
                <dd>{averageSips}</dd>
              </div>
              <div className="player-card-stat">
                <dt>Keg stand length</dt>
                <dd>{kegStandLength}</dd>
              </div>
              <div className="player-card-stat">
                <dt>Holes completed</dt>
                <dd>{holesCompleted}</dd>
              </div>
              <div className="player-card-stat">
                <dt>Awards</dt>
                <dd>{awards}</dd>
              </div>
            </dl>
            {!stats && (
              <p className="player-card-stats-note">Stats and awards will appear here once the backend is connected.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
