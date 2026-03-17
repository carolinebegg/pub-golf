import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { buildOverallLeaderboardData, sortHolesByNumber } from './lib/helpers'
import TeamLogin, { TEAM_LOGIN_STORAGE_KEY } from './components/TeamLogin'
import HoleCard from './components/HoleCard'
import OverallLeaderboard from './components/OverallLeaderboard'
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
  const [expandedHoleId, setExpandedHoleId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const holesSectionRef = useRef(null)

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
    const currentHoleLabel = hasHoles
      ? finishedAllHoles
        ? `All ${totalHoles} holes complete`
        : `Hole ${nextHole?.hole_number ?? orderedHoles[0]?.hole_number ?? 1} / ${totalHoles}`
      : 'No holes yet'

    return {
      totalScore:
        loggedInTeamStanding && loggedInTeamStanding.holesCompleted > 0
          ? loggedInTeamStanding.totalScore
          : null,
      currentHoleLabel,
      completedHoles,
      totalHoles,
      nextHoleId: nextHole?.id ?? null,
    }
  }, [loggedInTeam, orderedHoles, holeDataById, loggedInTeamStanding])

  function handleEnterScore() {
    if (teamPanelSummary?.nextHoleId) {
      setExpandedHoleId(teamPanelSummary.nextHoleId)
    }

    holesSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
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

          {loading && <div className="app-card">Loading...</div>}
          {error && <div className="app-error">{error}</div>}

          {!loading && !error && (
            <>
              <OverallLeaderboard
                teams={teams}
                holes={holes}
                scores={scores}
                kegStandEntries={kegStandEntries}
                pitcherFinishes={pitcherFinishes}
                leaderboardData={overallLeaderboard}
              />

              <section className="section-stack" id="holes-section" ref={holesSectionRef}>
                <div className="section-header">
                  <h2>Holes</h2>
                </div>

                <div className="hole-list">
                  {orderedHoles.map((hole) => {
                    const holeState = holeDataById[hole.id] || {
                      existingScore: null,
                      kegEntries: [],
                      pitcherFinish: null,
                    }

                    return (
                      <HoleCard
                        key={hole.id}
                        hole={hole}
                        isExpanded={expandedHoleId === hole.id}
                        onToggle={() =>
                          setExpandedHoleId((current) => (current === hole.id ? null : hole.id))
                        }
                        selectedTeam={loggedInTeam}
                        allTeams={teams}
                        existingScore={holeState.existingScore}
                        kegEntries={holeState.kegEntries}
                        pitcherFinish={holeState.pitcherFinish}
                        onChanged={refreshData}
                      />
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}