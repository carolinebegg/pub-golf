import { describe, expect, it } from 'vitest'
import {
  createOrganizerCourse,
  isOrganizerAccount,
  isRecoveryUrl,
  loadOrganizerCourses,
  organizerFirstName,
  readOpenOrganizerCourse,
  screenForSession,
  sendOrganizerPasswordReset,
  setOrganizerPassword,
  signInOrganizer,
  signUpOrganizer,
  validateCourseTitle,
  writeOpenOrganizerCourse,
} from './organizer'

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

const organizer = {
  id: 'user-1',
  is_anonymous: false,
  user_metadata: { first_name: 'Caroline', display_name: 'Caroline' },
}

const anonymous = {
  id: 'anon-1',
  is_anonymous: true,
  app_metadata: { provider: 'anonymous' },
}

describe('organizer account', () => {
  it('treats an email user as an organizer and an anonymous user as a player', () => {
    expect(isOrganizerAccount(organizer)).toBe(true)
    expect(isOrganizerAccount(anonymous)).toBe(false)
    expect(isOrganizerAccount(null)).toBe(false)
    expect(organizerFirstName(organizer)).toBe('Caroline')
    expect(organizerFirstName(anonymous)).toBe('')
  })

  it('keeps a joined player in the game and an organizer on their courses', () => {
    expect(screenForSession({ user: anonymous, membership: { courseId: 'course-1' } })).toBe('play')
    expect(screenForSession({ user: organizer })).toBe('organizer')
    expect(screenForSession({ user: null })).toBe('landing')
    expect(screenForSession({ user: organizer, recovery: true })).toBe('organizer')
    expect(isRecoveryUrl({ hash: '#access_token=abc&type=recovery' })).toBe(true)
    expect(isRecoveryUrl({ hash: '' })).toBe(false)
  })
})

describe('organizer sign-up', () => {
  it('stores the first name as the display name and does not create an anonymous session', async () => {
    const calls = []
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signUp: async (payload) => {
          calls.push(payload)
          return { data: { user: organizer, session: { user: organizer } }, error: null }
        },
        signInAnonymously: async () => {
          calls.push('anonymous')
          return { data: { session: null }, error: null }
        },
        updateUser: async () => {
          calls.push('update')
          return { data: { user: null }, error: null }
        },
      },
    }

    const result = await signUpOrganizer(client, {
      firstName: ' Caroline ',
      email: 'caroline@example.com',
      password: 'secret1',
    })

    expect(result.ok).toBe(true)
    expect(result.needsEmailConfirmation).toBe(false)
    expect(calls).toEqual([
      {
        email: 'caroline@example.com',
        password: 'secret1',
        options: {
          data: { first_name: 'Caroline', display_name: 'Caroline' },
          emailRedirectTo: undefined,
        },
      },
    ])
  })

  it('turns an anonymous player session into the organizer account instead of replacing it', async () => {
    const calls = []
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: anonymous } }, error: null }),
        updateUser: async (payload) => {
          calls.push(payload)
          return { data: { user: { ...organizer, id: anonymous.id } }, error: null }
        },
        signUp: async () => {
          calls.push('sign-up')
          return { data: { session: null }, error: null }
        },
      },
    }

    const result = await signUpOrganizer(client, {
      firstName: 'Ada',
      email: 'ada@example.com',
      password: 'secret1',
    })

    expect(result.ok).toBe(true)
    expect(result.user.id).toBe(anonymous.id)
    expect(calls).toEqual([
      {
        email: 'ada@example.com',
        password: 'secret1',
        data: { first_name: 'Ada', display_name: 'Ada' },
      },
    ])
  })

  it('asks for email confirmation when sign-up does not return a session', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signUp: async () => ({ data: { user: organizer, session: null }, error: null }),
      },
    }

    const result = await signUpOrganizer(client, {
      firstName: 'Ada',
      email: 'ada@example.com',
      password: 'secret1',
    })

    expect(result.needsEmailConfirmation).toBe(true)
  })

  it('signs in with email and password', async () => {
    const calls = []
    const client = {
      auth: {
        signInWithPassword: async (payload) => {
          calls.push(payload)
          return { data: { user: organizer }, error: null }
        },
        signInAnonymously: async () => {
          throw new Error('anonymous')
        },
      },
    }

    const result = await signInOrganizer(client, {
      email: 'caroline@example.com',
      password: 'secret1',
    })

    expect(result.ok).toBe(true)
    expect(calls).toEqual([{ email: 'caroline@example.com', password: 'secret1' }])
  })

  it('rejects an anonymous result from password sign-in', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({ data: { user: anonymous }, error: null }),
      },
    }

    const result = await signInOrganizer(client, {
      email: 'ada@example.com',
      password: 'secret1',
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/cannot create courses/i)
  })

  it('sends a password reset and then updates the password', async () => {
    const calls = []
    const client = {
      auth: {
        resetPasswordForEmail: async (email, options) => {
          calls.push({ email, options })
          return { error: null }
        },
        updateUser: async (payload) => {
          calls.push(payload)
          return { data: { user: organizer }, error: null }
        },
      },
    }

    const reset = await sendOrganizerPasswordReset(client, 'caroline@example.com', 'http://localhost:5174')
    const next = await setOrganizerPassword(client, 'new-secret')

    expect(reset.ok).toBe(true)
    expect(next.ok).toBe(true)
    expect(calls).toEqual([
      { email: 'caroline@example.com', options: { redirectTo: 'http://localhost:5174' } },
      { password: 'new-secret' },
    ])
  })
})

describe('course creation', () => {
  function courseClient(insertResult) {
    const calls = []
    return {
      calls,
      from(table) {
        return {
          insert(payload) {
            calls.push({ table, payload })
            const builder = {
              select() {
                return builder
              },
              single: async () => insertResult,
            }
            return builder
          },
          delete() {
            calls.push({ table, delete: true })
            return { eq: async () => ({ error: null }) }
          },
          select() {
            return this
          },
          eq(column, value) {
            calls.push({ table, eq: [column, value] })
            return this
          },
          order() {
            return Promise.resolve({ data: [{ id: 'course-1', organizer_id: 'user-1' }], error: null })
          },
        }
      },
    }
  }

  it('assigns the signed-in organizer and lets the database replace the game code', async () => {
    const client = courseClient({
      data: {
        id: 'course-9',
        title: 'Friday Crawl',
        join_code: 'K7M2QP',
        organizer_id: 'user-1',
        organizer_name: 'Caroline',
      },
      error: null,
    })

    const result = await createOrganizerCourse(client, { title: ' Friday Crawl ', user: organizer })

    expect(result.ok).toBe(true)
    expect(result.course.join_code).toBe('K7M2QP')
    expect(client.calls).toEqual([
      {
        table: 'courses',
        payload: {
          title: 'Friday Crawl',
          organizer_id: 'user-1',
          join_code: 'pending',
        },
      },
    ])
  })

  it('does not create a course for an anonymous player', async () => {
    const client = courseClient({ data: null, error: null })
    const result = await createOrganizerCourse(client, { title: 'Friday Crawl', user: anonymous })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/organizer account/i)
    expect(client.calls).toEqual([])
  })

  it('removes a course that did not receive a generated game code', async () => {
    const client = courseClient({
      data: { id: 'course-9', title: 'Friday Crawl', join_code: 'pending', organizer_id: 'user-1' },
      error: null,
    })

    const result = await createOrganizerCourse(client, { title: 'Friday Crawl', user: organizer })

    expect(result.ok).toBe(false)
    expect(client.calls.some((call) => call.delete)).toBe(true)
  })

  it('loads only the signed-in organizer’s courses', async () => {
    const client = courseClient(null)
    const result = await loadOrganizerCourses(client, 'user-1')

    expect(result.ok).toBe(true)
    expect(result.courses).toHaveLength(1)
    expect(client.calls).toEqual([{ table: 'courses', eq: ['organizer_id', 'user-1'] }])
  })

  it('rejects a blank course name', () => {
    expect(validateCourseTitle('   ').ok).toBe(false)
  })

  it('remembers which organizer course was open', () => {
    const storage = memoryStorage()
    writeOpenOrganizerCourse(storage, 'course-9')
    expect(readOpenOrganizerCourse(storage)).toBe('course-9')
  })
})
