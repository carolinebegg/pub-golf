import { useEffect } from 'react'
import StandardHoleForm from './StandardHoleForm'
import KegStandSection from './KegStandSection'
import PitcherRaceSection from './PitcherRaceSection'
import {
  calculateStandardHoleScore,
  calculateTeamAverageKegSeconds,
  formatHoleTimeRange,
  formatSeconds,
  getEffectiveHoleType,
  getHoleTypeLabel,
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

  const holeType = getEffectiveHoleType(hole)
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
            <p className="breakdown-modal-members">{getHoleTypeLabel(holeType)} • {formatHoleTimeRange(hole)}</p>
          </div>

          <button type="button" className="breakdown-close-button" onClick={() => onClose?.()}>
            X
          </button>
        </div>

        <div className="breakdown-modal-summary hole-detail-summary">
          <div>
            <span className="breakdown-summary-label">Type</span>
            <strong className="breakdown-summary-value">{getHoleTypeLabel(holeType)}</strong>
          </div>

          <div>
            <span className="breakdown-summary-label">Your status</span>
            <strong className="breakdown-summary-value">
              {renderCompletionText({ holeType, existingScore, teamKegEntries, pitcherFinish })}
            </strong>
          </div>
        </div>

        <div className="breakdown-modal-scroll hole-detail-scroll">
          <article className="breakdown-row hole-detail-row">
            <div className="breakdown-row-main">
              <h4 className="breakdown-row-title">Rule</h4>
              <p className="breakdown-row-detail">{getRuleCopy({ hole, holeType })}</p>
            </div>
          </article>

          {hole.notes ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Notes</h4>
                <p className="breakdown-row-detail">{hole.notes}</p>
              </div>
            </article>
          ) : null}

          {selectedTeam && holeType === 'standard' && existingScore ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Current score</h4>
                <p className="breakdown-row-detail">{scorePreview ?? '-'}</p>
              </div>
            </article>
          ) : null}

          {selectedTeam && holeType === 'keg_stand' && kegAverage !== null ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Your team average</h4>
                <p className="breakdown-row-detail">{formatSeconds(kegAverage)}</p>
              </div>
            </article>
          ) : null}

          {!selectedTeam ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Team access required</h4>
                <p className="breakdown-row-detail">Log in to your team to submit or edit this hole.</p>
              </div>
            </article>
          ) : null}

          {selectedTeam && holeType === 'standard' ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Enter score</h4>
                <StandardHoleForm
                  key={`standard-${hole.id}-${selectedTeam.id}-${existingScore?.id ?? 'new'}`}
                  hole={hole}
                  team={selectedTeam}
                  existingScore={existingScore}
                  onChanged={onChanged}
                />
              </div>
            </article>
          ) : null}

          {selectedTeam && holeType === 'keg_stand' ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Add keg stand entry</h4>
                <KegStandSection
                  hole={hole}
                  team={selectedTeam}
                  allTeams={allTeams}
                  onChanged={onChanged}
                />
              </div>
            </article>
          ) : null}

          {selectedTeam && holeType === 'pitcher' ? (
            <article className="breakdown-row hole-detail-row">
              <div className="breakdown-row-main">
                <h4 className="breakdown-row-title">Record finish</h4>
                <PitcherRaceSection
                  hole={hole}
                  team={selectedTeam}
                  allTeams={allTeams}
                  onChanged={onChanged}
                />
              </div>
            </article>
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

function renderCompletionText({ holeType, existingScore, teamKegEntries, pitcherFinish }) {
  if (holeType === 'keg_stand') {
    return teamKegEntries.length ? 'Completed' : 'Not started'
  }

  if (holeType === 'pitcher') {
    return pitcherFinish ? 'Completed' : 'Not started'
  }

  return existingScore ? 'Completed' : 'Not started'
}
