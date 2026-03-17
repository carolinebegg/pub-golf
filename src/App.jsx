import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { buildOverallLeaderboardData, sortHolesByNumber } from './lib/helpers'
import TeamLogin, { TEAM_LOGIN_STORAGE_KEY } from './components/TeamLogin'
import LeaderboardView from './components/LeaderboardView'
import HolesView from './components/HolesView'
import TeamBreakdownModal from './components/TeamBreakdownModal'
import HoleDetailsModal from './components/HoleDetailsModal'
import './App.css'

function isHoleComplete(holeType, holeState) {
  if (!holeState) return false

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
  const [scores, setScores] = useState([])
  const [kegStandEntries, setKegStandEntries] = useState([])
  const [pitcherFinishes, setPitcherFinishes] = useState([])

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
  const [activeView, setActiveView] = useState('leaderboard')
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
      { data: scoresData, error: scoresError },
      { data: kegData, error: kegError },
      { data: pitcherData, error: pitcherError },
    ] = await Promise.all([
      supabase.from('holes').select('*').order('hole_number', { ascending: true }),
      supabase.from('teams').select('*').order('team_number', { ascending: true }),
      supabase.from('scores').select('*'),
      supabase.from('keg_stand_entries').select('*'),
      supabase.from('pitcher_finishes').select('*'),
    ])

    const firstError =
      holesError || teamsError || scoresError || kegError || pitcherError

    if (firstError) {
      setError(firstError.message || 'Failed to load data')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const nextHoles = holesData || []
    const nextTeams = teamsData || []
    const nextScores = scoresData || []
    const nextKeg = kegData || []
    const nextPitcher = pitcherData || []

    setHoles(nextHoles)
    setTeams(nextTeams)
    setScores(nextScores)
    setKegStandEntries(nextKeg)
    setPitcherFinishes(nextPitcher)

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

      try {
        localStorage.setItem(TEAM_LOGIN_STORAGE_KEY, JSON.stringify(freshTeam))
      } catch {
        // ignore
      }

      return freshTeam
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

  const holeDataById = useMemo(() => {
    const byId = {}

    for (const hole of holes) {
      byId[hole.id] = {
        existingScore: null,
        kegEntries: [],
        pitcherFinish: null,
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
  }, [holes, scores, kegStandEntries, pitcherFinishes, loggedInTeam])

  const orderedHoles = useMemo(() => sortHolesByNumber(holes), [holes])

  const overallLeaderboard = useMemo(
    () =>
      buildOverallLeaderboardData({
        teams,
        holes,
        scores,
        kegStandEntries,
        pitcherFinishes,
      }),
    [teams, holes, scores, kegStandEntries, pitcherFinishes]
  )

  const loggedInTeamStanding =
    loggedInTeam?.id
      ? overallLeaderboard.find((leaderboardTeam) => leaderboardTeam.teamId === loggedInTeam.id) ||
        null
      : null

  const teamPanelSummary = useMemo(() => {
    if (!loggedInTeam?.id) return null

    const totalHoles = orderedHoles.length
    let completedHoles = 0
    let nextHole = null

    for (const hole of orderedHoles) {
      const complete = isHoleComplete(hole.hole_type, holeDataById[hole.id])

      if (complete) {
        completedHoles += 1
      } else if (!nextHole) {
        nextHole = hole
      }
    }

    const hasHoles = totalHoles > 0
    const finishedAllHoles = hasHoles && completedHoles === totalHoles
    const currentHoleName = hasHoles
      ? finishedAllHoles
        ? 'All holes complete'
        : nextHole?.bar_name || 'Next hole pending'
      : 'No holes yet'

    return {
      totalScore:
        loggedInTeamStanding && loggedInTeamStanding.holesCompleted > 0
          ? loggedInTeamStanding.totalScore
          : null,
      currentHoleName,
      completedHoles,
      totalHoles,
      nextHoleId: nextHole?.id ?? null,
    }
  }, [loggedInTeam, orderedHoles, holeDataById, loggedInTeamStanding])

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

  function handleSwitchView(nextView) {
    setActiveView(nextView)

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
              <h1 className="app-title">⛳ Pub Golf</h1>
              <p className="app-subtitle">Track scores, keg stands, pitcher races, and the overall leaderboard.</p>
            </div>

            {refreshing ? <div className="status-pill">Refreshing...</div> : null}
          </header>

          <TeamLogin
            teams={teams}
            loggedInTeam={loggedInTeam}
            onLogin={handleLogin}
            onLogout={handleLogout}
            summary={teamPanelSummary}
            onEnterScore={handleEnterScore}
          />

          <div className="view-switch" role="tablist" aria-label="Switch between leaderboard and holes">
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
          </div>

          {loading && <div className="app-card">Loading...</div>}
          {error && <div className="app-error">{error}</div>}

          {!loading && !error && (
            <>
              {activeView === 'leaderboard' ? (
                <LeaderboardView
                  teams={teams}
                  holes={holes}
                  scores={scores}
                  kegStandEntries={kegStandEntries}
                  pitcherFinishes={pitcherFinishes}
                  leaderboardData={overallLeaderboard}
                  onOpenBreakdown={handleOpenBreakdown}
                />
              ) : (
                <HolesView
                  holes={orderedHoles}
                  holeDataById={holeDataById}
                  onOpenHoleDetails={handleOpenHoleDetails}
                  selectedTeam={loggedInTeam}
                />
              )}
            </>
          )}

          <TeamBreakdownModal team={selectedBreakdownTeam} onClose={handleCloseBreakdown} />
          <HoleDetailsModal
            hole={selectedHole}
            selectedTeam={loggedInTeam}
            allTeams={teams}
            existingScore={selectedHoleState?.existingScore || null}
            kegEntries={selectedHoleState?.kegEntries || []}
            pitcherFinish={selectedHoleState?.pitcherFinish || null}
            onChanged={refreshData}
            onClose={handleCloseHoleDetails}
          />
        </div>
      </div>
    </div>
  )
}