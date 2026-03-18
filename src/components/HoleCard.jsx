import {
  formatHoleTimeRange,
  getHoleDisplayLabel,
  getEffectiveHoleType,
} from '../lib/helpers'

export default function HoleCard({
  hole,
  onOpenDetails,
  selectedTeam,
  existingScore = null,
  kegEntries = [],
  pitcherFinish = null,
  holeStatus = 'not-started',
  bunkerEntry = null,
  players = [],
  scoreForHole = null,
}) {
  const holeType = getEffectiveHoleType(hole)
  const typeDisplay = getHoleTypeDisplay({ hole, holeType })

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
                ...typeDisplay.badgeStyle,
              }}
            >
              {typeDisplay.typeLabel}
            </span>
          </div>
        </div>

        <div style={styles.metaRow}>
          <div style={styles.time}>{formatHoleTimeRange(hole)}</div>
        </div>

        <div style={styles.bottomRow}>
          <button type="button" onClick={onOpenDetails} style={styles.openButton}>
            Open hole details
          </button>
          {selectedTeam && (
            <div style={styles.holeScoreBlock}>
              <div
                style={{
                  ...styles.holeScoreValue,
                  ...(scoreForHole === null || scoreForHole === undefined
                    ? styles.holeScoreUnset
                    : null),
                }}
              >
                {scoreForHole !== null && scoreForHole !== undefined
                  ? Number(scoreForHole) > 0
                    ? `+${scoreForHole}`
                    : scoreForHole
                  : '—'}
              </div>
              <div style={styles.holeScoreLabel}>score</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getHoleTypeDisplay({ hole, holeType }) {
  const typeLabel = getHoleDisplayLabel(hole, holeType)

  if (holeType === 'keg_stand') {
    return {
      typeLabel,
      badgeStyle: {
        background: '#f8f1dc',
        color: '#6f5720',
        borderColor: '#dfcf9f',
      },
    }
  }

  if (holeType === 'pitcher') {
    return {
      typeLabel,
      badgeStyle: {
        background: '#edf2ff',
        color: '#284f92',
        borderColor: '#c9d6f7',
      },
    }
  }

  if (hole?.has_bunker && hole?.has_water) {
    return {
      typeLabel: 'Bunker + Water',
      badgeStyle: {
        background: '#f1f5f7',
        color: '#385463',
        borderColor: '#cad7de',
      },
    }
  }

  if (hole?.has_bunker) {
    return {
      typeLabel: 'Bunker Hazard',
      badgeStyle: {
        background: '#f8f1dc',
        color: '#6f5720',
        borderColor: '#dfcf9f',
      },
    }
  }

  if (hole?.has_water) {
    return {
      typeLabel: 'Water Hazard',
      badgeStyle: {
        background: '#edf2ff',
        color: '#284f92',
        borderColor: '#c9d6f7',
      },
    }
  }

  return {
    typeLabel,
    badgeStyle: {
      background: '#eaf5ee',
      color: '#1f5a3a',
      borderColor: '#cce0d0',
    },
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
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  openButton: {
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
  holeScoreBlock: {
    textAlign: 'right',
    minWidth: 62,
  },
  holeScoreValue: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--green-700)',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  holeScoreUnset: {
    color: '#7a8a81',
  },
  holeScoreLabel: {
    color: '#637168',
    fontSize: '0.85rem',
    marginTop: 4,
  },
}