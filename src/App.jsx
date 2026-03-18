import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  buildOverallLeaderboardData,
  getEffectiveHoleType,
  sortHolesByNumber,
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
      return Boolean(holeState.existingScore)
  }
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

    const [
      { data: holesData, error: holesError },
      { data: teamsData, error: teamsError },
      { data: playersData, error: playersError },
      { data: scoresData, error: scoresError },
      { data: kegData, error: kegError },
      { data: pitcherData, error: pitcherError },
      { data: guinnessData, error: guinnessError },
      { data: bunkerData, error: bunkerError },
    ] = await Promise.all([
      supabase.from('holes').select('*').order('hole_number', { ascending: true }),
      supabase.from('teams').select('*').order('team_number', { ascending: true }),
      supabase.from('players').select('*').order('rank', { ascending: true }),
      supabase.from('scores').select('*'),
      supabase.from('keg_stand_entries').select('*'),
      supabase.from('pitcher_finishes').select('*'),
      supabase.from('guinness_split_votes').select('*'),
      supabase.from('bunker_hazard_entries').select('*'),
    ])

    const firstError =
      holesError ||
      teamsError ||
      playersError ||
      scoresError ||
      kegError ||
      pitcherError ||
      guinnessError ||
      bunkerError

    if (firstError) {
      setError(firstError.message || 'Failed to load data')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const nextHoles = holesData || []
    const nextTeams = teamsData || []
    const nextPlayers = playersData || []
    const nextScores = scoresData || []
    const nextKeg = kegData || []
    const nextPitcher = pitcherData || []
    const nextGuinness = guinnessData || []
    const nextBunker = bunkerData || []

    setHoles(nextHoles)
    setTeams(nextTeams)
    setPlayers(nextPlayers)
    setScores(nextScores)
    setKegStandEntries(nextKeg)
    setPitcherFinishes(nextPitcher)
    setGuinnessVotes(nextGuinness)
    setBunkerHazardEntries(nextBunker)

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

      const memberNames = nextPlayers
        .filter((p) => p.team_id === freshTeam.id)
        .sort((a, b) => (Number(a.rank) ?? 0) - (Number(b.rank) ?? 0))
        .map((p) => p.name)
      const enrichedTeam = { ...freshTeam, members: memberNames }

      try {
        localStorage.setItem(TEAM_LOGIN_STORAGE_KEY, JSON.stringify(enrichedTeam))
      } catch {
        // ignore
      }

      return enrichedTeam
    })

    setLoading(false)
    setRefreshing(false)
  }

  async function refreshData() {
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
        members: players
          .filter((p) => p.team_id === team.id)
          .sort((a, b) => (Number(a.rank) ?? 0) - (Number(b.rank) ?? 0))
          .map((p) => p.name),
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
    }

    return byId
  }, [holes, scores, kegStandEntries, pitcherFinishes, bunkerHazardEntries, loggedInTeam])

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
      }),
    [teamsWithMembers, holes, scores, kegStandEntries, pitcherFinishes, bunkerHazardEntries]
  )

  const loggedInTeamStanding =
    loggedInTeam?.id
      ? overallLeaderboard.find((leaderboardTeam) => leaderboardTeam.teamId === loggedInTeam.id) ||
        null
      : null

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

    return {
      totalScore:
        loggedInTeamStanding && loggedInTeamStanding.holesCompleted > 0
          ? loggedInTeamStanding.totalScore
          : null,
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
                  holeDataById={holeDataById}
                  holeStatusById={holeStatusById}
                  onOpenHoleDetails={handleOpenHoleDetails}
                  selectedTeam={loggedInTeam}
                  players={players}
                />
              )}
              {activeView === 'players' && (
                <PlayersView players={players} teams={teams} />
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
            bunkerHazardEntries={bunkerHazardEntries}
            onChanged={refreshData}
            onClose={handleCloseHoleDetails}
          />
        </div>
      </div>
    </div>
  )
}