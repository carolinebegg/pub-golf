import { useEffect } from 'react'
import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import {
  calculateStandardHoleScore,
  formatHoleTimeRange,
  getEffectiveHoleType,
  getHoleTypeLabel,
} from '../lib/helpers'

export default function HoleDetailsModal({
  hole = null,
  selectedTeam = null,
  allTeams = [],
  existingScore = null,
  pitcherFinish = null,
  holeStatus = 'not-started',
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

  const holeType = getEffectiveHoleType(hole)
  const statusLabel = getStatusLabel(holeStatus)
  const scorePreview = calculateStandardHoleScore(existingScore)

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
            <p className="breakdown-modal-members">{getHoleTypeLabel(holeType)} • {formatHoleTimeRange(hole)}</p>
          </div>

          <button type="button" className="breakdown-close-button" onClick={() => onClose?.()}>
            X
          </button>
        </div>

        <div className="breakdown-modal-summary hole-detail-summary">
          <div className="hole-detail-summary-item">
            <span className="breakdown-summary-label">Type</span>
            <strong className="breakdown-summary-value">{getHoleTypeLabel(holeType)}</strong>
          </div>

          <div className="hole-detail-summary-item">
            <span className="breakdown-summary-label">Your status</span>
            <strong className="breakdown-summary-value">{statusLabel}</strong>
          </div>
        </div>

        <div className="breakdown-modal-scroll hole-detail-scroll">
          <section className="hole-detail-section">
            <h4 className="hole-detail-section-title">Rule</h4>
            <p className="hole-detail-section-copy">{getRuleCopy({ hole, holeType })}</p>
          </section>

          {hole.notes ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Notes</h4>
              <p className="hole-detail-section-copy">{hole.notes}</p>
            </section>
          ) : null}

          {!selectedTeam ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Team access</h4>
              <p className="hole-detail-section-copy">Log in to your team to submit or edit this hole.</p>
            </section>
          ) : null}

          {selectedTeam && holeType === 'standard' ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Enter score</h4>
              <p className="hole-detail-section-copy">
                {existingScore ? (
                  <>
                    Current score: <strong>{scorePreview ?? '-'}</strong>
                  </>
                ) : (
                  'No score submitted yet.'
                )}
              </p>
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
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Add entry</h4>
              <KegStandSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                onChanged={onChanged}
              />
            </section>
          ) : null}

          {selectedTeam && holeType === 'pitcher' ? (
            <section className="hole-detail-section">
              <h4 className="hole-detail-section-title">Finish pitcher</h4>
              <PitcherRaceSection
                hole={hole}
                team={selectedTeam}
                allTeams={allTeams}
                pitcherFinish={pitcherFinish}
                onChanged={onChanged}
              />
            </section>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function getRuleCopy({ hole, holeType }) {
  if (holeType === 'pitcher') {
    return 'Each team finishes one pitcher. Tap "Finish pitcher" once your team is done. Finish order sets score: 1st = 0, 2nd = +1, 3rd = +2, and so on.'
  }

  if (holeType === 'keg_stand') {
    return hole?.rule_text || 'Add keg stand entries for your team. Team average seconds determines ranking for this hole.'
  }

  return hole?.rule_text || 'Submit your standard score for this hole.'
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'in-progress':
      return 'In progress'
    case 'not-started':
    default:
      return 'Not started'
  }
}
