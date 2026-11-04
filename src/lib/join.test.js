import { describe, expect, it } from 'vitest'
import {
  clearRememberedJoin,
  joinExistingPlayer,
  messageForJoinError,
  readRememberedJoin,
  restoreVerifiedMembership,
  writeRememberedJoin,
} from './join'

function memoryStorage(initial = {}) {
  const values = { ...initial }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null
    },
    setItem(key, value) {
      values[key] = String(value)
    },
    removeItem(key) {
      delete values[key]
    },
  }
}

function authDouble({ session = null, refreshed = null, anonymous = null } = {}) {
  const calls = []
  return {
    calls,
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => {
      calls.push('refresh')
      return refreshed || { data: { session }, error: null }
    },
    signInAnonymously: async () => {
      calls.push('anonymous')
      return anonymous || { data: { session: null }, error: { message: 'Anonymous sign-ins are disabled' } }
    },
    signOut: async () => {
      calls.push('signOut')
      return { error: null }
    },
  }
}

describe('join messages', () => {
  it('turns database join failures into plain messages', () => {
    expect(messageForJoinError({ message: 'No course matches that game code' })).toMatch(/game code/i)
    expect(messageForJoinError({ message: 'No team on that course matches that team code' })).toMatch(/team code/i)
    expect(messageForJoinError({ message: 'No player with that name is assigned to that team' })).toMatch(/name/i)
    expect(messageForJoinError({ message: 'This player is already linked to another account. The course organizer must release that link first' })).toMatch(/organizer/i)
    expect(messageForJoinError({ message: 'This account is already linked to another player on this course' })).toMatch(/different player/i)
  })
})

describe('remembered join', () => {
  it('stores the three join fields and drops the old team login', () => {
    const storage = memoryStorage({ 'pub-golf-team-login': '{"id":"team-1"}' })
    writeRememberedJoin(storage, {
      gameCode: ' pubgolf ',
      teamCode: 'green',
      playerName: 'Ada',
    })

    expect(readRememberedJoin(storage)).toEqual({
      gameCode: 'pubgolf',
      teamCode: 'green',
      playerName: 'Ada',
    })
    expect(storage.getItem('pub-golf-team-login')).toBeNull()

    clearRememberedJoin(storage)
    expect(readRememberedJoin(storage)).toBeNull()
  })
})

describe('player session', () => {
  const credentials = { gameCode: 'pubgolf', teamCode: 'green', playerName: 'Ada' }
  const joinedRow = [{ course_id: 'course-1', team_id: 'team-1', player_id: 'player-1' }]

  it('reuses an existing anonymous session', async () => {
    const auth = authDouble({
      session: { user: { id: 'anon-1', is_anonymous: true }, expires_at: 4_000_000_000 },
    })
    const client = {
      auth,
      rpc: async () => ({ data: joinedRow, error: null }),
    }

    const result = await joinExistingPlayer(client, credentials)

    expect(result.ok).toBe(true)
    expect(result.membership).toMatchObject({
      courseId: 'course-1',
      teamId: 'team-1',
      playerId: 'player-1',
    })
    expect(auth.calls).not.toContain('anonymous')
  })

  it('signs in anonymously only when no session exists', async () => {
    const auth = authDouble({
      anonymous: {
        data: { session: { user: { id: 'anon-2', is_anonymous: true }, expires_at: 4_000_000_000 } },
        error: null,
      },
    })
    const client = {
      auth,
      rpc: async () => ({ data: joinedRow, error: null }),
    }

    const result = await joinExistingPlayer(client, credentials)

    expect(result.ok).toBe(true)
    expect(auth.calls).toEqual(['anonymous'])
  })

  it('keeps an email session instead of replacing it', async () => {
    const auth = authDouble({
      session: { user: { id: 'organizer-1', is_anonymous: false }, expires_at: 4_000_000_000 },
    })
    const client = {
      auth,
      rpc: async () => ({ data: joinedRow, error: null }),
    }

    const result = await joinExistingPlayer(client, credentials)

    expect(result.ok).toBe(true)
    expect(auth.calls).not.toContain('anonymous')
    expect(auth.calls).not.toContain('signOut')
  })

  it('does not create an anonymous user when an organizer session cannot refresh', async () => {
    const auth = authDouble({
      session: { user: { id: 'organizer-1', is_anonymous: false }, expires_at: 1 },
      refreshed: { data: { session: null }, error: { message: 'refresh token expired' } },
    })
    const client = {
      auth,
      rpc: async () => ({ data: joinedRow, error: null }),
    }

    const result = await joinExistingPlayer(client, credentials)

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/organizer session expired/i)
    expect(auth.calls).toEqual(['refresh'])
  })

  it('does not create a session while restoring a logged-out browser', async () => {
    const auth = authDouble()
    const rpcCalls = []
    const client = {
      auth,
      rpc: async () => {
        rpcCalls.push('rpc')
        return { data: joinedRow, error: null }
      },
    }

    const result = await restoreVerifiedMembership(client, credentials)

    expect(result.ok).toBe(false)
    expect(result.membership).toBeNull()
    expect(auth.calls).not.toContain('anonymous')
    expect(rpcCalls).toEqual([])
  })

  it('does not start a new anonymous session while restoring an expired one', async () => {
    const auth = authDouble({
      session: { user: { id: 'anon-1', is_anonymous: true }, expires_at: 1 },
      refreshed: { data: { session: null }, error: { message: 'refresh token expired' } },
    })
    const client = {
      auth,
      rpc: async () => ({ data: joinedRow, error: null }),
    }

    const result = await restoreVerifiedMembership(client, credentials)

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/session expired/i)
    expect(auth.calls).toEqual(['refresh', 'signOut'])
  })

  it('confirms a saved join against the server before restoring it', async () => {
    const auth = authDouble({
      session: { user: { id: 'anon-1', is_anonymous: true }, expires_at: 4_000_000_000 },
    })
    const client = {
      auth,
      rpc: async (_name, args) => {
        expect(args).toEqual({
          game_code: 'pubgolf',
          team_code: 'green',
          player_name: 'Ada',
        })
        return { data: joinedRow, error: null }
      },
    }

    const result = await restoreVerifiedMembership(client, credentials)

    expect(result.membership.playerId).toBe('player-1')
    expect(auth.calls).not.toContain('anonymous')
  })
})
