// src/lib/helpers.js

/**
 * Safe numeric conversion.
 * Returns fallback if the value is null/undefined/NaN.
 */
function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Safe timestamp conversion.
 * Returns ms since epoch, or null if invalid.
 */
function toTimestamp(value) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Standard pub golf hole score calculation.
 *
 * Rules from your previous helper:
 * - base = sips
 * - Guinness = -1
 * - water violated = +3
 * - threw up = +5
 * - spilled drink = +1
 * - photobooth missing = +2
 * - bonus_penalty = additive
 *
 * Also supports split_g_bonus if present in schema.
 */
export function calculateStandardHoleScore(score) {
  if (!score) return null

  let total = toNumber(score.sips, 0)

  if (score.is_guinness) total -= 1
  if (score.water_violated) total += 3
  if (score.threw_up) total += 5
  if (score.spilled_drink) total += 1
  if (score.photobooth_missing) total += 2

  total += toNumber(score.bonus_penalty, 0)
  total -= toNumber(score.split_g_bonus, 0)

  return Math.max(0, total)
}

/**
 * Average keg stand time for one team.
 */
export function calculateTeamAverageKegSeconds(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null

  let total = 0
  let count = 0

  for (const entry of entries) {
    const seconds = toNumber(entry?.seconds, NaN)
    if (Number.isFinite(seconds) && seconds >= 0) {
      total += seconds
      count += 1
    }
  }

  if (count === 0) return null
  return total / count
}

/** Round keg times to centiseconds so ties match across floats / averages. */
export function kegComparableSeconds(value) {
  const n = toNumber(value, NaN)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

/**
 * Standard competition ranking:
 * values [10, 9, 9, 7] -> ranks [0, 1, 1, 3]
 *
 * "Better" means:
 * - descending for keg stand averages
 * - ascending for pitcher finish timestamps
 */
function assignRankScores(sortedRows, getComparableValue) {
  const ranked = []
  let lastValue = null
  let lastRank = -1

  for (let index = 0; index < sortedRows.length; index += 1) {
    const row = sortedRows[index]
    const value = getComparableValue(row)

    const sameAsPrevious =
      index > 0 &&
      value !== null &&
      lastValue !== null &&
      value === lastValue

    const rankScore = sameAsPrevious ? lastRank : index

    ranked.push({
      ...row,
      rankScore,
    })

    lastValue = value
    lastRank = rankScore
  }

  return ranked
}

/**
 * Builds a team leaderboard for keg stands.
 *
 * Output:
 * [
 *   {
 *     team_id,
 *     average,
 *     totalSeconds,
 *     count,
 *     rankScore
 *   }
 * ]
 *
 * Higher average seconds is better.
 * Ties receive the same rankScore.
 */
export function buildKegStandTeamLeaderboard(entries = []) {
  const grouped = new Map()

  for (const entry of entries) {
    const teamId = entry?.team_id
    if (!teamId) continue

    const seconds = toNumber(entry?.seconds, NaN)
    if (!Number.isFinite(seconds) || seconds < 0) continue

    const current = grouped.get(teamId) || {
      team_id: teamId,
      totalSeconds: 0,
      count: 0,
    }

    current.totalSeconds += seconds
    current.count += 1
    grouped.set(teamId, current)
  }

  const rows = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      average: row.count > 0 ? row.totalSeconds / row.count : null,
    }))
    .filter((row) => row.average !== null)
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average
      if (b.count !== a.count) return b.count - a.count
      return a.team_id.localeCompare(b.team_id)
    })

  return assignRankScores(rows, (row) => kegComparableSeconds(row.average))
}

/**
 * Individual keg entries sorted longest-first with competition rankScore (ties share rank).
 */
export function rankKegStandIndividualEntries(entries = []) {
  const valid = entries.filter((e) => kegComparableSeconds(e?.seconds) !== null)
  const sorted = [...valid].sort((a, b) => {
    const nb = kegComparableSeconds(b.seconds)
    const na = kegComparableSeconds(a.seconds)
    if (nb !== na) return nb - na
    return String(a.member_name || '').localeCompare(String(b.member_name || ''))
  })
  return assignRankScores(sorted, (row) => kegComparableSeconds(row.seconds))
}

/**
 * Builds a leaderboard for pitcher finishes.
 *
 * Output:
 * [
 *   {
 *     ...finishRow,
 *     finishedAtMs,
 *     rankScore
 *   }
 * ]
 *
 * Earlier finished_at is better.
 * Ties receive the same rankScore.
 */
export function buildPitcherLeaderboard(finishes = []) {
  const validRows = finishes
    .map((row) => {
      const finishedAtMs = toTimestamp(row?.finished_at)
      return finishedAtMs === null
        ? null
        : {
            ...row,
            finishedAtMs,
          }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.finishedAtMs !== b.finishedAtMs) {
        return a.finishedAtMs - b.finishedAtMs
      }
      return String(a.team_id).localeCompare(String(b.team_id))
    })

  return assignRankScores(validRows, (row) => row.finishedAtMs)
}

/**
 * Returns a score row for one team + one hole.
 */
export function getScoreForTeamAndHole(scores = [], teamId, holeId) {
  return (
    scores.find((row) => row.team_id === teamId && row.hole_id === holeId) || null
  )
}

/**
 * Returns all keg entries for one team + one hole.
 */
export function getKegEntriesForTeamAndHole(entries = [], teamId, holeId) {
  return entries.filter(
    (row) => row.team_id === teamId && row.hole_id === holeId
  )
}

/**
 * Returns one pitcher finish for one team + one hole.
 */
export function getPitcherFinishForTeamAndHole(finishes = [], teamId, holeId) {
  return (
    finishes.find((row) => row.team_id === teamId && row.hole_id === holeId) || null
  )
}

/**
 * Useful for sorting holes in display order.
 */
export function sortHolesByNumber(holes = []) {
  return [...holes].sort((a, b) => {
    const aNum = toNumber(a?.hole_number, Number.MAX_SAFE_INTEGER)
    const bNum = toNumber(b?.hole_number, Number.MAX_SAFE_INTEGER)
    return aNum - bNum
  })
}

/**
 * Resolve hole type used by UI + scoring logic.
 * Holes 2 and 9 are always pitcher race holes.
 */
export function getEffectiveHoleType(hole) {
  const holeNumber = toNumber(hole?.hole_number, null)

  if (holeNumber === 2 || holeNumber === 9) {
    return 'pitcher'
  }

  if (hole?.hole_type === 'keg_stand') {
    return 'keg_stand'
  }

  if (hole?.hole_type === 'pitcher') {
    return 'pitcher'
  }

  return 'standard'
}

export function getHoleTypeLabel(holeType) {
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

export function getHoleDisplayLabel(hole, holeType = getEffectiveHoleType(hole)) {
  if (holeType === 'standard') {
    if (hole?.has_guinness && !hole?.has_bunker && !hole?.has_water) {
      return 'Guinness Hole'
    }

    if (hole?.has_bunker && hole?.has_water) {
      return 'Bunker + Water'
    }

    if (hole?.has_bunker) {
      return 'Bunker Hazard'
    }

    if (hole?.has_water) {
      return 'Water Hazard'
    }
  }

  return getHoleTypeLabel(holeType)
}

export function formatHoleTimeRange(hole) {
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

/**
 * Currency formatter for prices.
 */
export function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(toNumber(value, 0))
}

/**
 * Time formatter for keg stand display.
 */
export function formatSeconds(value) {
  return `${toNumber(value, 0).toFixed(2)}s`
}

/**
 * Builds the full overall leaderboard across:
 * - standard holes from scores
 * - keg stand holes by average seconds rank
 * - pitcher holes by finish rank
 *
 * Returns:
 * [
 *   {
 *     rank,
 *     teamId,
 *     teamName,
 *     teamNumber,
 *     theme,
 *     totalScore,
 *     holesCompleted,
 *     holeBreakdown: [...]
 *   }
 * ]
 */
export function buildOverallLeaderboardData({
  teams = [],
  holes = [],
  scores = [],
  kegStandEntries = [],
  pitcherFinishes = [],
}) {
  const sortedHoles = sortHolesByNumber(holes)

  const leaderboardRows = teams.map((team) => {
    let totalScore = 0
    let holesCompleted = 0

    const holeBreakdown = sortedHoles.map((hole) => {
      const holeType = getEffectiveHoleType(hole)

      if (holeType === 'keg_stand') {
        const entriesForHole = kegStandEntries.filter(
          (entry) => entry.hole_id === hole.id
        )
        const teamEntries = entriesForHole.filter(
          (entry) => entry.team_id === team.id
        )

        const kegLeaderboard = buildKegStandTeamLeaderboard(entriesForHole)
        const teamRankRow =
          kegLeaderboard.find((row) => row.team_id === team.id) || null

        const score = teamRankRow ? teamRankRow.rankScore : null

        if (score !== null) {
          totalScore += score
          holesCompleted += 1
        }

        return {
          holeId: hole.id,
          holeNumber: hole.hole_number,
          holeName: hole.bar_name,
          holeType,
          displayTypeLabel: getHoleDisplayLabel(hole, holeType),
          score,
          details: {
            entries: teamEntries,
            average: teamRankRow?.average ?? null,
            count: teamRankRow?.count ?? 0,
          },
        }
      }

      if (holeType === 'pitcher') {
        const finishesForHole = pitcherFinishes.filter(
          (finish) => finish.hole_id === hole.id
        )

        const pitcherLeaderboard = buildPitcherLeaderboard(finishesForHole)
        const teamRankRow =
          pitcherLeaderboard.find((row) => row.team_id === team.id) || null

        const score = teamRankRow ? teamRankRow.rankScore : null

        if (score !== null) {
          totalScore += score
          holesCompleted += 1
        }

        return {
          holeId: hole.id,
          holeNumber: hole.hole_number,
          holeName: hole.bar_name,
          holeType,
          displayTypeLabel: getHoleDisplayLabel(hole, holeType),
          score,
          details: {
            finished_at: teamRankRow?.finished_at ?? null,
          },
        }
      }

      const scoreRow = getScoreForTeamAndHole(scores, team.id, hole.id)
      const isBunkerHazardOnly = scoreRow?.is_bunker_hazard
      const score = isBunkerHazardOnly ? null : calculateStandardHoleScore(scoreRow)

      if (score !== null) {
        totalScore += score
        holesCompleted += 1
      }

      return {
        holeId: hole.id,
        holeNumber: hole.hole_number,
        holeName: hole.bar_name,
        holeType,
        displayTypeLabel: getHoleDisplayLabel(hole, holeType),
        score,
        details: scoreRow,
      }
    })

    return {
      teamId: team.id,
      teamName: team.name,
      teamNumber: team.team_number,
      theme: team.theme,
      members: Array.isArray(team.members) ? team.members : [],
      totalScore,
      holesCompleted,
      hasStarted: holesCompleted > 0,
      holeBreakdown,
    }
  })

  leaderboardRows.sort((a, b) => {
    if (a.hasStarted !== b.hasStarted) return a.hasStarted ? -1 : 1

    if (!a.hasStarted && !b.hasStarted) {
      const aNum = toNumber(a.teamNumber, Number.MAX_SAFE_INTEGER)
      const bNum = toNumber(b.teamNumber, Number.MAX_SAFE_INTEGER)
      if (aNum !== bNum) return aNum - bNum

      return a.teamName.localeCompare(b.teamName)
    }

    if (a.holesCompleted !== b.holesCompleted) return b.holesCompleted - a.holesCompleted
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore

    const aNum = toNumber(a.teamNumber, Number.MAX_SAFE_INTEGER)
    const bNum = toNumber(b.teamNumber, Number.MAX_SAFE_INTEGER)
    if (aNum !== bNum) return aNum - bNum

    return a.teamName.localeCompare(b.teamName)
  })

  let lastScore = null
  let lastHolesCompleted = null
  let lastRank = 0
  let startedCount = 0

  return leaderboardRows.map((row) => {
    if (!row.hasStarted) {
      return {
        ...row,
        rank: null,
      }
    }

    startedCount += 1

    const sameStandingAsPrevious =
      startedCount > 1 &&
      row.totalScore === lastScore &&
      row.holesCompleted === lastHolesCompleted

    const rank = sameStandingAsPrevious ? lastRank : startedCount

    lastScore = row.totalScore
    lastHolesCompleted = row.holesCompleted
    lastRank = rank

    return {
      ...row,
      rank,
    }
  })
}