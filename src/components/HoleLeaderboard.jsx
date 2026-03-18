/**
 * Reusable hole leaderboard: green card(s), medal ranks, primary/secondary/stat columns.
 *
 * @param {'stacked'|'split'} layout
 *   - stacked: one card, multiple section headers (keg stand, pitcher)
 *   - split: one card per section in a responsive grid (Guinness best / worst)
 * @param {Array<{
 *   id: string
 *   title: string
 *   rows: any[]
 *   loading?: boolean
 *   emptyText?: string
 *   getKey?: (row: any, index: number) => string | number
 *   columns?: (row: any, index: number) => { primary: string, secondary?: string, stat: string }
 *   renderRow?: (row: any, index: number) => React.ReactNode
 *   rankPlace?: (row: any) => number
 *     1-based competition rank (ties share the same value). Uses medalForPlace.
 * }>} sections
 */
export function medalRank(index) {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return `#${index + 1}`
}

/** 1-based competition place (after ties, e.g. two 1sts then next is 3rd). */
export function medalForPlace(place) {
  if (place === 1) return '🥇'
  if (place === 2) return '🥈'
  if (place === 3) return '🥉'
  return `#${place}`
}

function DefaultRow({ index, rankPlace, primary, secondary, stat }) {
  const rankLabel =
    rankPlace != null && rankPlace >= 1 ? medalForPlace(rankPlace) : medalRank(index)
  return (
    <>
      <span style={styles.rank}>{rankLabel}</span>
      <div style={styles.info}>
        <span style={styles.name}>{primary}</span>
        {secondary ? <span style={styles.meta}>{secondary}</span> : null}
      </div>
      <span style={styles.stat}>{stat}</span>
    </>
  )
}

function renderSection(section) {
  const {
    title,
    rows = [],
    loading = false,
    emptyText = 'No results yet.',
    getKey,
    columns,
    renderRow,
    rankPlace,
  } = section

  return (
    <div key={section.id}>
      <div style={styles.header}>{title}</div>
      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : !rows.length ? (
        <div style={styles.empty}>{emptyText}</div>
      ) : (
        rows.map((row, rowIndex) => (
          <div
            key={getKey ? String(getKey(row, rowIndex)) : rowIndex}
            style={styles.row}
          >
            {renderRow ? (
              renderRow(row, rowIndex)
            ) : columns ? (
              <DefaultRow
                index={rowIndex}
                rankPlace={rankPlace ? rankPlace(row) : undefined}
                {...columns(row, rowIndex)}
              />
            ) : null}
          </div>
        ))
      )}
    </div>
  )
}

export default function HoleLeaderboard({
  layout = 'stacked',
  sections = [],
  gridMinWidth = 220,
}) {
  if (!Array.isArray(sections) || sections.length === 0) return null

  if (layout === 'split') {
    return (
      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: `repeat(auto-fit, minmax(${gridMinWidth}px, 1fr))`,
        }}
      >
        {sections.map((section) => (
          <div key={section.id} style={styles.card}>
            {renderSection(section)}
          </div>
        ))}
      </div>
    )
  }

  return <div style={styles.card}>{sections.map((s) => renderSection(s))}</div>
}

const styles = {
  card: {
    border: '1.5px solid #b8d9c4',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#f6fbf7',
  },
  header: {
    background: '#2d6a4a',
    color: '#fff',
    padding: '6px 14px',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: '9px 14px',
    borderTop: '1px solid #e3ede6',
  },
  rank: {
    fontSize: '1.1rem',
    minWidth: 28,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    display: 'grid',
    gap: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 700,
    color: '#1f3027',
    fontSize: '0.9rem',
  },
  meta: {
    color: '#6a7d72',
    fontSize: '0.8rem',
  },
  stat: {
    fontWeight: 700,
    color: '#1f5a3a',
    fontSize: '0.88rem',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    padding: '8px 14px',
    color: '#6a7d72',
    fontSize: '0.88rem',
  },
}
