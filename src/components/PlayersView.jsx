import { useMemo } from 'react'
import PlayerCard, { sortPlayersByRank } from './PlayerCard'

export default function PlayersView({ players = [], teams = [], playerStats = [] }) {
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  )

  const statsByPlayerId = useMemo(
    () => new Map((playerStats || []).map((row) => [row.player_id, row])),
    [playerStats]
  )

  const sortedPlayers = useMemo(() => sortPlayersByRank(players), [players])

  const playerWithTeam = useMemo(
    () =>
      sortedPlayers.map((player) => {
        const team = player.team_id != null ? teamById.get(player.team_id) : null
        return {
          ...player,
          teamName: team?.theme || '—',
          teamEmoji: team?.emoji ?? '',
          stats: statsByPlayerId.get(player.id) ?? null,
        }
      }),
    [sortedPlayers, teamById, statsByPlayerId]
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
            stats={player.stats}
          />
        ))}
      </div>
      {playerWithTeam.length === 0 ? (
        <div className="app-card">No players yet.</div>
      ) : null}
    </section>
  )
}
