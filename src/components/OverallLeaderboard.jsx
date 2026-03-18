import { useMemo } from 'react'
import { buildOverallLeaderboardData } from '../lib/helpers'

export default function OverallLeaderboard({
  teams = [],
  holes = [],
  scores = [],
  kegStandEntries = [],
  pitcherFinishes = [],
  bunkerHazardEntries = [],
  leaderboardData = null,
  onOpenBreakdown,
}) {
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
      bunkerHazardEntries,
    })
  }, [teams, holes, scores, kegStandEntries, pitcherFinishes, bunkerHazardEntries, leaderboardData])

  if (!teams.length) {
    return (
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>Overall Leaderboard</h2>
        </div>
        <div style={styles.emptyCard}>No teams yet.</div>
      </section>
    )
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Overall Leaderboard</h2>
        <div style={styles.subtitle}>
            Lowest total score wins
        </div>
      </div>

      <div style={styles.list}>
        {leaderboard.map((team) => {
          const hasRank = Number.isFinite(team.rank)
          const hasStarted = team.holesCompleted > 0
          const podiumStyles = hasRank ? getPodiumStyles(team.rank) : {}

          return (
            <article
              key={team.teamId}
              style={{
                ...styles.card,
                ...(podiumStyles.cardStyle || null),
              }}
            >
              <div style={styles.cardTop}>
                <div style={styles.rankBlock}>
                  <div
                    style={{
                      ...styles.rankBadge,
                      ...(!hasRank ? styles.unrankedBadge : null),
                      ...(podiumStyles.badgeStyle || null),
                    }}
                  >
                    {hasRank ? `#${team.rank}` : '—'}
                  </div>
                </div>

                <div style={styles.teamBlock}>
                  <h3 style={styles.teamName}>{formatTeamTitle(team)}</h3>
                  <p style={styles.memberLine}>{formatMembers(team.members)}</p>
                </div>

                <div style={styles.scoreBlock}>
                  <div
                    style={{
                      ...styles.scoreValue,
                      ...(!hasStarted ? styles.unstartedScoreValue : null),
                    }}
                  >
                    {hasStarted ? team.totalScore : '—'}
                  </div>
                  <div style={styles.scoreLabel}>total</div>
                </div>
              </div>

              <div style={styles.cardBottom}>
                <div style={styles.holesCompleted}>
                  {team.holesCompleted} / {holes.length} holes completed
                </div>

                <button
                  type="button"
                  style={styles.breakdownButton}
                  onClick={() => onOpenBreakdown?.(team.teamId)}
                >
                  View breakdown
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function formatTeamTitle(team) {
  return team.theme || team.teamName || 'Team'
}

function formatMembers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return 'No team members listed'
  }

  return members.filter(Boolean).join(' • ')
}

function getPodiumStyles(rank) {
  switch (rank) {
    case 1:
      return {
        cardStyle: styles.goldCard,
        badgeStyle: styles.goldRankBadge,
      }
    case 2:
      return {
        cardStyle: styles.silverCard,
        badgeStyle: styles.silverRankBadge,
      }
    case 3:
      return {
        cardStyle: styles.bronzeCard,
        badgeStyle: styles.bronzeRankBadge,
      }
    default:
      return {}
  }
}

const styles = {
  section: {
    display: 'grid',
    gap: 10,
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
    fontSize: '1.45rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  list: {
    display: 'grid',
    gap: 10,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 16,
    border: '1px solid var(--surface-border)',
    padding: 14,
    boxShadow: '0 8px 18px rgba(8, 31, 18, 0.06)',
  },
  goldCard: {
    borderColor: '#d9d2a7',
    background: '#fffcf4',
  },
  silverCard: {
    borderColor: '#d2d8df',
    background: '#fbfcfd',
  },
  bronzeCard: {
    borderColor: '#e1c4af',
    background: '#fff8f3',
  },
  cardTop: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'center',
  },
  rankBlock: {
    display: 'flex',
    alignItems: 'center',
  },
  rankBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--green-700)',
    color: '#fff',
    fontWeight: 800,
  },
  unrankedBadge: {
    background: '#d5ddd8',
    color: '#4f6458',
  },
  goldRankBadge: {
    background: 'var(--gold-600)',
  },
  silverRankBadge: {
    background: '#8794a1',
  },
  bronzeRankBadge: {
    background: '#a86c49',
  },
  teamBlock: {
    minWidth: 0,
  },
  teamName: {
    margin: 0,
    fontSize: '1.06rem',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  memberLine: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.3,
  },
  scoreBlock: {
    textAlign: 'right',
    minWidth: 62,
  },
  scoreValue: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--green-700)',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  unstartedScoreValue: {
    color: '#7a8a81',
  },
  scoreLabel: {
    color: '#637168',
    fontSize: '0.85rem',
    marginTop: 4,
  },
  cardBottom: {
    marginTop: 10,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  holesCompleted: {
    color: '#637168',
    fontSize: '0.88rem',
  },
  breakdownButton: {
    border: '1px solid #c9d7cc',
    borderRadius: 10,
    padding: '8px 12px',
    background: '#fff',
    color: 'var(--green-700)',
    fontWeight: 700,
    fontSize: '0.84rem',
    cursor: 'pointer',
  },
  emptyCard: {
    padding: 16,
    background: 'var(--surface)',
    border: '1px solid var(--surface-border)',
    borderRadius: 16,
  },
}