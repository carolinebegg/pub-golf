import { sortPlayersByName } from './helpers'

export const TEAM_NAME_LIMIT = 60
export const PLAYER_NAME_LIMIT = 40

export const DELETE_TEAM_WARNING =
  'Deleting this team permanently deletes its results. Its players stay in the course as unassigned.'

export const DELETE_PLAYER_WARNING =
  'Deleting this player removes them from the course. Scores already recorded for their team stay on that team.'

export const RELEASE_SIGN_IN_WARNING =
  'Releasing the sign-in lets this player join again from another device or account. They stay on the roster.'

const ORGANIZER_ONLY = 'Only the course organizer can manage teams and players.'
const SIGN_IN_STATUS_UNAVAILABLE =
  'Sign-in status needs a database update. Apply the latest migration, then reload this page.'

export function cleanRosterName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function validateTeamName(name) {
  const cleaned = cleanRosterName(name)
  if (!cleaned) return { ok: false, message: 'Enter a team name.' }
  if (cleaned.length > TEAM_NAME_LIMIT) {
    return { ok: false, message: 'Team name must be 60 characters or fewer.' }
  }
  return { ok: true, name: cleaned }
}

export function validatePlayerName(name) {
  const cleaned = cleanRosterName(name)
  if (!cleaned) return { ok: false, message: 'Enter a first name.' }
  if (cleaned.length > PLAYER_NAME_LIMIT) {
    return { ok: false, message: 'First name must be 40 characters or fewer.' }
  }
  return { ok: true, name: cleaned }
}

export function duplicateTeamName(teams, name, exceptTeamId = null) {
  const cleaned = cleanRosterName(name).toLowerCase()
  if (!cleaned) return false
  return (teams || []).some((team) => (
    team.id !== exceptTeamId && cleanRosterName(team.theme).toLowerCase() === cleaned
  ))
}

export function duplicatePlayerName(players, name, teamId, exceptPlayerId = null) {
  if (!teamId) return false
  const cleaned = cleanRosterName(name).toLowerCase()
  if (!cleaned) return false
  return (players || []).some((player) => (
    player.id !== exceptPlayerId
    && player.team_id === teamId
    && cleanRosterName(player.name).toLowerCase() === cleaned
  ))
}

export function messageForRosterError(error, subject = '') {
  const raw = String(error?.message || error || '')
  const code = String(error?.code || '')

  if (raw.includes('A team name is required')) return 'Enter a team name.'
  if (raw.includes('Team name must be 60')) return 'Team name must be 60 characters or fewer.'
  if (raw.includes('A player name is required')) return 'Enter a first name.'
  if (raw.includes('Player name must be 40')) return 'First name must be 40 characters or fewer.'
  if (raw.includes('not on this player')) return "That team is not on this player's course."
  if (raw.includes('A player cannot be moved')) return 'A player cannot be moved to another course.'
  if (raw.includes('A team cannot be moved')) return 'A team cannot be moved to another course.'
  if (raw.includes('Player was not found')) return 'That player is no longer on this course.'
  if (
    raw.includes('Only the course organizer')
    || raw.includes('row-level security')
    || code === '42501'
  ) {
    return subject === 'release'
      ? 'Only the course organizer can release a sign-in.'
      : ORGANIZER_ONLY
  }
  if (
    raw.includes('players_one_name_per_team')
    || raw.includes('players_team_id_name_key')
    || (subject === 'player' && (code === '23505' || raw.includes('duplicate key')))
  ) {
    return 'That name is already on this team.'
  }
  if (
    raw.includes('teams_course_name_unique')
    || (subject === 'team' && (code === '23505' || raw.includes('duplicate key')))
  ) {
    return 'A team with that name already exists on this course.'
  }
  if (code === '23505' || raw.includes('duplicate key')) return 'That name is already used.'
  return raw || 'The roster could not be updated. Try again.'
}

export function signInStatusUnavailable(error) {
  const code = String(error?.code || '')
  const raw = String(error?.message || error || '')
  return code === 'PGRST202'
    || code === '42883'
    || raw.includes('course_player_sign_ins')
    || raw.includes('schema cache')
}

export function buildRosterGroups(teams, players, claimedPlayerIds = []) {
  const claimed = new Set(claimedPlayerIds || [])
  const teamIds = new Set((teams || []).map((team) => team.id))
  const withClaim = (player) => ({
    ...player,
    claimed: claimed.has(player.id),
  })
  const sortedTeams = [...(teams || [])].sort((a, b) => (
    cleanRosterName(a.theme).localeCompare(cleanRosterName(b.theme), undefined, { sensitivity: 'base' })
  ))

  return {
    teams: sortedTeams.map((team) => ({
      ...team,
      players: sortPlayersByName(
        (players || []).filter((player) => player.team_id === team.id),
      ).map(withClaim),
    })),
    unassigned: sortPlayersByName(
      (players || []).filter((player) => !player.team_id || !teamIds.has(player.team_id)),
    ).map(withClaim),
  }
}

function requireCourse(courseId) {
  if (!courseId) return { ok: false, message: 'Open a course before changing the roster.' }
  return null
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data
}

export async function loadCourseRoster(client, courseId) {
  const missing = requireCourse(courseId)
  if (missing) {
    return { ok: false, teams: [], players: [], claimedPlayerIds: [], claimsMessage: '', ...missing }
  }

  const [teamsResult, playersResult, claimsResult] = await Promise.all([
    client
      .from('teams')
      .select('id, course_id, theme, emoji, join_code')
      .eq('course_id', courseId)
      .order('theme'),
    client
      .from('players')
      .select('id, course_id, team_id, name')
      .eq('course_id', courseId)
      .order('name'),
    client.rpc('course_player_sign_ins', { target_course: courseId }),
  ])

  if (teamsResult.error) {
    return {
      ok: false,
      teams: [],
      players: [],
      claimedPlayerIds: [],
      claimsMessage: '',
      message: messageForRosterError(teamsResult.error),
    }
  }
  if (playersResult.error) {
    return {
      ok: false,
      teams: [],
      players: [],
      claimedPlayerIds: [],
      claimsMessage: '',
      message: messageForRosterError(playersResult.error),
    }
  }

  let claimsMessage = ''
  let claimedPlayerIds = []
  if (claimsResult.error) {
    claimsMessage = signInStatusUnavailable(claimsResult.error)
      ? SIGN_IN_STATUS_UNAVAILABLE
      : messageForRosterError(claimsResult.error)
  } else {
    claimedPlayerIds = (claimsResult.data || []).map((row) => row.player_id).filter(Boolean)
  }

  return {
    ok: true,
    teams: teamsResult.data || [],
    players: playersResult.data || [],
    claimedPlayerIds,
    claimsMessage,
  }
}

export async function createCourseTeam(client, { courseId, name, teams = [] } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  const validated = validateTeamName(name)
  if (!validated.ok) return validated
  if (duplicateTeamName(teams, validated.name)) {
    return { ok: false, message: 'A team with that name already exists on this course.' }
  }

  const { data, error } = await client
    .from('teams')
    .insert({ course_id: courseId, theme: validated.name })
    .select('id, course_id, theme, emoji, join_code')

  if (error) return { ok: false, message: messageForRosterError(error, 'team') }
  const team = firstRow(data)
  if (!team?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true, team }
}

export async function renameCourseTeam(client, { courseId, teamId, name, teams = [] } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  if (!teamId) return { ok: false, message: 'Choose a team to rename.' }
  const validated = validateTeamName(name)
  if (!validated.ok) return validated
  if (duplicateTeamName(teams, validated.name, teamId)) {
    return { ok: false, message: 'A team with that name already exists on this course.' }
  }

  const { data, error } = await client
    .from('teams')
    .update({ theme: validated.name })
    .eq('id', teamId)
    .eq('course_id', courseId)
    .select('id, course_id, theme, emoji, join_code')

  if (error) return { ok: false, message: messageForRosterError(error, 'team') }
  const team = firstRow(data)
  if (!team?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true, team }
}

export async function deleteCourseTeam(client, { courseId, teamId } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  if (!teamId) return { ok: false, message: 'Choose a team to delete.' }

  const { data, error } = await client
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('course_id', courseId)
    .select('id')

  if (error) return { ok: false, message: messageForRosterError(error, 'team') }
  if (!firstRow(data)?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true }
}

export async function createCoursePlayer(client, { courseId, name, teamId = null, teams = [], players = [] } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  const validated = validatePlayerName(name)
  if (!validated.ok) return validated
  if (teamId && !(teams || []).some((team) => team.id === teamId)) {
    return { ok: false, message: "That team is not on this player's course." }
  }
  if (duplicatePlayerName(players, validated.name, teamId)) {
    return { ok: false, message: 'That name is already on this team.' }
  }

  const { data, error } = await client
    .from('players')
    .insert({
      course_id: courseId,
      name: validated.name,
      team_id: teamId || null,
    })
    .select('id, course_id, team_id, name')

  if (error) return { ok: false, message: messageForRosterError(error, 'player') }
  const player = firstRow(data)
  if (!player?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true, player }
}

export async function moveCoursePlayer(client, {
  courseId,
  playerId,
  teamId = null,
  teams = [],
  players = [],
} = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  const player = (players || []).find((row) => row.id === playerId)
  if (!player || player.course_id !== courseId) {
    return { ok: false, message: 'That player is not on this course.' }
  }
  if (teamId && !(teams || []).some((team) => team.id === teamId)) {
    return { ok: false, message: "That team is not on this player's course." }
  }
  if (duplicatePlayerName(players, player.name, teamId, playerId)) {
    return { ok: false, message: 'That name is already on this team.' }
  }

  const { data, error } = await client
    .from('players')
    .update({ team_id: teamId || null })
    .eq('id', playerId)
    .eq('course_id', courseId)
    .select('id, course_id, team_id, name')

  if (error) return { ok: false, message: messageForRosterError(error, 'player') }
  const updated = firstRow(data)
  if (!updated?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true, player: updated }
}

export async function deleteCoursePlayer(client, { courseId, playerId, players = [] } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  const player = (players || []).find((row) => row.id === playerId)
  if (!player || player.course_id !== courseId) {
    return { ok: false, message: 'That player is not on this course.' }
  }

  const { data, error } = await client
    .from('players')
    .delete()
    .eq('id', playerId)
    .eq('course_id', courseId)
    .select('id')

  if (error) return { ok: false, message: messageForRosterError(error, 'player') }
  if (!firstRow(data)?.id) return { ok: false, message: ORGANIZER_ONLY }
  return { ok: true }
}

export async function releaseCoursePlayerSignIn(client, { courseId, playerId, players = [] } = {}) {
  const missing = requireCourse(courseId)
  if (missing) return missing
  const player = (players || []).find((row) => row.id === playerId)
  if (!player || player.course_id !== courseId) {
    return { ok: false, message: 'That player is not on this course.' }
  }

  const { error } = await client.rpc('release_player_access', { target_player_id: playerId })
  if (error) return { ok: false, message: messageForRosterError(error, 'release') }
  return { ok: true }
}
