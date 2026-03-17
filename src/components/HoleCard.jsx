import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import {
  calculateStandardHoleScore,
  calculateTeamAverageKegSeconds,
  formatSeconds,
} from '../lib/helpers'

export default function HoleCard({
  hole,
  isExpanded,
  onToggle,
  selectedTeam,
  allTeams = [],
  existingScore = null,
  kegEntries = [],
  pitcherFinish = null,
  onChanged,
}) {
  const holeType = hole?.hole_type || 'standard'

  const teamEntries =
    selectedTeam && holeType === 'keg_stand'
      ? kegEntries.filter((entry) => entry.team_id === selectedTeam.id)
      : []

  const standardPreviewScore =
    selectedTeam && holeType === 'standard'
      ? calculateStandardHoleScore(existingScore)
      : null

  const kegAverage =
    selectedTeam && holeType === 'keg_stand'
      ? calculateTeamAverageKegSeconds(teamEntries)
      : null

  return (
    <div style={styles.card}>
      <button type="button" onClick={onToggle} style={styles.cardButton}>
        <div style={styles.topRow}>
          <div style={styles.titleBlock}>
            <div style={styles.holeLabel}>Hole {hole.hole_number}</div>
            <div style={styles.barName}>{hole.bar_name}</div>
          </div>

          <div style={styles.rightBlock}>
            {hole.start_time ? <div style={styles.time}>{hole.start_time}</div> : null}

            {selectedTeam && holeType === 'standard' && existingScore && (
              <div style={styles.scoreBadge}>Score: {standardPreviewScore}</div>
            )}

            {selectedTeam && holeType === 'keg_stand' && kegAverage !== null && (
              <div style={styles.scoreBadge}>Avg: {formatSeconds(kegAverage)}</div>
            )}

            {selectedTeam && holeType === 'pitcher' && pitcherFinish && (
              <div style={styles.scoreBadge}>Finished</div>
            )}
          </div>
        </div>

        <div style={styles.expandText}>
          {isExpanded ? 'Hide details ▲' : 'Show details ▼'}
        </div>
      </button>

      {isExpanded && (
        <div style={styles.details}>
          {hole.rule_text ? (
            <p style={styles.paragraph}>
              <strong>Rule:</strong> {hole.rule_text}
            </p>
          ) : null}

          <div style={styles.badgeRow}>
            <span style={styles.badge}>{formatHoleType(holeType)}</span>
            {hole.has_bunker && <span style={styles.warningBadge}>Bunker hazard</span>}
            {hole.has_water && <span style={styles.warningBadge}>Water hazard</span>}
          </div>

          {hole.notes ? (
            <p style={styles.paragraph}>
              <strong>Notes:</strong> {hole.notes}
            </p>
          ) : null}

          {!selectedTeam && (
            <div style={styles.infoBox}>Log in as your team above to submit or edit scores.</div>
          )}

          {selectedTeam && holeType === 'standard' && (
            <StandardHoleForm
              hole={hole}
              team={selectedTeam}
              existingScore={existingScore}
              onChanged={onChanged}
            />
          )}

          {selectedTeam && holeType === 'keg_stand' && (
            <KegStandSection
              hole={hole}
              team={selectedTeam}
              allTeams={allTeams}
              onChanged={onChanged}
            />
          )}

          {selectedTeam && holeType === 'pitcher' && (
            <PitcherRaceSection
              hole={hole}
              team={selectedTeam}
              allTeams={allTeams}
              onChanged={onChanged}
            />
          )}
        </div>
      )}
    </div>
  )
}

function formatHoleType(holeType) {
  switch (holeType) {
    case 'keg_stand':
      return 'Keg stand'
    case 'pitcher':
      return 'Pitcher race'
    case 'standard':
    default:
      return 'Standard hole'
  }
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    border: '1px solid #eee',
  },
  cardButton: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    padding: 16,
    cursor: 'pointer',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  titleBlock: {
    minWidth: 0,
  },
  rightBlock: {
    display: 'grid',
    gap: 8,
    justifyItems: 'end',
  },
  holeLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: 4,
  },
  barName: {
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  time: {
    fontSize: '0.95rem',
    color: '#555',
    whiteSpace: 'nowrap',
  },
  scoreBadge: {
    background: '#f3f3f3',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: '0.85rem',
    fontWeight: 700,
    border: '1px solid #ddd',
  },
  expandText: {
    marginTop: 10,
    fontSize: '0.95rem',
    color: '#0b5',
    fontWeight: 600,
  },
  details: {
    borderTop: '1px solid #eee',
    padding: 16,
    background: '#fcfcfc',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 12,
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  badge: {
    background: '#e8f0ff',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  warningBadge: {
    background: '#ffe8cc',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  infoBox: {
    padding: 12,
    borderRadius: 10,
    background: '#fff8e8',
    border: '1px solid #efdba8',
    color: '#6b5a22',
    fontWeight: 500,
  },
}