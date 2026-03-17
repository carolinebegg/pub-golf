import { useMemo, useState } from 'react'
import {
  buildOverallLeaderboardData,
  formatCurrency,
  formatSeconds,
} from '../lib/helpers'

export default function OverallLeaderboard({
  teams = [],
  holes = [],
  scores = [],
  kegStandEntries = [],
  pitcherFinishes = [],
  leaderboardData = null,
}) {
  const [expandedTeamId, setExpandedTeamId] = useState(null)

  const leaderboard = useMemo(() => {
    if (Array.isArray(leaderboardData)) {
      return leaderboardData
    }

    return buildOverallLeaderboardData({
      teams,
      holes,
      scores,
      kegStandEntries,
      pitcherFinishes,
    })
  }, [teams, holes, scores, kegStandEntries, pitcherFinishes, leaderboardData])

  if (!teams.length) {
    return (
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>Overall leaderboard</h2>
        </div>
        <div style={styles.emptyCard}>No teams yet.</div>
      </section>
    )
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Overall leaderboard</h2>
        <div style={styles.subtitle}>
          Lowest total score wins
        </div>
      </div>

      <div style={styles.list}>
        {leaderboard.map((team) => {
          const isExpanded = expandedTeamId === team.teamId
          const isTopTeam = team.rank === 1

          return (
            <div
              key={team.teamId}
              style={{
                ...styles.card,
                ...(isTopTeam ? styles.topCard : null),
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedTeamId(isExpanded ? null : team.teamId)
                }
                style={styles.cardButton}
              >
                <div style={styles.cardTop}>
                  <div style={styles.rankBlock}>
                    <div
                      style={{
                        ...styles.rankBadge,
                        ...(isTopTeam ? styles.topRankBadge : null),
                      }}
                    >
                      #{team.rank}
                    </div>
                  </div>

                  <div style={styles.teamBlock}>
                    <div style={styles.teamName}>{team.teamName}</div>
                    <div style={styles.teamMeta}>
                      {team.teamNumber ? `Team ${team.teamNumber}` : 'Team'}
                      {team.theme ? ` • ${team.theme}` : ''}
                    </div>
                  </div>

                  <div style={styles.scoreBlock}>
                    <div style={styles.scoreValue}>{team.totalScore}</div>
                    <div style={styles.scoreLabel}>total</div>
                  </div>
                </div>

                <div style={styles.cardBottom}>
                  <div style={styles.holesCompleted}>
                    {team.holesCompleted} / {holes.length} holes completed
                  </div>
                  <div style={styles.expandText}>
                    {isExpanded ? 'Hide breakdown ▲' : 'Show breakdown ▼'}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div style={styles.details}>
                  <div style={styles.breakdownList}>
                    {team.holeBreakdown.map((hole) => (
                      <div key={hole.holeId} style={styles.breakdownRow}>
                        <div style={styles.breakdownMain}>
                          <div style={styles.breakdownTitle}>
                            Hole {hole.holeNumber} — {hole.holeName}
                          </div>
                          <div style={styles.breakdownType}>
                            {formatHoleType(hole.holeType)}
                          </div>

                          {hole.score === null ? (
                            <div style={styles.muted}>Not completed</div>
                          ) : (
                            <div style={styles.detailText}>
                              {renderHoleDetails(hole)}
                            </div>
                          )}
                        </div>

                        <div style={styles.breakdownScore}>
                          {hole.score === null ? '—' : hole.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
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
  const bits = []

  if (details.drink_name) bits.push(details.drink_name)
  if (details.sips !== null && details.sips !== undefined) bits.push(`${details.sips} sips`)
  if (details.paid_by) bits.push(`paid by ${details.paid_by}`)
  if (details.price !== null && details.price !== undefined) {
    bits.push(formatCurrency(details.price))
  }

  const flags = []
  if (details.is_guinness) flags.push('Guinness')
  if (details.water_violated) flags.push('water violated')
  if (details.spilled_drink) flags.push('spilled drink')
  if (details.threw_up) flags.push('threw up')
  if (details.photobooth_missing) flags.push('no photobooth proof')
  if (details.split_g_bonus) flags.push(`Split the G bonus ${details.split_g_bonus}`)
  if (details.bonus_penalty) flags.push(`bonus/penalty ${details.bonus_penalty}`)

  let text = bits.join(' • ')
  if (flags.length) {
    text = text ? `${text} • ${flags.join(' • ')}` : flags.join(' • ')
  }

  if (details.notes) {
    text = text ? `${text} • ${details.notes}` : details.notes
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

const styles = {
  section: {
    display: 'grid',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'end',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '1.35rem',
  },
  subtitle: {
    color: '#666',
    fontSize: '0.95rem',
  },
  list: {
    display: 'grid',
    gap: 14,
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e6e1d6',
    overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
  },
  topCard: {
    borderColor: '#d5e6d6',
    background: '#f9fdf9',
  },
  cardButton: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    padding: 16,
    cursor: 'pointer',
  },
  cardTop: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 12,
    alignItems: 'center',
  },
  rankBlock: {
    display: 'flex',
    alignItems: 'center',
  },
  rankBadge: {
    minWidth: 48,
    height: 48,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1f5c3f',
    color: '#fff',
    fontWeight: 800,
  },
  topRankBadge: {
    background: '#2b7a4f',
  },
  teamBlock: {
    minWidth: 0,
  },
  teamName: {
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  teamMeta: {
    color: '#666',
    marginTop: 4,
    fontSize: '0.92rem',
  },
  scoreBlock: {
    textAlign: 'right',
    minWidth: 64,
  },
  scoreValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1f5c3f',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  scoreLabel: {
    color: '#666',
    fontSize: '0.85rem',
    marginTop: 4,
  },
  cardBottom: {
    marginTop: 12,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  holesCompleted: {
    color: '#666',
    fontSize: '0.95rem',
  },
  expandText: {
    color: '#1f5c3f',
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  details: {
    borderTop: '1px solid #eee',
    background: '#fcfbf8',
    padding: 16,
  },
  breakdownList: {
    display: 'grid',
    gap: 10,
  },
  breakdownRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 12,
    padding: 12,
    background: '#fff',
    border: '1px solid #ece7db',
    borderRadius: 12,
    alignItems: 'start',
  },
  breakdownMain: {
    minWidth: 0,
  },
  breakdownTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
  breakdownType: {
    color: '#7a6e57',
    fontSize: '0.9rem',
    marginBottom: 6,
  },
  detailText: {
    color: '#2e2e2e',
    fontSize: '0.95rem',
    lineHeight: 1.4,
  },
  breakdownScore: {
    minWidth: 40,
    textAlign: 'center',
    fontWeight: 800,
    fontSize: '1.1rem',
    color: '#1f5c3f',
  },
  muted: {
    color: '#777',
    fontSize: '0.95rem',
  },
  emptyCard: {
    padding: 16,
    background: '#fff',
    border: '1px solid #e6e1d6',
    borderRadius: 14,
  },
}