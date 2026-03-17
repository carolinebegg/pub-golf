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
    background: 'var(--surface)',
    borderRadius: 16,
    boxShadow: '0 8px 18px rgba(13, 33, 20, 0.06)',
    overflow: 'hidden',
    border: '1px solid var(--surface-border)',
  },
  cardButton: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    padding: 14,
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
    fontSize: '0.84rem',
    color: '#5e7167',
    fontWeight: 700,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  barName: {
    fontSize: '1.06rem',
    fontWeight: 800,
  },
  time: {
    fontSize: '0.87rem',
    color: '#5a6b62',
    whiteSpace: 'nowrap',
  },
  scoreBadge: {
    background: '#f4f8f4',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    border: '1px solid #d6dfd7',
  },
  expandText: {
    marginTop: 8,
    fontSize: '0.86rem',
    color: 'var(--green-700)',
    fontWeight: 700,
  },
  details: {
    borderTop: '1px solid #e2e8e2',
    padding: 14,
    background: '#fbfdfb',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 10,
    color: '#2a3f33',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
    marginBottom: 10,
  },
  badge: {
    background: '#eaf5ee',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#1f5a3a',
  },
  warningBadge: {
    background: '#f9f0da',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#6f5720',
  },
  infoBox: {
    padding: 11,
    borderRadius: 10,
    background: '#fff8e8',
    border: '1px solid #ecd8a8',
    color: '#6b5a22',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
}