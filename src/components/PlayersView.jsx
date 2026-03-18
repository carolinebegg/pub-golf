import { useMemo } from 'react'
import PlayerCard, { sortPlayersByRank } from './PlayerCard'

export default function PlayersView({ players = [], teams = [] }) {
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  )

  const sortedPlayers = useMemo(() => sortPlayersByRank(players), [players])

  const playerWithTeam = useMemo(
    () =>
      sortedPlayers.map((player) => {
        const team = player.team_id != null ? teamById.get(player.team_id) : null
        return {
          ...player,
          teamName:
            team?.theme || team?.name || (team ? `Team ${team.team_number ?? '?'}` : '—'),
          teamEmoji: team?.emoji ?? '',
        }
      }),
    [sortedPlayers, teamById]
  )

  return (
    <section className="section-stack">
      <div className="section-header">
        <h2>Players</h2>
      </div>
      <div className="players-grid">
        {playerWithTeam.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            teamName={player.teamName}
            teamEmoji={player.teamEmoji}
          />
        ))}
      </div>
      {playerWithTeam.length === 0 ? (
        <div className="app-card">No players yet.</div>
      ) : null}
    </section>
  )
}
