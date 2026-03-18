import { useMemo } from 'react'
import HoleLeaderboard from './HoleLeaderboard'

function buildLeaderboardByPlayerId(votes = [], players = [], teams = [], fieldPrefix) {
  const playerIdField = `${fieldPrefix}_voted_player_id`
  const playerById = new Map(players.map((p) => [p.id, p]))
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const counts = new Map()

  for (const vote of votes) {
    const pid = vote?.[playerIdField]
    if (!pid) continue

    const player = playerById.get(pid)
    const teamId = player?.team_id
    const key = pid
    const current = counts.get(key) || {
      playerId: pid,
      memberName: player?.name ?? '—',
      teamId: teamId ?? null,
      teamName: teamId ? (teamById.get(teamId)?.theme || null) : null,
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

export default function GuinnessLeaderboards({ votes = [], teams = [], players = [] }) {
  const { best, worst } = useMemo(
    () => ({
      best: buildLeaderboardByPlayerId(votes, players, teams, 'best'),
      worst: buildLeaderboardByPlayerId(votes, players, teams, 'worst'),
    }),
    [votes, players, teams]
  )

  if (!best.length && !worst.length) {
    return null
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Split the G Awards</h2>
        <div style={styles.subtitle}>Votes from Split the G holes</div>
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
            getKey: (row) => row.playerId,
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
            getKey: (row) => row.playerId,
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

