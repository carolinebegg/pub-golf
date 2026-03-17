export default function LeaderboardCard({ sections = [] }) {
  if (!Array.isArray(sections) || sections.length === 0) return null

  return (
    <div style={styles.card}>
      {sections.map((section, index) => (
        <div key={section.id || section.title || index}>
          <div style={styles.header}>{section.title}</div>
          {section.loading ? (
            <div style={styles.empty}>Loading...</div>
          ) : !section.rows || section.rows.length === 0 ? (
            <div style={styles.empty}>{section.emptyText || 'No results yet.'}</div>
          ) : (
            section.rows.map((row, rowIndex) => (
              <div key={section.getKey ? section.getKey(row, rowIndex) : rowIndex} style={styles.row}>
                {section.renderRow(row, rowIndex)}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
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
  empty: {
    padding: '8px 14px',
    color: '#6a7d72',
    fontSize: '0.88rem',
  },
}

