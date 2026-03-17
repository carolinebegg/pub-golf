import HoleCard from './HoleCard'

export default function HolesView({
  holes = [],
  holeDataById = {},
  expandedHoleId = null,
  onToggleHole,
  selectedTeam = null,
  allTeams = [],
  onChanged,
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
          }

          return (
            <HoleCard
              key={hole.id}
              hole={hole}
              isExpanded={expandedHoleId === hole.id}
              onToggle={() => onToggleHole?.(hole.id)}
              selectedTeam={selectedTeam}
              allTeams={allTeams}
              existingScore={holeState.existingScore}
              kegEntries={holeState.kegEntries}
              pitcherFinish={holeState.pitcherFinish}
              onChanged={onChanged}
            />
          )
        })}
      </div>
    </section>
  )
}
