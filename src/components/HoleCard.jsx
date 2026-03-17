import {
  calculateStandardHoleScore,
  calculateTeamAverageKegSeconds,
  formatSeconds,
} from '../lib/helpers'

export default function HoleCard({
  hole,
  onOpenDetails,
  selectedTeam,
  existingScore = null,
  kegEntries = [],
  pitcherFinish = null,
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

  const isCompleted =
    holeType === 'keg_stand'
      ? teamEntries.length > 0
      : holeType === 'pitcher'
      ? Boolean(pitcherFinish)
      : Boolean(existingScore)

  const typeDisplay = getHoleTypeDisplay(holeType)

  return (
    <div style={styles.card}>
      <div style={styles.cardButton}>
        <div style={styles.topRow}>
          <div style={styles.titleBlock}>
            <div style={styles.holeLabel}>Hole {hole.hole_number}</div>
            <div style={styles.barName}>{hole.bar_name}</div>
          </div>

          <div style={styles.rightBlock}>
            <span
              style={{
                ...styles.holeTypeBadge,
                background: typeDisplay.badgeBg,
                color: typeDisplay.badgeColor,
                borderColor: typeDisplay.badgeBorder,
              }}
            >
              {typeDisplay.label}
            </span>
          </div>
        </div>

        <div style={styles.metaRow}>
          <div style={styles.time}>{formatHoleTimeRange(hole)}</div>

          <div style={styles.statusBlock}>
            {selectedTeam ? (
              <span
                style={{
                  ...styles.statusBadge,
                  ...(isCompleted ? styles.statusBadgeComplete : styles.statusBadgePending),
                }}
              >
                {isCompleted ? 'Completed' : 'Pending'}
              </span>
            ) : (
              <span style={styles.statusBadge}>Login required</span>
            )}

            {selectedTeam && holeType === 'standard' && existingScore ? (
              <span style={styles.scoreBadge}>Score {standardPreviewScore}</span>
            ) : null}

            {selectedTeam && holeType === 'keg_stand' && kegAverage !== null ? (
              <span style={styles.scoreBadge}>Avg {formatSeconds(kegAverage)}</span>
            ) : null}

            {selectedTeam && holeType === 'pitcher' && pitcherFinish ? (
              <span style={styles.scoreBadge}>Finish saved</span>
            ) : null}
          </div>
        </div>

        <button type="button" onClick={onOpenDetails} style={styles.openButton}>
          Open hole details
        </button>
      </div>
    </div>
  )
}

function getHoleTypeDisplay(holeType) {
  switch (holeType) {
    case 'keg_stand':
      return {
        label: 'Keg Stand',
        badgeBg: '#f8f1dc',
        badgeColor: '#6f5720',
        badgeBorder: '#dfcf9f',
      }
    case 'pitcher':
      return {
        label: 'Pitcher Race',
        badgeBg: '#edf2ff',
        badgeColor: '#284f92',
        badgeBorder: '#c9d6f7',
      }
    case 'standard':
    default:
      return {
        label: 'Standard',
        badgeBg: '#eaf5ee',
        badgeColor: '#1f5a3a',
        badgeBorder: '#cce0d0',
      }
  }
}

function formatHoleTimeRange(hole) {
  const start = hole?.start_time
  const end = hole?.end_time

  if (start && end) {
    return `${start} - ${end}`
  }

  if (start) {
    return start
  }

  if (end) {
    return `Until ${end}`
  }

  return 'Time not set'
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
    padding: 14,
    display: 'grid',
    gap: 10,
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
    display: 'flex',
    alignItems: 'flex-start',
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
  holeTypeBadge: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: '0.76rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  time: {
    fontSize: '0.87rem',
    color: '#5a6b62',
    whiteSpace: 'nowrap',
  },
  statusBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    background: '#f4f8f4',
    border: '1px solid #d6dfd7',
    color: '#335246',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  statusBadgeComplete: {
    background: '#eaf5ee',
    borderColor: '#cce0d0',
    color: '#1f5a3a',
  },
  statusBadgePending: {
    background: '#f8f3e6',
    borderColor: '#e5d8b5',
    color: '#745f24',
  },
  scoreBadge: {
    background: '#f4f8f4',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    border: '1px solid #d6dfd7',
  },
  openButton: {
    justifySelf: 'start',
    border: '1px solid #c9d7cc',
    background: '#fff',
    color: 'var(--green-700)',
    fontWeight: 800,
    borderRadius: 10,
    padding: 11,
    fontSize: '0.84rem',
    cursor: 'pointer',
  },
}