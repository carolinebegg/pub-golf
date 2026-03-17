export default function TeamSelector({
  teams = [],
  selectedTeamId = '',
  onChange,
  label = 'Team',
  includeBlankOption = true,
  placeholder = 'Select your team',
}) {
  return (
    <label className="team-field">
      <span className="team-field-label">{label}</span>

      <select
        value={selectedTeamId}
        onChange={(e) => onChange(e.target.value)}
        className="team-input"
      >
        {includeBlankOption && <option value="">{placeholder}</option>}

        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {formatTeamLabel(team)}
          </option>
        ))}
      </select>
    </label>
  )
}

function formatTeamLabel(team) {
  const teamNumberPart =
    team.team_number !== null && team.team_number !== undefined
      ? `Team ${team.team_number}`
      : 'Team'

  if (team.theme) {
    return `${teamNumberPart} (${team.theme})`
  }

  if (team.name) {
    return `${teamNumberPart} — ${team.name}`
  }

  return teamNumberPart
}