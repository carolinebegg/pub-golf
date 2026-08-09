import HoleCard from './HoleCard'

export default function HolesView({
  holes = [],
  holeScoreById = {},
  onOpenHoleDetails,
  selectedTeam = null,
}) {
  return (
    <section className="section-stack">
      <div className="section-header">
        <h2>Holes</h2>
      </div>

      <div className="hole-list">
        {holes.map((hole) => {
          return (
            <HoleCard
              key={hole.id}
              hole={hole}
              onOpenDetails={() => onOpenHoleDetails?.(hole.id)}
              selectedTeam={selectedTeam}
              scoreForHole={holeScoreById[hole.id] ?? null}
            />
          )
        })}
      </div>
    </section>
  )
}
