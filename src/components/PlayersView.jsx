import { useMemo } from 'react'
import PlayerCard, { sortPlayersByRank } from './PlayerCard'

export default function PlayersView({ players = [], teams = [] }) {
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  )

  const sortedPlayers = useMemo(() => sortPlayersByRank(players), [players])

  const playerWithTeamName = useMemo(
    () =>
      sortedPlayers.map((player) => ({
        ...player,
        teamName:
          player.team_id != null
            ? teamById.get(player.team_id)?.theme ||
              teamById.get(player.team_id)?.name ||
              `Team ${teamById.get(player.team_id)?.team_number ?? '?'}`
            : '—',
      })),
    [sortedPlayers, teamById]
  )

  return (
    <section className="section-stack">
      <div className="section-header">
        <h2>Players</h2>
      </div>
      <div className="players-grid">
        {playerWithTeamName.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            teamName={player.teamName}
          />
        ))}
      </div>
      {playerWithTeamName.length === 0 ? (
        <div className="app-card">No players yet.</div>
      ) : null}
    </section>
  )
}
