const JOIN_STORAGE_KEY = 'pub-golf-join-request'
export const LEGACY_TEAM_LOGIN_KEY = 'pub-golf-team-login'

const JOIN_MESSAGES = [
  ['No course matches that game code', "That game code doesn't match a course."],
  ['No team on that course matches that team code', "That team code doesn't match a team on this course."],
  ['No player with that name is assigned to that team', 'No player with that name is on that team.'],
  ['More than one player on that team matches that name', 'More than one player on that team has that name. Ask the organizer to rename one.'],
  ['already linked to another account', 'That player is already linked to another account. The organizer has to release the link before you can join.'],
  ['already linked to another player', 'This account is already joined as a different player on this course.'],
  ['Game code, team code, and player name are required', 'Enter a game code, team code, and player name.'],
  ['Sign in before joining a team', 'Sign in before joining a team.'],
  ['Anonymous sign-ins are disabled', "Anonymous sign-in isn't available right now."],
  ['anonymous_provider_disabled', "Anonymous sign-in isn't available right now."],
]

export function isAnonymousUser(user) {
  return user?.is_anonymous === true || user?.app_metadata?.provider === 'anonymous'
}

export function sessionNeedsRefresh(session, now = Date.now()) {
  if (!session?.expires_at) return false
  return session.expires_at * 1000 <= now + 15000
}

export function messageForJoinError(error) {
  const raw = String(error?.message || error || '')
  for (const [needle, message] of JOIN_MESSAGES) {
    if (raw.includes(needle)) return message
  }
  if (/expired|invalid jwt|refresh token/i.test(raw)) {
    return 'Your session expired. Enter your codes again to join.'
  }
  return raw || 'Could not join that team.'
}

function cleanJoin(value) {
  const gameCode = String(value?.gameCode || '').trim()
  const teamCode = String(value?.teamCode || '').trim()
  const playerName = String(value?.playerName || '').trim()
  if (!gameCode || !teamCode || !playerName) return null
  return { gameCode, teamCode, playerName }
}

export function readRememberedJoin(storage) {
  try {
    const raw = storage.getItem(JOIN_STORAGE_KEY)
    if (!raw) return null
    return cleanJoin(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeRememberedJoin(storage, join) {
  const cleaned = cleanJoin(join)
  if (!cleaned) return
  storage.setItem(JOIN_STORAGE_KEY, JSON.stringify(cleaned))
  storage.removeItem(LEGACY_TEAM_LOGIN_KEY)
}

export function clearRememberedJoin(storage) {
  storage.removeItem(JOIN_STORAGE_KEY)
  storage.removeItem(LEGACY_TEAM_LOGIN_KEY)
}

async function usableSession(auth, { allowAnonymousSignIn }) {
  const { data, error } = await auth.getSession()
  if (error) return { ok: false, message: messageForJoinError(error) }

  let session = data?.session ?? null
  if (session && sessionNeedsRefresh(session)) {
    const refreshed = await auth.refreshSession()
    if (refreshed.error || !refreshed.data?.session) {
      if (!isAnonymousUser(session.user)) {
        return {
          ok: false,
          message: 'Your organizer session expired. Sign in with email again before joining a team.',
        }
      }
      await auth.signOut?.({ scope: 'local' })
      if (!allowAnonymousSignIn) {
        return { ok: false, message: 'Your session expired. Enter your codes again to join.' }
      }
      session = null
    } else {
      session = refreshed.data.session
    }
  }

  if (session?.user) return { ok: true, session }
  if (!allowAnonymousSignIn) return { ok: false, message: '' }

  const signedIn = await auth.signInAnonymously()
  if (signedIn.error || !signedIn.data?.session) {
    return {
      ok: false,
      message: messageForJoinError(signedIn.error || 'Anonymous sign-in failed.'),
    }
  }
  return { ok: true, session: signedIn.data.session }
}

async function callJoinTeam(client, credentials) {
  const cleaned = cleanJoin(credentials)
  if (!cleaned) {
    return { ok: false, message: 'Enter a game code, team code, and player name.' }
  }

  const { data, error } = await client.rpc('join_team', {
    game_code: cleaned.gameCode,
    team_code: cleaned.teamCode,
    player_name: cleaned.playerName,
  })
  if (error) return { ok: false, message: messageForJoinError(error) }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.course_id || !row?.team_id || !row?.player_id) {
    return { ok: false, message: 'The team join could not be confirmed. Try again.' }
  }

  return {
    ok: true,
    membership: {
      courseId: row.course_id,
      teamId: row.team_id,
      playerId: row.player_id,
      playerName: cleaned.playerName,
    },
  }
}

export async function joinExistingPlayer(client, credentials) {
  const sessionResult = await usableSession(client.auth, { allowAnonymousSignIn: true })
  if (!sessionResult.ok) return sessionResult
  return callJoinTeam(client, credentials)
}

export async function restoreVerifiedMembership(client, remembered) {
  if (!cleanJoin(remembered)) return { ok: false, membership: null, message: '' }
  const sessionResult = await usableSession(client.auth, { allowAnonymousSignIn: false })
  if (!sessionResult.ok || !sessionResult.session) {
    return { ok: false, membership: null, message: sessionResult.message || '' }
  }
  return callJoinTeam(client, remembered)
}
