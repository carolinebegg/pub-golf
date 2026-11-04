import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  buildOverallLeaderboardData,
  isHoleComplete,
  LEGACY_COURSE_TITLE,
  pickActiveCourse,
  sortHolesByNumber,
  sortPlayersByName,
} from './lib/helpers'
import {
  clearRememberedJoin,
  joinExistingPlayer,
  readRememberedJoin,
  restoreVerifiedMembership,
  writeRememberedJoin,
} from './lib/join'
import TeamLogin from './components/TeamLogin'
import Landing from './components/Landing'
import OrganizerAuth from './components/OrganizerAuth'
import OrganizerHome from './components/OrganizerHome'
import { PUBLIC_TEAMS_TABLE } from './lib/teamDirectory'
import {
  clearOpenOrganizerCourse,
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
  signOutAccount,
  signUpOrganizer,
  writeOpenOrganizerCourse,
} from './lib/organizer'
import LeaderboardView from './components/LeaderboardView'
import HolesView from './components/HolesView'
import PlayersView from './components/PlayersView'
import TeamBreakdownModal from './components/TeamBreakdownModal'
import HoleDetailsModal from './components/HoleDetailsModal'
import './App.css'

const QUERY_TIMEOUT_MS = 20000

function isCoursesUnavailable(error) {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '')
  if (code === '42P01' || code === 'PGRST205') return true
  return /could not find the table.*courses|relation ["']?(public\.)?courses["']? does not exist/i.test(message)
}

function courseRows(table, courseId) {
  const query = supabase.from(table).select('*')
  return courseId ? query.eq('course_id', courseId) : query
}

function runQueryWithTimeout(queryPromise, queryName, timeoutMs = QUERY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${queryName} query timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    queryPromise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

export default function App() {
  const [holes, setHoles] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState([])
  const [kegStandEntries, setKegStandEntries] = useState([])
  const [pitcherFinishes, setPitcherFinishes] = useState([])
  const [guinnessVotes, setGuinnessVotes] = useState([])
  const [bunkerHazardEntries, setBunkerHazardEntries] = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [course, setCourse] = useState(null)

  const [membership, setMembership] = useState(null)
  const [restoringJoin, setRestoringJoin] = useState(true)
  const [joinNotice, setJoinNotice] = useState('')
  const [joinDraft, setJoinDraft] = useState(() => {
    try {
      return readRememberedJoin(localStorage)
    } catch {
      return null
    }
  })
  const membershipRef = useRef(null)
  membershipRef.current = membership
  const [activeView, setActiveView] = useState(() => {
    try {
      const stored = localStorage.getItem('pub-golf-active-view')
      return stored === 'holes' || stored === 'leaderboard' || stored === 'players' ? stored : 'leaderboard'
    } catch {
      return 'leaderboard'
    }
  })
  const [breakdownTeamId, setBreakdownTeamId] = useState(null)
  const [activeHoleId, setActiveHoleId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState('landing')
  const [authUser, setAuthUser] = useState(null)
  const [recovery, setRecovery] = useState(() => {
    try {
      return isRecoveryUrl(window.location)
    } catch {
      return false
    }
  })
  const [authMode, setAuthMode] = useState('sign-up')
  const [authNotice, setAuthNotice] = useState('')
  const [organizerCourses, setOrganizerCourses] = useState([])
  const [organizerCoursesLoading, setOrganizerCoursesLoading] = useState(false)
  const [openOrganizerCourseId, setOpenOrganizerCourseId] = useState(() => {
    try {
      return readOpenOrganizerCourse(localStorage)
    } catch {
      return null
    }
  })

  async function loadAllData({ showInitialLoader = true, courseId: requestedCourseId = null } = {}) {
    if (showInitialLoader) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError('')

    try {
      const courseResult = await runQueryWithTimeout(
        supabase.from('courses').select('*').order('created_at', { ascending: true }),
        'courses'
      )

      let activeCourse = null
      if (courseResult.error) {
        if (!isCoursesUnavailable(courseResult.error)) {
          throw new Error(courseResult.error.message || 'Failed to load courses')
        }
      } else {
        const courses = courseResult.data || []
        activeCourse = requestedCourseId
          ? courses.find((row) => row.id === requestedCourseId) || null
          : pickActiveCourse(courses)
        if (!activeCourse) {
          throw new Error(
            requestedCourseId
              ? 'That course could not be loaded.'
              : `No course found. Add ${LEGACY_COURSE_TITLE} with the courses migration.`
          )
        }
      }

      setCourse(activeCourse)
      const courseId = activeCourse?.id ?? null

      const queries = [
        { key: 'holes', required: true, promise: courseRows('holes', courseId).order('hole_number', { ascending: true }) },
        { key: 'teams', required: true, promise: courseRows(PUBLIC_TEAMS_TABLE, courseId).order('id', { ascending: true }) },
        { key: 'players', required: true, promise: courseRows('players', courseId).order('name', { ascending: true }) },
        { key: 'scores', required: true, promise: courseRows('scores', courseId) },
        { key: 'keg', required: true, promise: courseRows('keg_stand_entries', courseId) },
        { key: 'pitcher', required: true, promise: courseRows('pitcher_finishes', courseId) },
        { key: 'guinness', required: true, promise: courseRows('guinness_split_votes', courseId) },
        { key: 'bunker', required: true, promise: courseRows('bunker_hazard_entries', courseId) },
        { key: 'playerStats', required: false, promise: courseRows('player_stats', courseId) },
      ]

      const settled = await Promise.allSettled(
        queries.map((query) => runQueryWithTimeout(query.promise, query.key))
      )

      const dataByKey = {}
      const requiredErrors = []

      settled.forEach((result, index) => {
        const query = queries[index]

        if (result.status === 'rejected') {
          const message = result.reason?.message || 'Request failed'
          if (query.required) {
            requiredErrors.push(`${query.key}: ${message}`)
          } else {
            console.warn(`${query.key} load failed:`, message)
          }
          return
        }

        const { data, error: queryError } = result.value
        if (queryError) {
          const message = queryError.message || 'Request failed'
          if (query.required) {
            requiredErrors.push(`${query.key}: ${message}`)
          } else {
            console.warn(`${query.key} load failed:`, message)
          }
          return
        }

        dataByKey[query.key] = data || []
      })

      const nextHoles = dataByKey.holes || []
      const nextTeams = dataByKey.teams || []
      const nextPlayers = dataByKey.players || []
      const nextScores = dataByKey.scores || []
      const nextKeg = dataByKey.keg || []
      const nextPitcher = dataByKey.pitcher || []
      const nextGuinness = dataByKey.guinness || []
      const nextBunker = dataByKey.bunker || []
      const nextPlayerStats = dataByKey.playerStats || []

      setHoles(nextHoles)
      setTeams(nextTeams)
      setPlayers(nextPlayers)
      setScores(nextScores)
      setKegStandEntries(nextKeg)
      setPitcherFinishes(nextPitcher)
      setGuinnessVotes(nextGuinness)
      setBunkerHazardEntries(nextBunker)
      setPlayerStats(nextPlayerStats)

      if (requiredErrors.length) {
        setError(`Some data failed to load: ${requiredErrors.join(' | ')}`)
      }

      return { teams: nextTeams, failed: requiredErrors.length > 0 }
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load data')
      return { teams: [], failed: true }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function refreshData() {
    try {
      const { error: refreshError } = await supabase.rpc('refresh_player_stats')
      if (refreshError) console.warn('refresh_player_stats:', refreshError.message)
    } catch (refreshError) {
      console.warn('refresh_player_stats threw:', refreshError?.message || refreshError)
    }
    await loadAllData({
      showInitialLoader: false,
      courseId: membershipRef.current?.courseId ?? null,
    })
  }

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setAuthUser(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadTimer = window.setTimeout(() => {
      void (async () => {
        setRestoringJoin(true)
        const remembered = readRememberedJoin(localStorage)
        let nextMembership = null
        let notice = ''
        let user = null

        try {
          const sessionResult = await supabase.auth.getSession()
          user = sessionResult.data?.session?.user ?? null
          if (!cancelled) setAuthUser(user)

          if (remembered) {
            const restored = await restoreVerifiedMembership(supabase, remembered)
            if (cancelled) return
            if (restored.ok) {
              nextMembership = restored.membership
            } else if (restored.message) {
              notice = restored.message
              clearRememberedJoin(localStorage)
            }
          } else {
            clearRememberedJoin(localStorage)
          }

          if (nextMembership) {
            const loaded = await loadAllData({
              courseId: nextMembership.courseId,
            })
            if (cancelled) return
            if (
              !loaded.failed &&
              !loaded.teams.some((team) => team.id === nextMembership.teamId)
            ) {
              clearRememberedJoin(localStorage)
              nextMembership = null
              notice = 'Your team is no longer on this course.'
            }
          } else if (!cancelled) {
            setLoading(false)
          }

          if (cancelled) return
          setJoinNotice(notice)
          setMembership(nextMembership)
          setScreen(screenForSession({
            user,
            membership: nextMembership,
            recovery: isRecoveryUrl(window.location),
          }))
        } finally {
          if (!cancelled) setRestoringJoin(false)
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(loadTimer)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'organizer' || !isOrganizerAccount(authUser)) return undefined
    let cancelled = false
    setOrganizerCoursesLoading(true)
    loadOrganizerCourses(supabase, authUser.id).then((result) => {
      if (cancelled) return
      setOrganizerCourses(result.courses || [])
      setOrganizerCoursesLoading(false)
      if (!result.ok && result.message) setAuthNotice(result.message)
      const storedId = readOpenOrganizerCourse(localStorage)
      if (storedId && !(result.courses || []).some((course) => course.id === storedId)) {
        clearOpenOrganizerCourse(localStorage)
        setOpenOrganizerCourseId(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [screen, authUser])

  async function handleJoin(credentials) {
    setJoinNotice('')
    const joined = await joinExistingPlayer(supabase, credentials)
    if (!joined.ok) return joined.message || 'Could not join that team.'

    writeRememberedJoin(localStorage, credentials)
    setJoinDraft(credentials)
    const loaded = await loadAllData({
      showInitialLoader: false,
      courseId: joined.membership.courseId,
    })
    if (!loaded.failed && !loaded.teams.some((team) => team.id === joined.membership.teamId)) {
      clearRememberedJoin(localStorage)
      setMembership(null)
      return 'Your team is no longer on this course.'
    }

    setMembership(joined.membership)
    setScreen('play')
    return ''
  }

  async function handleLeave() {
    clearRememberedJoin(localStorage)
    setJoinDraft(null)
    setMembership(null)
    setJoinNotice('')
    setScreen('landing')
  }

  async function handleSignUp(input) {
    const result = await signUpOrganizer(supabase, input, {
      emailRedirectTo: window.location.origin,
    })
    if (!result.ok) return result
    if (result.needsEmailConfirmation) {
      return { ok: true, message: 'Check your email to confirm this account, then sign in.' }
    }
    if (result.user) setAuthUser(result.user)
    setAuthNotice('')
    setScreen('organizer')
    return { ok: true }
  }

  async function handleSignIn(input) {
    const result = await signInOrganizer(supabase, input)
    if (!result.ok) return result
    setAuthUser(result.user)
    setAuthNotice('')
    setRecovery(false)
    setScreen('organizer')
    return { ok: true }
  }

  async function handleResetPassword(input) {
    const result = await sendOrganizerPasswordReset(supabase, input.email, window.location.origin)
    if (!result.ok) return result
    return { ok: true, message: 'Check your email for a link to choose a new password.' }
  }

  async function handleSetPassword(input) {
    const result = await setOrganizerPassword(supabase, input.password)
    if (!result.ok) return result
    setRecovery(false)
    if (result.user) setAuthUser(result.user)
    window.history.replaceState({}, '', window.location.pathname)
    setScreen('organizer')
    return { ok: true, message: 'Password saved.' }
  }

  async function handleSignOut() {
    clearRememberedJoin(localStorage)
    clearOpenOrganizerCourse(localStorage)
    setMembership(null)
    setJoinDraft(null)
    setOpenOrganizerCourseId(null)
    setOrganizerCourses([])
    setRecovery(false)
    setAuthNotice('')
    await signOutAccount(supabase)
    setAuthUser(null)
    setScreen('landing')
  }

  async function handleCreateCourse(title) {
    const result = await createOrganizerCourse(supabase, { title, user: authUser })
    if (!result.ok) return { message: result.message }
    setOrganizerCourses((current) => [
      result.course,
      ...current.filter((course) => course.id !== result.course.id),
    ])
    setOpenOrganizerCourseId(result.course.id)
    writeOpenOrganizerCourse(localStorage, result.course.id)
    return {}
  }

  function handleOpenOrganizerCourse(courseId) {
    setOpenOrganizerCourseId(courseId)
    writeOpenOrganizerCourse(localStorage, courseId)
  }

  function handleCloseOrganizerCourse() {
    setOpenOrganizerCourseId(null)
    clearOpenOrganizerCourse(localStorage)
  }

  const loggedInTeam = useMemo(() => {
    if (!membership?.teamId) return null
    const team = teams.find((row) => row.id === membership.teamId)
    if (!team) return null
    const roster = sortPlayersByName(players.filter((player) => player.team_id === team.id))
    const player = roster.find((row) => row.id === membership.playerId)
    return {
      ...team,
      members: roster.map((row) => row.name),
      playerId: membership.playerId,
      playerName: player?.name || membership.playerName,
    }
  }, [membership, teams, players])

  const teamsWithMembers = useMemo(
    () =>
      teams.map((team) => ({
        ...team,
        members: sortPlayersByName(
          players.filter((p) => p.team_id == team.id)
        ).map((p) => p.name),
      })),
    [teams, players]
  )

  const holeDataById = useMemo(() => {
    const byId = {}

    for (const hole of holes) {
      byId[hole.id] = {
        existingScore: null,
        kegEntries: [],
        pitcherFinish: null,
        bunkerEntry:
          loggedInTeam?.id
            ? bunkerHazardEntries.find(
                (b) => b.hole_id === hole.id && b.team_id === loggedInTeam.id
              ) || null
            : null,
      }
    }

    if (loggedInTeam?.id) {
      for (const score of scores) {
        if (score.team_id === loggedInTeam.id && byId[score.hole_id]) {
          byId[score.hole_id].existingScore = score
        }
      }

      for (const entry of kegStandEntries) {
        if (entry.team_id === loggedInTeam.id && byId[entry.hole_id]) {
          byId[entry.hole_id].kegEntries.push(entry)
        }
      }

      for (const finish of pitcherFinishes) {
        if (finish.team_id === loggedInTeam.id && byId[finish.hole_id]) {
          byId[finish.hole_id].pitcherFinish = finish
        }
      }

      for (const vote of guinnessVotes) {
        if (
          vote.voting_team_id === loggedInTeam.id &&
          byId[vote.hole_id]
        ) {
          byId[vote.hole_id].guinnessVote = vote
        }
      }
    }

    return byId
  }, [holes, scores, kegStandEntries, pitcherFinishes, bunkerHazardEntries, guinnessVotes, loggedInTeam])

  const orderedHoles = useMemo(() => sortHolesByNumber(holes), [holes])

  const holeStatusById = useMemo(() => {
    const byId = {}

    if (!orderedHoles.length) {
      return byId
    }

    if (!loggedInTeam?.id) {
      for (const hole of orderedHoles) {
        byId[hole.id] = 'not-started'
      }

      return byId
    }

    let inProgressAssigned = false

    for (const hole of orderedHoles) {
      const complete = isHoleComplete(hole, holeDataById[hole.id])

      if (complete) {
        byId[hole.id] = 'completed'
      } else if (!inProgressAssigned) {
        byId[hole.id] = 'in-progress'
        inProgressAssigned = true
      } else {
        byId[hole.id] = 'not-started'
      }
    }

    return byId
  }, [orderedHoles, loggedInTeam, holeDataById])

  const overallLeaderboard = useMemo(
    () =>
      buildOverallLeaderboardData({
        teams: teamsWithMembers,
        holes,
        scores,
        kegStandEntries,
        pitcherFinishes,
        bunkerHazardEntries,
        guinnessVotes,
        players,
      }),
    [teamsWithMembers, holes, scores, kegStandEntries, pitcherFinishes, bunkerHazardEntries, guinnessVotes, players]
  )

  const loggedInTeamStanding =
    loggedInTeam?.id
      ? overallLeaderboard.find((leaderboardTeam) => leaderboardTeam.teamId === loggedInTeam.id) ||
        null
      : null

  const holeScoreById = useMemo(() => {
    const breakdown = loggedInTeamStanding?.holeBreakdown
    if (!Array.isArray(breakdown)) return {}
    const byId = {}
    for (const row of breakdown) {
      byId[row.holeId] = row.score
    }
    return byId
  }, [loggedInTeamStanding?.holeBreakdown])

  const teamPanelSummary = useMemo(() => {
    if (!loggedInTeam?.id) return null

    const totalHoles = orderedHoles.length
    const completedHoles = orderedHoles.filter(
      (hole) => holeStatusById[hole.id] === 'completed'
    ).length
    const inProgressHole =
      orderedHoles.find((hole) => holeStatusById[hole.id] === 'in-progress') || null

    const hasHoles = totalHoles > 0
    const finishedAllHoles = hasHoles && completedHoles === totalHoles
    const currentHoleName = hasHoles
      ? finishedAllHoles
        ? 'All holes complete'
        : inProgressHole?.bar_name || 'Next hole not started'
      : 'No holes yet'

    const rank =
      loggedInTeamStanding?.rank != null && Number.isFinite(loggedInTeamStanding.rank)
        ? loggedInTeamStanding.rank
        : null

    return {
      totalScore:
        loggedInTeamStanding && loggedInTeamStanding.holesCompleted > 0
          ? loggedInTeamStanding.totalScore
          : null,
      rank,
      currentHoleName,
      completedHoles,
      totalHoles,
      nextHoleId: inProgressHole?.id ?? null,
    }
  }, [loggedInTeam, orderedHoles, holeStatusById, loggedInTeamStanding])

  const selectedBreakdownTeam = useMemo(() => {
    if (!breakdownTeamId) return null

    return overallLeaderboard.find((team) => team.teamId === breakdownTeamId) || null
  }, [overallLeaderboard, breakdownTeamId])

  const selectedHole = useMemo(() => {
    if (!activeHoleId) return null

    return orderedHoles.find((hole) => hole.id === activeHoleId) || null
  }, [orderedHoles, activeHoleId])

  const selectedHoleState = useMemo(() => {
    if (!selectedHole) return null

    return (
      holeDataById[selectedHole.id] || {
        existingScore: null,
        kegEntries: [],
        pitcherFinish: null,
      }
    )
  }, [selectedHole, holeDataById])

  const selectedHoleKegEntries = useMemo(() => {
    if (!selectedHole) return []
    return kegStandEntries.filter((entry) => entry.hole_id === selectedHole.id)
  }, [selectedHole, kegStandEntries])

  const selectedHolePitcherFinishes = useMemo(() => {
    if (!selectedHole) return []
    return pitcherFinishes.filter((finish) => finish.hole_id === selectedHole.id)
  }, [selectedHole, pitcherFinishes])

  function handleSwitchView(nextView) {
    setActiveView(nextView)
    try {
      localStorage.setItem('pub-golf-active-view', nextView)
    } catch {
      // ignore storage failure
    }

    if (nextView !== 'leaderboard') {
      setBreakdownTeamId(null)
    }

    if (nextView !== 'holes') {
      setActiveHoleId(null)
    }
  }

  function handleOpenBreakdown(teamId) {
    setBreakdownTeamId(teamId)
  }

  function handleCloseBreakdown() {
    setBreakdownTeamId(null)
  }

  function handleOpenHoleDetails(holeId) {
    setActiveHoleId(holeId)
  }

  function handleCloseHoleDetails() {
    setActiveHoleId(null)
  }

  function handleEnterScore() {
    setActiveView('holes')

    if (teamPanelSummary?.nextHoleId) {
      setActiveHoleId(teamPanelSummary.nextHoleId)
    }
  }

  const openOrganizerCourse =
    organizerCourses.find((row) => row.id === openOrganizerCourseId) || null
  const organizerName = organizerFirstName(authUser)

  if (restoringJoin) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="app-card">Loading...</div>
        </div>
      </div>
    )
  }

  if (screen === 'landing') {
    return (
      <div className="app-shell">
        <div className="app-container">
          <Landing
            organizerName={isOrganizerAccount(authUser) ? organizerName : ''}
            onCreateCourse={() => {
              setAuthMode('sign-up')
              setAuthNotice('')
              setScreen('organizer')
            }}
            onJoinCourse={() => setScreen('join')}
            onOpenOrganizer={() => setScreen('organizer')}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    )
  }

  if (screen === 'organizer' && (recovery || !isOrganizerAccount(authUser))) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <OrganizerAuth
            mode={recovery ? 'recover' : authMode}
            notice={authNotice}
            onMode={setAuthMode}
            onBack={() => {
              setAuthNotice('')
              setScreen(membership ? 'play' : 'landing')
            }}
            onSignUp={handleSignUp}
            onSignIn={handleSignIn}
            onResetPassword={handleResetPassword}
            onSetPassword={handleSetPassword}
          />
        </div>
      </div>
    )
  }

  if (screen === 'organizer') {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="app-content">
            <OrganizerHome
              firstName={organizerName}
              courses={organizerCourses}
              openCourse={openOrganizerCourse}
              loading={organizerCoursesLoading}
              notice={authNotice}
              membership={membership}
              onCreate={handleCreateCourse}
              onOpen={handleOpenOrganizerCourse}
              onCloseCourse={handleCloseOrganizerCourse}
              onBackToTeam={() => setScreen('play')}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="app-content">
          <header className="app-header">
            <div>
              <h1 className="app-title">
                {screen === 'play' ? `${course?.title || LEGACY_COURSE_TITLE} ☘️` : 'Join a course'}
              </h1>
              <p className="app-subtitle">
                {screen === 'play'
                  ? course?.title === LEGACY_COURSE_TITLE || !course
                    ? 'Welcome to our very special second pub golf! Use this site to track your team scores and keep up with the overall leaderboard.'
                    : course.description || 'Track your team scores and the overall leaderboard.'
                  : 'Enter the game code, team code, and the player name already on that team.'}
              </p>
            </div>

            <div className="header-actions">
              {isOrganizerAccount(authUser) ? (
                <button type="button" className="secondary-button" onClick={() => setScreen('organizer')}>
                  Organizer courses
                </button>
              ) : null}
              {refreshing ? <div className="status-pill">Refreshing...</div> : null}
            </div>
          </header>

          <TeamLogin
            key={loggedInTeam?.playerId || 'signed-out'}
            loggedInTeam={screen === 'play' ? loggedInTeam : null}
            restoring={false}
            notice={joinNotice}
            initialJoin={joinDraft}
            onJoin={handleJoin}
            onLeave={handleLeave}
            summary={teamPanelSummary}
            onEnterScore={handleEnterScore}
            onBack={screen === 'join' ? () => setScreen('landing') : null}
          />

          {screen === 'play' ? (
          <div className="view-switch" role="tablist" aria-label="Switch between leaderboard, holes, and players">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'leaderboard'}
              className={`view-switch-button ${activeView === 'leaderboard' ? 'is-active' : ''}`}
              onClick={() => handleSwitchView('leaderboard')}
            >
              Overall Leaderboard
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'holes'}
              className={`view-switch-button ${activeView === 'holes' ? 'is-active' : ''}`}
              onClick={() => handleSwitchView('holes')}
            >
              Holes
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'players'}
              className={`view-switch-button ${activeView === 'players' ? 'is-active' : ''}`}
              onClick={() => handleSwitchView('players')}
            >
              Players
            </button>
          </div>
          ) : null}

          {screen === 'play' && loading && <div className="app-card">Loading...</div>}
          {screen === 'play' && error && <div className="app-error">{error}</div>}

          {screen === 'play' && !loading && !error && (
            <>
              {activeView === 'leaderboard' && (
                <LeaderboardView
                  teams={teamsWithMembers}
                  holes={holes}
                  scores={scores}
                  kegStandEntries={kegStandEntries}
                  pitcherFinishes={pitcherFinishes}
                  leaderboardData={overallLeaderboard}
                  guinnessVotes={guinnessVotes}
                  players={players}
                  onOpenBreakdown={handleOpenBreakdown}
                />
              )}
              {activeView === 'holes' && (
                <HolesView
                  holes={orderedHoles}
                  holeScoreById={holeScoreById}
                  onOpenHoleDetails={handleOpenHoleDetails}
                  selectedTeam={loggedInTeam}
                />
              )}
              {activeView === 'players' && (
                <PlayersView players={players} teams={teams} playerStats={playerStats} />
              )}
            </>
          )}

          <TeamBreakdownModal team={selectedBreakdownTeam} players={players} onClose={handleCloseBreakdown} />
          <HoleDetailsModal
            hole={selectedHole}
            selectedTeam={loggedInTeam}
            allTeams={teamsWithMembers}
            players={players}
            existingScore={selectedHoleState?.existingScore || null}
            pitcherFinish={selectedHoleState?.pitcherFinish || null}
            bunkerEntryForHole={selectedHoleState?.bunkerEntry ?? null}
            holeStatus={selectedHole ? holeStatusById[selectedHole.id] || 'not-started' : 'not-started'}
            kegEntriesForHole={selectedHoleKegEntries}
            pitcherFinishesForHole={selectedHolePitcherFinishes}
            guinnessVotes={guinnessVotes}
            onChanged={refreshData}
            onClose={handleCloseHoleDetails}
          />
        </div>
      </div>
    </div>
  )
}