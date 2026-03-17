import {
  calculateStandardHoleScore,
  calculateTeamAverageKegSeconds,
  formatHoleTimeRange,
  formatSeconds,
  getEffectiveHoleType,
  getHoleTypeLabel,
} from '../lib/helpers'

export default function HoleCard({
  hole,
  onOpenDetails,
  selectedTeam,
  existingScore = null,
  kegEntries = [],
  pitcherFinish = null,
  holeStatus = 'not-started',
}) {
  const holeType = getEffectiveHoleType(hole)

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

  const typeDisplay = getHoleTypeDisplay(holeType)
  const statusDisplay = getStatusDisplay(holeStatus)

  return (
    <div style={styles.card}>
      <div style={styles.cardButton}>
        <div style={styles.topRow}>
          <div style={styles.titleBlock}>
            <div style={styles.holeLabel}>Hole {hole.hole_number}</div>
            <div style={styles.barName}>{hole.bar_name}</div>
          </div>

          <div style={styles.rightBlock}>
            <span style={styles.holeTypeBadge}>
              {typeDisplay.typeLabel}
            </span>
          </div>
        </div>

        <div style={styles.metaRow}>
          <div style={styles.time}>{formatHoleTimeRange(hole)}</div>

          <div style={styles.statusBlock}>
            <span
              style={{
                ...styles.statusBadge,
                ...statusDisplay.style,
              }}
            >
              {statusDisplay.label}
            </span>

            {selectedTeam && holeType === 'standard' && existingScore ? (
              <span style={styles.scoreBadge}>Score {standardPreviewScore}</span>
            ) : null}

            {selectedTeam && holeType === 'keg_stand' && kegAverage !== null ? (
              <span style={styles.scoreBadge}>Avg {formatSeconds(kegAverage)}</span>
            ) : null}

            {selectedTeam && holeType === 'pitcher' && pitcherFinish ? (
              <span style={styles.scoreBadge}>Finish recorded</span>
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
  return {
    typeLabel: getHoleTypeLabel(holeType),
  }
}

function getStatusDisplay(status) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        style: styles.statusBadgeComplete,
      }
    case 'in-progress':
      return {
        label: 'In progress',
        style: styles.statusBadgeInProgress,
      }
    case 'not-started':
    default:
      return {
        label: 'Not started',
        style: styles.statusBadgeNotStarted,
      }
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
    border: '1px solid #d6dfd7',
    background: '#f4f8f4',
    color: '#335246',
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
    border: '1px solid',
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
  statusBadgeInProgress: {
    background: '#f0f5f1',
    borderColor: '#d8e1da',
    color: '#2d4d3c',
  },
  statusBadgeNotStarted: {
    background: '#f6f7f6',
    borderColor: '#d9ddda',
    color: '#5f6e65',
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
    minHeight: 44,
    fontSize: '0.84rem',
    cursor: 'pointer',
  },
}