import { useEffect } from 'react'
import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import {
  calculateStandardHoleScore,
  calculateTeamAverageKegSeconds,
  formatSeconds,
} from '../lib/helpers'

export default function HoleDetailsModal({
  hole = null,
  selectedTeam = null,
  allTeams = [],
  existingScore = null,
  kegEntries = [],
  pitcherFinish = null,
  onChanged,
  onClose,
}) {
  useEffect(() => {
    if (!hole) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [hole, onClose])

  if (!hole) return null

  const holeType = hole?.hole_type || 'standard'
  const teamKegEntries = selectedTeam
    ? kegEntries.filter((entry) => entry.team_id === selectedTeam.id)
    : []

  const scorePreview = calculateStandardHoleScore(existingScore)
  const kegAverage = calculateTeamAverageKegSeconds(teamKegEntries)

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div className="breakdown-overlay" onMouseDown={handleBackdropMouseDown} role="presentation">
      <section
        className="breakdown-modal hole-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Hole ${hole.hole_number} details`}
      >
        <div className="breakdown-modal-header">
          <div>
            <p className="breakdown-modal-eyebrow">Hole Details</p>
            <h3 className="breakdown-modal-title">Hole {hole.hole_number} - {hole.bar_name}</h3>
            <p className="breakdown-modal-members">{formatHoleTypeLabel(holeType)} • {formatHoleTimeRange(hole)}</p>
          </div>

          <button type="button" className="breakdown-close-button" onClick={() => onClose?.()}>
            X
          </button>
        </div>

        <div className="breakdown-modal-summary hole-detail-summary">
          <div>
            <span className="breakdown-summary-label">Type</span>
            <strong className="breakdown-summary-value">{formatHoleTypeLabel(holeType)}</strong>
          </div>

          <div>
            <span className="breakdown-summary-label">Your status</span>
            <strong className="breakdown-summary-value">
              {renderCompletionText({ holeType, existingScore, teamKegEntries, pitcherFinish })}
            </strong>
          </div>
        </div>

        <div className="breakdown-modal-scroll hole-detail-scroll">
          {hole.rule_text ? (
            <section className="hole-modal-section">
              <h4 className="hole-modal-heading">Rule</h4>
              <p className="hole-modal-copy">{hole.rule_text}</p>
            </section>
          ) : null}

          {hole.notes ? (
            <section className="hole-modal-section">
              <h4 className="hole-modal-heading">Notes</h4>
              <p className="hole-modal-copy">{hole.notes}</p>
            </section>
          ) : null}

          {selectedTeam && holeType === 'standard' && existingScore ? (
            <section className="hole-modal-section compact-info-section">
              <strong>Current score: {scorePreview ?? '-'} </strong>
            </section>
          ) : null}

          {selectedTeam && holeType === 'keg_stand' && kegAverage !== null ? (
            <section className="hole-modal-section compact-info-section">
              <strong>Your team average: {formatSeconds(kegAverage)}</strong>
            </section>
          ) : null}

          {!selectedTeam ? (
            <section className="hole-modal-section warning-info-section">
              Log in to your team to submit or edit this hole.
            </section>
          ) : null}

          {selectedTeam && holeType === 'standard' ? (
            <section className="hole-modal-section hole-type-panel standard-hole-panel">
              <h4 className="hole-modal-heading">Standard scorecard</h4>
              <StandardHoleForm
                key={`standard-${hole.id}-${selectedTeam.id}-${existingScore?.id ?? 'new'}`}
                hole={hole}
                team={selectedTeam}
                existingScore={existingScore}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && holeType === 'keg_stand' ? (
            <section className="hole-modal-section hole-type-panel keg-hole-panel">
              <h4 className="hole-modal-heading">Keg stand challenge</h4>
              <KegStandSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && holeType === 'pitcher' ? (
            <section className="hole-modal-section hole-type-panel pitcher-hole-panel">
              <h4 className="hole-modal-heading">Pitcher finish order</h4>
              <PitcherRaceSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                onChanged={onChanged}
              />
            </section>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function formatHoleTypeLabel(holeType) {
  switch (holeType) {
    case 'keg_stand':
      return 'Keg Stand'
    case 'pitcher':
      return 'Pitcher Race'
    case 'standard':
    default:
      return 'Standard'
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

function renderCompletionText({ holeType, existingScore, teamKegEntries, pitcherFinish }) {
  if (holeType === 'keg_stand') {
    return teamKegEntries.length ? 'Entries submitted' : 'Not submitted'
  }

  if (holeType === 'pitcher') {
    return pitcherFinish ? 'Finish recorded' : 'Not finished'
  }

  return existingScore ? 'Score submitted' : 'No score yet'
}
