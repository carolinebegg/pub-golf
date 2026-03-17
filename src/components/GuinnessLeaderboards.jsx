import { useMemo } from 'react'
import LeaderboardCard from './LeaderboardCard'

function buildMemberLeaderboard(votes = [], teams = [], fieldPrefix) {
  const nameField = `${fieldPrefix}_voted_member_name`
  const teamField = `${fieldPrefix}_voted_team_id`

  const teamById = new Map(teams.map((team) => [team.id, team]))
  const counts = new Map()

  for (const vote of votes) {
    const memberName = vote?.[nameField]
    const teamId = vote?.[teamField]
    if (!memberName || !teamId) continue

    const key = `${teamId}::${memberName}`
    const current = counts.get(key) || {
      memberName,
      teamId,
      teamName: teamById.get(teamId)?.name || teamById.get(teamId)?.theme || null,
      votes: 0,
    }

    current.votes += 1
    counts.set(key, current)
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName)
    return String(a.teamName || '').localeCompare(String(b.teamName || ''))
  })
}

function formatTeamLabel(team) {
  if (!team) return 'Unknown team'
  if (team.theme) return team.theme
  if (team.name) return team.name
  if (team.team_number !== null && team.team_number !== undefined) {
    return `Team ${team.team_number}`
  }
  return 'Team'
}

export default function GuinnessLeaderboards({ votes = [], teams = [] }) {
  const { best, worst } = useMemo(() => {
    const withLabels = teams.map((team) => ({
      ...team,
      _displayLabel: formatTeamLabel(team),
    }))

    return {
      best: buildMemberLeaderboard(votes, withLabels, 'best'),
      worst: buildMemberLeaderboard(votes, withLabels, 'worst'),
    }
  }, [votes, teams])

  if (!best.length && !worst.length) {
    return null
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Guinness Split Awards</h2>
        <div style={styles.subtitle}>Votes from Guinness holes</div>
      </div>

      <div style={styles.grid}>
        <LeaderboardCard
          sections={[
            {
              id: 'best-split-g',
              title: 'Best Split G',
              loading: false,
              rows: best,
              emptyText: 'No votes yet.',
              getKey: (row) => `${row.teamId}::${row.memberName}`,
              renderRow: (row, index) => (
                <>
                  <span style={styles.rank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.info}>
                    <span style={styles.name}>{row.memberName}</span>
                    <span style={styles.meta}>{row.teamName || 'Team'}</span>
                  </div>
                  <span style={styles.stat}>
                    {row.votes} vote{row.votes === 1 ? '' : 's'}
                  </span>
                </>
              ),
            },
          ]}
        />

        <LeaderboardCard
          sections={[
            {
              id: 'worst-split-g',
              title: 'Worst Split G',
              loading: false,
              rows: worst,
              emptyText: 'No votes yet.',
              getKey: (row) => `${row.teamId}::${row.memberName}`,
              renderRow: (row, index) => (
                <>
                  <span style={styles.rank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.info}>
                    <span style={styles.name}>{row.memberName}</span>
                    <span style={styles.meta}>{row.teamName || 'Team'}</span>
                  </div>
                  <span style={styles.stat}>
                    {row.votes} vote{row.votes === 1 ? '' : 's'}
                  </span>
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  )
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
    fontSize: '1.25rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  grid: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  },
  card: {
    border: '1.5px solid #b8d9c4',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#f6fbf7',
  },
  leaderboardSectionHeader: {
    background: '#2d6a4a',
    color: '#fff',
    padding: '6px 14px',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: 0,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 12px',
    borderTop: '1px solid #e3ede6',
  },
  rank: {
    fontSize: '1.1rem',
    minWidth: 28,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    display: 'grid',
    gap: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 700,
    color: '#1f3027',
    fontSize: '0.9rem',
  },
  meta: {
    color: '#6a7d72',
    fontSize: '0.8rem',
  },
  stat: {
    fontWeight: 700,
    color: '#1f5a3a',
    fontSize: '0.88rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  empty: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    padding: '9px 12px',
  },
}

