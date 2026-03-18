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
  return team.theme || 'Team'
}