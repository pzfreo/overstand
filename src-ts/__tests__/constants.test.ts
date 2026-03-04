import { EPSILON } from '../constants'

describe('constants', () => {
  it('exports EPSILON', () => {
    expect(EPSILON).toBe(1e-10)
  })
})
