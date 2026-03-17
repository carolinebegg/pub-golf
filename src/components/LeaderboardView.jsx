import OverallLeaderboard from './OverallLeaderboard'

export default function LeaderboardView({
  teams = [],
  holes = [],
  scores = [],
  kegStandEntries = [],
  pitcherFinishes = [],
  leaderboardData = [],
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
    </section>
  )
}
