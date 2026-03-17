import { useState } from 'react'

export default function PrimaryActionButton({
  type = 'button',
  onClick,
  disabled = false,
  isLoading = false,
  label,
  loadingLabel = 'Saving...',
}) {
  const [isHovered, setIsHovered] = useState(false)

  const effectiveDisabled = disabled || isLoading
  const text = isLoading ? loadingLabel : label

  const baseStyle = {
    padding: '13px 18px',
    minHeight: 48,
    minWidth: 170,
    borderRadius: 12,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontWeight: 800,
    cursor: effectiveDisabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease',
  }

  const hoverStyle =
    isHovered && !effectiveDisabled
      ? {
          background: 'var(--green-700)',
          boxShadow: '0 8px 20px rgba(26, 92, 58, 0.22)',
          transform: 'translateY(-1px)',
        }
      : null

  const disabledStyle = effectiveDisabled
    ? {
        opacity: 0.75,
        boxShadow: 'none',
      }
    : null

  async function handleClick(event) {
    if (effectiveDisabled) return
    if (onClick) {
      await onClick(event)
    }
  }

  return (
    <button
      type={type}
      disabled={effectiveDisabled}
      style={{
        ...baseStyle,
        ...hoverStyle,
        ...disabledStyle,
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {text}
    </button>
  )
}

