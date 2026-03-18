import { useMemo } from 'react'
import HoleLeaderboard from './HoleLeaderboard'

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

      <HoleLeaderboard
        layout="split"
        gridMinWidth={260}
        sections={[
          {
            id: 'best-split-g',
            title: 'Best Split G',
            rows: best,
            emptyText: 'No votes yet.',
            getKey: (row) => `${row.teamId}::${row.memberName}`,
            columns: (row) => ({
              primary: row.memberName,
              secondary: row.teamName || 'Team',
              stat: `${row.votes} vote${row.votes === 1 ? '' : 's'}`,
            }),
          },
          {
            id: 'worst-split-g',
            title: 'Worst Split G',
            rows: worst,
            emptyText: 'No votes yet.',
            getKey: (row) => `${row.teamId}::${row.memberName}`,
            columns: (row) => ({
              primary: row.memberName,
              secondary: row.teamName || 'Team',
              stat: `${row.votes} vote${row.votes === 1 ? '' : 's'}`,
            }),
          },
        ]}
      />
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
}

