import { isAnonymousUser } from './join'

export const OPEN_ORGANIZER_COURSE_KEY = 'pub-golf-organizer-course'
const PLACEHOLDER_JOIN_CODE = 'pending'
const COURSE_TITLE_LIMIT = 80

const AUTH_MESSAGES = [
  ['Invalid login credentials', 'That email or password does not match an organizer account.'],
  ['Email not confirmed', 'Confirm your email, then sign in.'],
  ['User already registered', 'An account with that email already exists. Sign in instead.'],
  ['already been registered', 'An account with that email already exists. Sign in instead.'],
  ['Password should be at least', 'Use a password of at least 6 characters.'],
  ['signup_disabled', 'New organizer accounts are turned off in Supabase right now.'],
  ['Sign in with an organizer account', 'Sign in with an organizer account before creating a course.'],
  ['row-level security', 'Sign in with an organizer account before creating a course.'],
  ['A course name is required', 'Enter a course name.'],
  ['80 characters', 'Course name must be 80 characters or fewer.'],
  ['courses_join_code_unique', 'That game code was already used. Create the course again.'],
  ['duplicate key', 'That game code was already used. Create the course again.'],
]

export function isOrganizerAccount(user) {
  return Boolean(user?.id) && !isAnonymousUser(user)
}

export function organizerFirstName(user) {
  const metadata = user?.user_metadata || {}
  return String(metadata.first_name || metadata.display_name || '').trim()
}

export function isRecoveryUrl(locationLike) {
  const hash = String(locationLike?.hash || '')
  const search = String(locationLike?.search || '')
  return /(?:^|[?#&])type=recovery(?:&|$)/.test(`${hash}${search}`)
}

export function screenForSession({ user = null, membership = null, recovery = false } = {}) {
  if (recovery) return 'organizer'
  if (membership?.courseId) return 'play'
  if (isOrganizerAccount(user)) return 'organizer'
  return 'landing'
}

export function messageForAuthError(error) {
  const raw = String(error?.message || error || '')
  for (const [needle, message] of AUTH_MESSAGES) {
    if (raw.includes(needle)) return message
  }
  return raw || 'Something went wrong. Try again.'
}

function cleanPersonName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function validateOrganizerSignup({ firstName, email, password } = {}) {
  const name = cleanPersonName(firstName)
  const cleanedEmail = String(email || '').trim()
  if (!name) return { ok: false, message: 'Enter your first name.' }
  if (name.length > 40 || name.includes('@')) {
    return { ok: false, message: 'Enter a first name of 40 characters or fewer.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  if (String(password || '').length < 6) {
    return { ok: false, message: 'Use a password of at least 6 characters.' }
  }
  return { ok: true, firstName: name, email: cleanedEmail, password }
}

export function validateOrganizerSignIn({ email, password } = {}) {
  const cleanedEmail = String(email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  if (!password) return { ok: false, message: 'Enter your password.' }
  return { ok: true, email: cleanedEmail, password }
}

export function validateCourseTitle(title) {
  const cleaned = cleanPersonName(title)
  if (!cleaned) return { ok: false, message: 'Enter a course name.', title: '' }
  if (cleaned.length > COURSE_TITLE_LIMIT) {
    return { ok: false, message: 'Course name must be 80 characters or fewer.', title: cleaned }
  }
  return { ok: true, message: '', title: cleaned }
}

function accountMetadata(firstName) {
  return { first_name: firstName, display_name: firstName }
}

export async function signUpOrganizer(client, input, { emailRedirectTo } = {}) {
  const validated = validateOrganizerSignup(input)
  if (!validated.ok) return validated

  const metadata = accountMetadata(validated.firstName)
  const existing = await client.auth.getSession()
  const currentUser = existing.data?.session?.user ?? null

  if (isOrganizerAccount(currentUser)) {
    return { ok: true, user: currentUser, alreadySignedIn: true }
  }

  if (currentUser && isAnonymousUser(currentUser)) {
    const updated = await client.auth.updateUser({
      email: validated.email,
      password: validated.password,
      data: metadata,
    })
    if (updated.error) return { ok: false, message: messageForAuthError(updated.error) }
    const user = updated.data?.user ?? null
    return {
      ok: true,
      user,
      needsEmailConfirmation: !isOrganizerAccount(user),
    }
  }

  const signedUp = await client.auth.signUp({
    email: validated.email,
    password: validated.password,
    options: {
      data: metadata,
      emailRedirectTo,
    },
  })
  if (signedUp.error) return { ok: false, message: messageForAuthError(signedUp.error) }

  return {
    ok: true,
    user: signedUp.data?.user ?? null,
    needsEmailConfirmation: !signedUp.data?.session,
  }
}

export async function signInOrganizer(client, input) {
  const validated = validateOrganizerSignIn(input)
  if (!validated.ok) return validated

  const signedIn = await client.auth.signInWithPassword({
    email: validated.email,
    password: validated.password,
  })
  if (signedIn.error) return { ok: false, message: messageForAuthError(signedIn.error) }

  const user = signedIn.data?.user ?? null
  if (!isOrganizerAccount(user)) {
    return { ok: false, message: 'That account cannot create courses.' }
  }
  return { ok: true, user }
}

export async function sendOrganizerPasswordReset(client, email, redirectTo) {
  const cleanedEmail = String(email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  const result = await client.auth.resetPasswordForEmail(cleanedEmail, { redirectTo })
  if (result.error) return { ok: false, message: messageForAuthError(result.error) }
  return { ok: true }
}

export async function setOrganizerPassword(client, password) {
  if (String(password || '').length < 6) {
    return { ok: false, message: 'Use a password of at least 6 characters.' }
  }
  const result = await client.auth.updateUser({ password })
  if (result.error) return { ok: false, message: messageForAuthError(result.error) }
  const user = result.data?.user ?? null
  if (!isOrganizerAccount(user)) {
    return { ok: false, message: 'Sign in with an organizer account before continuing.' }
  }
  return { ok: true, user }
}

export async function signOutAccount(client) {
  const result = await client.auth.signOut()
  if (result?.error) return { ok: false, message: messageForAuthError(result.error) }
  return { ok: true }
}

export function readOpenOrganizerCourse(storage) {
  try {
    const value = storage.getItem(OPEN_ORGANIZER_COURSE_KEY)
    return value || null
  } catch {
    return null
  }
}

export function writeOpenOrganizerCourse(storage, courseId) {
  if (!courseId) return
  storage.setItem(OPEN_ORGANIZER_COURSE_KEY, String(courseId))
}

export function clearOpenOrganizerCourse(storage) {
  storage.removeItem(OPEN_ORGANIZER_COURSE_KEY)
}

export async function loadOrganizerCourses(client, userId) {
  if (!userId) return { ok: false, courses: [], message: 'Sign in before loading courses.' }
  const { data, error } = await client
    .from('courses')
    .select('id, title, join_code, organizer_name, organizer_id, created_at')
    .eq('organizer_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, courses: [], message: messageForAuthError(error) }
  return { ok: true, courses: data || [] }
}

export async function createOrganizerCourse(client, { title, user } = {}) {
  if (!isOrganizerAccount(user)) {
    return { ok: false, message: 'Sign in with an organizer account before creating a course.' }
  }

  const validated = validateCourseTitle(title)
  if (!validated.ok) return { ok: false, message: validated.message }

  const { data, error } = await client
    .from('courses')
    .insert({
      title: validated.title,
      organizer_id: user.id,
      join_code: PLACEHOLDER_JOIN_CODE,
    })
    .select('id, title, join_code, organizer_name, organizer_id, created_at')
    .single()

  if (error) return { ok: false, message: messageForAuthError(error) }
  if (!data?.id || data.organizer_id !== user.id) {
    return { ok: false, message: 'The course could not be created. Try again.' }
  }

  if (!data.join_code || data.join_code === PLACEHOLDER_JOIN_CODE) {
    await client.from('courses').delete().eq('id', data.id)
    return {
      ok: false,
      message: 'Course creation is not ready yet. Apply the latest database migration, then try again.',
    }
  }

  return { ok: true, course: data }
}
