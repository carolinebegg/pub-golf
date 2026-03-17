import OverallLeaderboard from './OverallLeaderboard'
import GuinnessLeaderboards from './GuinnessLeaderboards'

export default function LeaderboardView({
  teams = [],
  holes = [],
  scores = [],
  kegStandEntries = [],
  pitcherFinishes = [],
  leaderboardData = [],
  guinnessVotes = [],
  onOpenBreakdown,
}) {
  return (
    <section className="section-stack">
      <OverallLeaderboard
        teams={teams}
        holes={holes}
        scores={scores}
        kegStandEntries={kegStandEntries}
        pitcherFinishes={pitcherFinishes}
        leaderboardData={leaderboardData}
        onOpenBreakdown={onOpenBreakdown}
      />

      <GuinnessLeaderboards votes={guinnessVotes} teams={teams} />
    </section>
  )
}
