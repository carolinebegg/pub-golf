import HoleCard from './HoleCard'

export default function HolesView({
  holes = [],
  holeDataById = {},
  holeStatusById = {},
  onOpenHoleDetails,
  selectedTeam = null,
  players = [],
}) {
  return (
    <section className="section-stack">
      <div className="section-header">
        <h2>Holes</h2>
      </div>

      <div className="hole-list">
        {holes.map((hole) => {
          const holeState = holeDataById[hole.id] || {
            existingScore: null,
            kegEntries: [],
            pitcherFinish: null,
            bunkerEntry: null,
          }

          return (
            <HoleCard
              key={hole.id}
              hole={hole}
              onOpenDetails={() => onOpenHoleDetails?.(hole.id)}
              selectedTeam={selectedTeam}
              existingScore={holeState.existingScore}
              kegEntries={holeState.kegEntries}
              pitcherFinish={holeState.pitcherFinish}
              holeStatus={holeStatusById[hole.id] || 'not-started'}
              bunkerEntry={holeState.bunkerEntry ?? null}
              players={players}
            />
          )
        })}
      </div>
    </section>
  )
}
