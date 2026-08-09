import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  buildOverallLeaderboardData,
  getEffectiveHoleType,
  sortHolesByNumber,
  sortPlayersByRank,
} from './lib/helpers'
import TeamLogin, { TEAM_LOGIN_STORAGE_KEY } from './components/TeamLogin'
import LeaderboardView from './components/LeaderboardView'
import HolesView from './components/HolesView'
import PlayersView from './components/PlayersView'
import TeamBreakdownModal from './components/TeamBreakdownModal'
import HoleDetailsModal from './components/HoleDetailsModal'
import './App.css'

function isHoleComplete(hole, holeState) {
  if (!holeState) return false

  const holeType = getEffectiveHoleType(hole)

  switch (holeType) {
    case 'keg_stand':
      return Array.isArray(holeState.kegEntries) && holeState.kegEntries.length > 0
    case 'pitcher':
      return Boolean(holeState.pitcherFinish)
    case 'standard':
    default:
      if (hole.has_guinness) {
        return Boolean(holeState.guinnessVote)
      }
      return Boolean(holeState.existingScore)
  }
}

const QUERY_TIMEOUT_MS = 20000

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

  const [loggedInTeam, setLoggedInTeam] = useState(() => {
    try {
      const raw = localStorage.getItem(TEAM_LOGIN_STORAGE_KEY)
      if (!raw) return null

      const parsed = JSON.parse(raw)
      return parsed?.id ? parsed : null
    } catch {
      return null
    }
  })
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

  async function loadAllData(showInitialLoader = true) {
    if (showInitialLoader) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError('')

    try {
      const queries = [
        {
          key: 'holes',
          required: true,
          promise: supabase.from('holes').select('*').order('hole_number', { ascending: true }),
        },
        {
          key: 'teams',
          required: true,
          promise: supabase.from('teams').select('*').order('id', { ascending: true }),
        },
        {
          key: 'players',
          required: true,
          promise: supabase.from('players').select('*').order('rank', { ascending: true }),
        },
        {
          key: 'scores',
          required: true,
          promise: supabase.from('scores').select('*'),
        },
        {
          key: 'keg',
          required: true,
          promise: supabase.from('keg_stand_entries').select('*'),
        },
        {
          key: 'pitcher',
          required: true,
          promise: supabase.from('pitcher_finishes').select('*'),
        },
        {
          key: 'guinness',
          required: true,
          promise: supabase.from('guinness_split_votes').select('*'),
        },
        {
          key: 'bunker',
          required: true,
          promise: supabase.from('bunker_hazard_entries').select('*'),
        },
        {
          key: 'playerStats',
          required: false,
          promise: supabase.from('player_stats').select('*'),
        },
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

      setLoggedInTeam((current) => {
        if (!current?.id) return null

        const freshTeam = nextTeams.find((team) => team.id === current.id)
        if (!freshTeam) {
          try {
            localStorage.removeItem(TEAM_LOGIN_STORAGE_KEY)
          } catch {
            // ignore
          }
          return null
        }

        const memberNames = sortPlayersByRank(
          nextPlayers.filter((p) => p.team_id == freshTeam.id)
        ).map((p) => p.name)
        const enrichedTeam = { ...freshTeam, members: memberNames }

        try {
          localStorage.setItem(TEAM_LOGIN_STORAGE_KEY, JSON.stringify(enrichedTeam))
        } catch {
          // ignore
        }

        return enrichedTeam
      })

      if (requiredErrors.length) {
        setError(`Some data failed to load: ${requiredErrors.join(' | ')}`)
      }
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load data')
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
    await loadAllData(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadAllData()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [])

  function handleLogin(team) {
    setLoggedInTeam(team)
  }

  function handleLogout() {
    setLoggedInTeam(null)
  }

  const teamsWithMembers = useMemo(
    () =>
      teams.map((team) => ({
        ...team,
        members: sortPlayersByRank(
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

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="app-content">
          <header className="app-header">
            <div>
              <h1 className="app-title">Pub Golf: The SQL ☘️</h1>
              <p className="app-subtitle">Welcome to our very special second pub golf! Use this site to track your team scores and keep up with the overall leaderboard.</p>
            </div>

            {refreshing ? <div className="status-pill">Refreshing...</div> : null}
          </header>

          <TeamLogin
            teams={teamsWithMembers}
            loggedInTeam={loggedInTeam}
            onLogin={handleLogin}
            onLogout={handleLogout}
            summary={teamPanelSummary}
            onEnterScore={handleEnterScore}
          />

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

          {loading && <div className="app-card">Loading...</div>}
          {error && <div className="app-error">{error}</div>}

          {!loading && !error && (
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