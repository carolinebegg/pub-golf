import { describe, expect, it } from 'vitest'
import { PUBLIC_TEAMS_TABLE } from './teamDirectory'

describe('public team directory', () => {
  it('does not read team join codes from the teams table', () => {
    expect(PUBLIC_TEAMS_TABLE).toBe('teams_public')
    expect(PUBLIC_TEAMS_TABLE).not.toMatch(/join_code/)
  })
})
