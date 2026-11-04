import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RosterView } from '../components/CourseRoster'
import {
  buildRosterGroups,
  createCoursePlayer,
  createCourseTeam,
  DELETE_PLAYER_WARNING,
  DELETE_TEAM_WARNING,
  deleteCoursePlayer,
  deleteCourseTeam,
  duplicatePlayerName,
  loadCourseRoster,
  messageForRosterError,
  moveCoursePlayer,
  RELEASE_SIGN_IN_WARNING,
  releaseCoursePlayerSignIn,
  renameCourseTeam,
  validatePlayerName,
  validateTeamName,
} from './roster'

const courseId = 'course-1'
const otherCourse = 'course-2'

const teams = [
  { id: 'team-b', course_id: courseId, theme: 'Bravo', emoji: null, join_code: 'BBBBBB' },
  { id: 'team-a', course_id: courseId, theme: 'Alpha', emoji: '☘️', join_code: 'AAAAAA' },
]

const players = [
  { id: 'player-pat-b', course_id: courseId, team_id: 'team-b', name: 'Pat' },
  { id: 'player-pat-a', course_id: courseId, team_id: 'team-a', name: 'Pat' },
  { id: 'player-riley', course_id: courseId, team_id: null, name: 'Riley' },
  { id: 'player-other', course_id: otherCourse, team_id: null, name: 'Casey' },
]

function rosterClient(handler) {
  const calls = []
  return {
    calls,
    from(table) {
      const state = { table, action: 'select', payload: null, filters: [], select: null }
      function finish() {
        const snapshot = { ...state, filters: [...state.filters] }
        calls.push(snapshot)
        return Promise.resolve(handler(snapshot))
      }
      const builder = {
        select(columns) {
          state.select = columns
          return builder
        },
        insert(payload) {
          state.action = 'insert'
          state.payload = payload
          return builder
        },
        update(payload) {
          state.action = 'update'
          state.payload = payload
          return builder
        },
        delete() {
          state.action = 'delete'
          return builder
        },
        eq(column, value) {
          state.filters.push([column, value])
          return builder
        },
        order(column) {
          state.order = column
          return builder
        },
        then(resolve, reject) {
          return finish().then(resolve, reject)
        },
      }
      return builder
    },
    rpc(name, args) {
      const call = { rpc: name, args }
      calls.push(call)
      return Promise.resolve(handler(call))
    },
  }
}

describe('roster validation', () => {
  it('trims names and rejects blanks and names that are too long', () => {
    expect(validateTeamName('  Red   Lions ').name).toBe('Red Lions')
    expect(validateTeamName('   ').message).toBe('Enter a team name.')
    expect(validateTeamName('a'.repeat(61)).message).toMatch(/60/)
    expect(validatePlayerName('  Pat ').name).toBe('Pat')
    expect(validatePlayerName(' ').message).toBe('Enter a first name.')
    expect(validatePlayerName('a'.repeat(41)).message).toMatch(/40/)
  })

  it('rejects a repeated name on one team and allows it on another or while unassigned', () => {
    expect(duplicatePlayerName(players, 'pat', 'team-a')).toBe(true)
    expect(duplicatePlayerName(players, 'Pat', 'team-b', 'player-pat-b')).toBe(false)
    expect(duplicatePlayerName(players, 'Pat', null)).toBe(false)
    expect(duplicatePlayerName(players, 'Riley', 'team-a')).toBe(false)
  })

  it('turns database name collisions into a roster message', () => {
    expect(messageForRosterError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "players_team_id_name_key"',
    }, 'player')).toBe('That name is already on this team.')
    expect(messageForRosterError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "players_one_name_per_team"',
    }, 'player')).toBe('That name is already on this team.')
    expect(messageForRosterError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "teams_course_name_unique"',
    }, 'team')).toBe('A team with that name already exists on this course.')
    expect(messageForRosterError({
      code: '42501',
      message: 'new row violates row-level security policy',
    })).toMatch(/course organizer/)
  })
})

describe('roster grouping', () => {
  it('groups players by team, keeps unassigned players separate, and marks claims', () => {
    const groups = buildRosterGroups(
      teams,
      players.filter((player) => player.course_id === courseId),
      ['player-pat-a'],
    )

    expect(groups.teams.map((team) => team.theme)).toEqual(['Alpha', 'Bravo'])
    expect(groups.teams[0].players.map((player) => player.name)).toEqual(['Pat'])
    expect(groups.teams[0].players[0].claimed).toBe(true)
    expect(groups.teams[1].players[0].claimed).toBe(false)
    expect(groups.unassigned.map((player) => player.name)).toEqual(['Riley'])
  })
})

describe('roster changes', () => {
  it('creates and renames a team without sending a join code', async () => {
    const client = rosterClient(() => ({
      data: [{ id: 'team-c', course_id: courseId, theme: 'Charlie', join_code: 'CCCCCC' }],
      error: null,
    }))

    const created = await createCourseTeam(client, { courseId, name: ' Charlie ', teams })
    const renamed = await renameCourseTeam(client, {
      courseId,
      teamId: 'team-a',
      name: 'Alpha Two',
      teams,
    })

    expect(created.ok).toBe(true)
    expect(renamed.ok).toBe(true)
    expect(client.calls[0]).toMatchObject({
      table: 'teams',
      action: 'insert',
      payload: { course_id: courseId, theme: 'Charlie' },
    })
    expect(client.calls[0].payload).not.toHaveProperty('join_code')
    expect(client.calls[1]).toMatchObject({
      table: 'teams',
      action: 'update',
      payload: { theme: 'Alpha Two' },
      filters: [['id', 'team-a'], ['course_id', courseId]],
    })
    expect(client.calls[1].payload).not.toHaveProperty('join_code')
  })

  it('rejects a duplicate team name before writing', async () => {
    const client = rosterClient(() => ({ data: [], error: null }))
    const result = await createCourseTeam(client, { courseId, name: 'alpha', teams })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/already exists/)
    expect(client.calls).toEqual([])
  })

  it('does not save a second player with the same name on one team', async () => {
    const client = rosterClient(() => ({ data: [], error: null }))
    const result = await createCoursePlayer(client, {
      courseId,
      name: ' pat ',
      teamId: 'team-a',
      teams,
      players,
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe('That name is already on this team.')
    expect(client.calls).toEqual([])
  })

  it('adds a player to a team or leaves them unassigned', async () => {
    const client = rosterClient(() => ({
      data: [{ id: 'player-new', course_id: courseId, team_id: null, name: 'Casey' }],
      error: null,
    }))

    const assigned = await createCoursePlayer(client, {
      courseId,
      name: ' Casey ',
      teamId: 'team-a',
      teams,
      players,
    })
    const unassigned = await createCoursePlayer(client, {
      courseId,
      name: 'Casey',
      teamId: null,
      teams,
      players,
    })

    expect(assigned.ok).toBe(true)
    expect(unassigned.ok).toBe(true)
    expect(client.calls[0].payload).toEqual({
      course_id: courseId,
      name: 'Casey',
      team_id: 'team-a',
    })
    expect(client.calls[1].payload.team_id).toBeNull()
  })

  it('moves and unassigns a player without writing a score', async () => {
    const client = rosterClient(() => ({
      data: [{ id: 'player-riley', course_id: courseId, team_id: 'team-a', name: 'Riley' }],
      error: null,
    }))

    const moved = await moveCoursePlayer(client, {
      courseId,
      playerId: 'player-riley',
      teamId: 'team-a',
      teams,
      players,
    })
    const unassigned = await moveCoursePlayer(client, {
      courseId,
      playerId: 'player-pat-a',
      teamId: null,
      teams,
      players,
    })

    expect(moved.ok).toBe(true)
    expect(unassigned.ok).toBe(true)
    expect(client.calls.map((call) => call.table)).toEqual(['players', 'players'])
    expect(client.calls[0].payload).toEqual({ team_id: 'team-a' })
    expect(client.calls[1].payload).toEqual({ team_id: null })
    expect(client.calls[0].filters).toEqual([['id', 'player-riley'], ['course_id', courseId]])
  })

  it('stops a move onto a teammate with the same name', async () => {
    const client = rosterClient(() => ({ data: [], error: null }))
    const result = await moveCoursePlayer(client, {
      courseId,
      playerId: 'player-pat-a',
      teamId: 'team-b',
      teams,
      players,
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe('That name is already on this team.')
    expect(client.calls).toEqual([])
  })

  it('deletes one player and, when a team is deleted, does not delete the players', async () => {
    const client = rosterClient((call) => ({
      data: [{ id: call.filters?.[0]?.[1] || 'team-a' }],
      error: null,
    }))

    const removed = await deleteCoursePlayer(client, {
      courseId,
      playerId: 'player-riley',
      players,
    })
    const removedTeam = await deleteCourseTeam(client, { courseId, teamId: 'team-a' })

    expect(removed.ok).toBe(true)
    expect(removedTeam.ok).toBe(true)
    expect(client.calls[0]).toMatchObject({
      table: 'players',
      action: 'delete',
      filters: [['id', 'player-riley'], ['course_id', courseId]],
    })
    expect(client.calls[1]).toMatchObject({
      table: 'teams',
      action: 'delete',
      filters: [['id', 'team-a'], ['course_id', courseId]],
    })
  })

  it('treats a blocked team delete as an organizer failure', async () => {
    const client = rosterClient(() => ({ data: [], error: null }))
    const result = await deleteCourseTeam(client, { courseId, teamId: 'team-a' })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/course organizer/)
  })

  it('releases a sign-in for a player on this course and ignores another course', async () => {
    const client = rosterClient(() => ({ error: null }))
    const released = await releaseCoursePlayerSignIn(client, {
      courseId,
      playerId: 'player-pat-a',
      players,
    })
    const blocked = await releaseCoursePlayerSignIn(client, {
      courseId,
      playerId: 'player-other',
      players,
    })

    expect(released.ok).toBe(true)
    expect(blocked.ok).toBe(false)
    expect(client.calls).toEqual([
      { rpc: 'release_player_access', args: { target_player_id: 'player-pat-a' } },
    ])
  })

  it('loads this course and still shows the roster when sign-in status is unavailable', async () => {
    const client = rosterClient((call) => {
      if (call.rpc) return { data: null, error: { code: 'PGRST202', message: 'course_player_sign_ins' } }
      if (call.table === 'teams') return { data: teams, error: null }
      return { data: players.filter((player) => player.course_id === courseId), error: null }
    })

    const result = await loadCourseRoster(client, courseId)

    expect(result.ok).toBe(true)
    expect(result.teams).toHaveLength(2)
    expect(result.claimedPlayerIds).toEqual([])
    expect(result.claimsMessage).toMatch(/latest migration/)
    const teamsCall = client.calls.find((call) => call.table === 'teams')
    const claimsCall = client.calls.find((call) => call.rpc === 'course_player_sign_ins')
    expect(teamsCall.filters).toEqual([['course_id', courseId]])
    expect(claimsCall.args).toEqual({ target_course: courseId })
  })
})

describe('roster screen', () => {
  const viewTeams = [
    { id: 'team-a', course_id: courseId, theme: 'Alpha', emoji: null, join_code: 'AB12CD' },
  ]
  const viewPlayers = [
    { id: 'player-pat', course_id: courseId, team_id: 'team-a', name: 'Pat' },
    { id: 'player-riley', course_id: courseId, team_id: null, name: 'Riley' },
  ]

  function renderRoster(props) {
    return renderToStaticMarkup(createElement(RosterView, props))
  }

  it('shows the team code, assigned players, and unassigned players', () => {
    const html = renderRoster({
      teams: viewTeams,
      players: viewPlayers,
      claimedPlayerIds: ['player-pat'],
    })

    expect(html).toContain('Alpha')
    expect(html).toContain('AB12CD')
    expect(html).toContain('Copy')
    expect(html).toContain('Pat')
    expect(html).toContain('Signed in')
    expect(html).toContain('Release sign-in')
    expect(html).toContain('Unassigned')
    expect(html).toContain('Riley')
    expect(html).not.toContain('auth-user')
    expect(html).toContain('readOnly')
  })

  it('explains team deletion, player deletion, and releasing a sign-in', () => {
    const teamHtml = renderRoster({
      teams: viewTeams,
      players: viewPlayers,
      initialPending: { kind: 'delete-team', id: 'team-a' },
    })
    const playerHtml = renderRoster({
      teams: viewTeams,
      players: viewPlayers,
      initialPending: { kind: 'delete-player', id: 'player-pat' },
    })
    const releaseHtml = renderRoster({
      teams: viewTeams,
      players: viewPlayers,
      claimedPlayerIds: ['player-pat'],
      initialPending: { kind: 'release', id: 'player-pat' },
    })

    expect(teamHtml).toContain(DELETE_TEAM_WARNING)
    expect(playerHtml).toContain(DELETE_PLAYER_WARNING)
    expect(releaseHtml).toContain(RELEASE_SIGN_IN_WARNING)
  })

  it('shows an empty roster without a join-code field', () => {
    const html = renderRoster({ teams: [], players: [] })

    expect(html).toContain('No teams yet')
    expect(html).toContain('No unassigned players')
    expect(html).not.toContain('Team code')
  })
})
