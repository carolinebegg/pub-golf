import { describe, expect, it } from 'vitest'
import {
  buildKegStandTeamLeaderboard,
  buildOverallLeaderboardData,
  buildPitcherLeaderboard,
  calculateStandardHoleScore,
  getEffectiveHoleType,
  getGuinnessHoleVoteTeamEffects,
  isHoleComplete,
  validateSplitGVote,
} from './helpers'

describe('normal and bunker scores', () => {
  it('scores 1 sip and a -5 karaoke bonus as -4, even when the drink is Guinness', () => {
    expect(
      calculateStandardHoleScore({
        sips: 1,
        is_guinness: true,
        bonus_penalty: -5,
      }),
    ).toBe(-4)
  })

  it('uses sips as the base and does not floor the result', () => {
    expect(calculateStandardHoleScore({ sips: 1 })).toBe(1)
    expect(calculateStandardHoleScore({ sips: 3, split_g_bonus: 1 })).toBe(2)
    expect(calculateStandardHoleScore({ sips: 4, water_violated: true })).toBe(7)
    expect(calculateStandardHoleScore({ sips: 1, bonus_penalty: -2 })).toBe(-1)
  })

  it('adds 3 for an incomplete bunker and nothing when the bunker is done', () => {
    expect(calculateStandardHoleScore({ sips: 1 }, { bunkerIncomplete: true })).toBe(4)
    expect(
      calculateStandardHoleScore({ sips: 1, bonus_penalty: -5 }, { bunkerIncomplete: true }),
    ).toBe(-1)
    expect(calculateStandardHoleScore({ sips: 1 }, { bunkerIncomplete: false })).toBe(1)
  })
})

describe('keg stand ranking', () => {
  it('gives tied first place 0 and skips to 2', () => {
    const ranked = buildKegStandTeamLeaderboard([
      { team_id: 'a', seconds: 10 },
      { team_id: 'b', seconds: 10 },
      { team_id: 'c', seconds: 4 },
    ])

    expect(ranked.map((row) => [row.team_id, row.rankScore])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 2],
    ])
  })

  it('treats averages within one hundredth of a second as a tie', () => {
    const ranked = buildKegStandTeamLeaderboard([
      { team_id: 'a', seconds: 10.004 },
      { team_id: 'b', seconds: 9.996 },
    ])

    expect(ranked.every((row) => row.rankScore === 0)).toBe(true)
  })
})

describe('pitcher ranking', () => {
  it('ranks earlier finish timestamps first and skips after a tie', () => {
    const ranked = buildPitcherLeaderboard([
      { team_id: 'slow', finished_at: '2026-03-17T20:00:02.000Z' },
      { team_id: 'fast-a', finished_at: '2026-03-17T20:00:00.000Z' },
      { team_id: 'fast-b', finished_at: '2026-03-17T20:00:00.000Z' },
    ])

    expect(ranked.map((row) => [row.team_id, row.rankScore])).toEqual([
      ['fast-a', 0],
      ['fast-b', 0],
      ['slow', 2],
    ])
  })
})

describe('Split the G', () => {
  const players = [
    { id: 'p1', team_id: 'a' },
    { id: 'p2', team_id: 'b' },
  ]

  it('rejects a vote for the voting team', () => {
    expect(
      validateSplitGVote({
        votingTeamId: 'a',
        bestPlayer: players[0],
        worstPlayer: null,
      }),
    ).toMatch(/own team/)
  })

  it('awards -3 and +3, including ties, using the team stored on the vote', () => {
    const effects = getGuinnessHoleVoteTeamEffects(
      'hole',
      [
        {
          hole_id: 'hole',
          voting_team_id: 'a',
          best_voted_player_id: 'p2',
          best_voted_team_id: 'b',
          worst_voted_player_id: 'p1',
          worst_voted_team_id: 'old-a',
        },
        {
          hole_id: 'hole',
          voting_team_id: 'c',
          best_voted_player_id: 'p2',
          best_voted_team_id: 'b',
        },
      ],
      players,
    )

    expect([...effects.bestTeams]).toEqual(['b'])
    expect([...effects.worstTeams]).toEqual(['old-a'])
  })

  it('keeps a stored team award after the named player is gone', () => {
    const effects = getGuinnessHoleVoteTeamEffects(
      'hole',
      [
        {
          hole_id: 'hole',
          voting_team_id: 'a',
          best_voted_player_id: null,
          best_voted_team_id: 'b',
          worst_voted_player_id: null,
          worst_voted_team_id: 'old-a',
        },
      ],
      players,
    )

    expect([...effects.bestTeams]).toEqual(['b'])
    expect([...effects.worstTeams]).toEqual(['old-a'])
  })

  it('does not add a received award to the total until that team votes', () => {
    const board = buildOverallLeaderboardData({
      teams: [
        { id: 'a', theme: 'Alpha' },
        { id: 'b', theme: 'Beta' },
      ],
      holes: [{ id: 'g', hole_number: 4, has_guinness: true, bar_name: 'Fado' }],
      guinnessVotes: [
        {
          hole_id: 'g',
          voting_team_id: 'a',
          best_voted_player_id: 'p2',
          best_voted_team_id: 'b',
        },
      ],
      players,
    })

    const alpha = board.find((row) => row.teamId === 'a')
    const beta = board.find((row) => row.teamId === 'b')

    expect(alpha.holesCompleted).toBe(1)
    expect(alpha.totalScore).toBe(0)
    expect(beta.holesCompleted).toBe(0)
    expect(beta.totalScore).toBe(0)
    expect(beta.rank).toBeNull()
  })
})

describe('bunker penalty on the leaderboard', () => {
  it('does not add a bunker penalty to a normal hole', () => {
    const board = buildOverallLeaderboardData({
      teams: [{ id: 'a', theme: 'Alpha' }],
      holes: [{ id: 'normal', hole_number: 3, bar_name: 'Tir Na Nog' }],
      scores: [{ team_id: 'a', hole_id: 'normal', sips: 1 }],
    })

    expect(board[0].holeBreakdown[0].score).toBe(1)
    expect(board[0].totalScore).toBe(1)
  })

  it('adds exactly 3 once when a bunker hole has no bunker entry', () => {
    const board = buildOverallLeaderboardData({
      teams: [{ id: 'a', theme: 'Alpha' }],
      holes: [{ id: 'bunker', hole_number: 5, bar_name: 'Black Sheep', has_bunker: true }],
      scores: [{ team_id: 'a', hole_id: 'bunker', sips: 1 }],
      bunkerHazardEntries: [],
    })

    expect(board[0].holeBreakdown[0].score).toBe(4)
    expect(board[0].totalScore).toBe(4)
  })

  it('leaves the sip score unchanged once the bunker entry exists', () => {
    const board = buildOverallLeaderboardData({
      teams: [{ id: 'a', theme: 'Alpha' }],
      holes: [{ id: 'bunker', hole_number: 5, bar_name: 'Black Sheep', has_bunker: true }],
      scores: [{ team_id: 'a', hole_id: 'bunker', sips: 1, bonus_penalty: -5 }],
      bunkerHazardEntries: [{ hole_id: 'bunker', team_id: 'a' }],
    })

    expect(board[0].holeBreakdown[0].score).toBe(-4)
    expect(board[0].totalScore).toBe(-4)
  })
})

describe('leaderboard order', () => {
  const holes = [
    { id: 'h1', hole_number: 3, bar_name: 'One' },
    { id: 'h2', hole_number: 4, bar_name: 'Two' },
  ]

  it('keeps a negative hole score in the team total', () => {
    const board = buildOverallLeaderboardData({
      teams: [{ id: 'a', theme: 'Alpha' }],
      holes: [{ id: 'h1', hole_number: 3, bar_name: 'One' }],
      scores: [{ team_id: 'a', hole_id: 'h1', sips: 1, is_guinness: true, bonus_penalty: -5 }],
    })

    expect(board[0].totalScore).toBe(-4)
  })

  it('ranks more completed holes ahead of a lower score', () => {
    const board = buildOverallLeaderboardData({
      teams: [
        { id: 'many', theme: 'Many' },
        { id: 'low', theme: 'Low' },
      ],
      holes,
      scores: [
        { team_id: 'many', hole_id: 'h1', sips: 5 },
        { team_id: 'many', hole_id: 'h2', sips: 5 },
        { team_id: 'low', hole_id: 'h1', sips: 1 },
      ],
    })

    expect(board.map((row) => [row.teamId, row.rank, row.totalScore])).toEqual([
      ['many', 1, 10],
      ['low', 2, 1],
    ])
  })

  it('shares a rank and skips the next place', () => {
    const board = buildOverallLeaderboardData({
      teams: [
        { id: 'a', theme: 'Alpha' },
        { id: 'b', theme: 'Beta' },
        { id: 'c', theme: 'Croc' },
      ],
      holes: [{ id: 'h1', hole_number: 3, bar_name: 'One' }],
      scores: [
        { team_id: 'a', hole_id: 'h1', sips: 4 },
        { team_id: 'b', hole_id: 'h1', sips: 4 },
        { team_id: 'c', hole_id: 'h1', sips: 9 },
      ],
    })

    expect(board.map((row) => [row.teamId, row.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ])
  })
})

describe('hole type', () => {
  it('follows the stored type, including a normal hole 2 and pitcher races on 1 and 9', () => {
    expect(getEffectiveHoleType({
      hole_number: 2,
      primary_type: 'normal',
      hole_type: 'standard',
    })).toBe('standard')
    expect(getEffectiveHoleType({
      hole_number: 1,
      primary_type: 'pitcher_kill',
      hole_type: 'pitcher_race',
    })).toBe('pitcher')
    expect(getEffectiveHoleType({
      hole_number: 9,
      primary_type: 'pitcher_kill',
      hole_type: 'pitcher_race',
    })).toBe('pitcher')
    expect(getEffectiveHoleType({
      hole_number: 1,
      primary_type: 'keg_stand',
      hole_type: 'keg_stand',
    })).toBe('keg_stand')
    expect(getEffectiveHoleType({ hole_number: 2 })).toBe('pitcher')
    expect(getEffectiveHoleType({ hole_number: 9 })).toBe('pitcher')
  })

  it('scores a normal hole 2 from sips and a pitcher hole 1 from finish order', () => {
    const board = buildOverallLeaderboardData({
      teams: [
        { id: 'a', theme: 'Red' },
        { id: 'b', theme: 'Pink' },
      ],
      holes: [
        {
          id: 'h1',
          hole_number: 1,
          bar_name: "Freddy's Bar",
          primary_type: 'pitcher_kill',
          hole_type: 'pitcher_race',
        },
        {
          id: 'h2',
          hole_number: 2,
          bar_name: 'Buttermilk Bar',
          primary_type: 'normal',
          hole_type: 'standard',
        },
      ],
      scores: [{ team_id: 'a', hole_id: 'h2', sips: 2 }],
      pitcherFinishes: [
        { team_id: 'b', hole_id: 'h1', finished_at: '2026-11-04T22:00:00Z' },
        { team_id: 'a', hole_id: 'h1', finished_at: '2026-11-04T22:05:00Z' },
      ],
    })

    expect(board.map((row) => [row.teamId, row.holesCompleted, row.totalScore])).toEqual([
      ['a', 2, 3],
      ['b', 1, 0],
    ])
  })
})

describe('hole completion', () => {
  it('follows the primary result for each current hole kind', () => {
    expect(isHoleComplete({ hole_number: 3 }, { existingScore: { sips: 1 } })).toBe(true)
    expect(isHoleComplete({ hole_number: 3 }, {})).toBe(false)
    expect(
      isHoleComplete({ hole_number: 1, hole_type: 'keg_stand' }, { kegEntries: [{ seconds: 2 }] }),
    ).toBe(true)
    expect(isHoleComplete({ hole_number: 4, hole_type: 'pitcher' }, { pitcherFinish: { finished_at: 't' } })).toBe(
      true,
    )
    expect(isHoleComplete({ hole_number: 6, has_guinness: true }, { guinnessVote: { id: 'v' } })).toBe(true)
    expect(isHoleComplete({ hole_number: 6, has_guinness: true }, {})).toBe(false)
  })
})
