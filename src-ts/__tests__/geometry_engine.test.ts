/**
 * TypeScript port of tests/test_geometry_engine.py
 *
 * All 60 Python tests ported to Vitest.
 */

import {
  calculateSagitta,
  calculateFingerboardThickness,
  calculateFingerboardThicknessAtFret,
  calculateStringAnglesViolin,
  calculateStringAnglesGuitar,
  calculateNeckGeometry,
  calculateFingerboardGeometry,
  calculateStringHeightAndDimensions,
  calculateFretPositions,
  calculateViolBackBreak,
  evaluateCubicBezier,
  findBezierTForY,
  calculateBlendCurve,
  calculateCrossSectionGeometry,
} from '../geometry_engine'

// ---------------------------------------------------------------------------
// TestCalculateSagitta
// ---------------------------------------------------------------------------

describe('calculateSagitta', () => {
  it('zero radius returns zero', () => {
    expect(calculateSagitta(0, 10)).toBe(0.0)
  })

  it('zero width returns zero', () => {
    expect(calculateSagitta(100, 0)).toBe(0.0)
  })

  it('negative values return zero', () => {
    expect(calculateSagitta(-100, 10)).toBe(0.0)
    expect(calculateSagitta(100, -10)).toBe(0.0)
  })

  it('known values', () => {
    // For radius=100, width=20: sagitta = 100 - sqrt(10000 - 100) ≈ 0.501
    const result = calculateSagitta(100, 20)
    expect(Math.abs(result - 0.501)).toBeLessThan(0.01)
  })

  it('wide chord approximation', () => {
    // half_width (15) > radius (10): uses width^2 / (8 * radius)
    const result = calculateSagitta(10, 30)
    const expected = (30 ** 2) / (8.0 * 10) // = 11.25
    expect(Math.abs(result - expected)).toBeLessThan(0.001)
  })

  it('typical violin fingerboard', () => {
    // Violin: radius ~41mm, width at nut ~24mm
    const result = calculateSagitta(41, 24)
    expect(result).toBeGreaterThan(0.5)
    expect(result).toBeLessThan(5.0)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateFingerboardThickness
// ---------------------------------------------------------------------------

describe('calculateFingerboardThickness', () => {
  it('returns expected keys', () => {
    const params = {
      fingerboard_radius: 41,
      fb_visible_height_at_nut: 4.0,
      fb_visible_height_at_join: 6.0,
      fingerboard_width_at_nut: 24,
      fingerboard_width_at_end: 30,
    }
    const result = calculateFingerboardThickness(params)
    expect('sagitta_at_nut' in result).toBe(true)
    expect('sagitta_at_join' in result).toBe(true)
    expect('fb_thickness_at_nut' in result).toBe(true)
    expect('fb_thickness_at_join' in result).toBe(true)
  })

  it('thickness includes sagitta', () => {
    const params = {
      fingerboard_radius: 41,
      fb_visible_height_at_nut: 4.0,
      fb_visible_height_at_join: 6.0,
      fingerboard_width_at_nut: 24,
      fingerboard_width_at_end: 30,
    }
    const result = calculateFingerboardThickness(params)

    const expectedNut = 4.0 + result.sagitta_at_nut
    const expectedJoin = 6.0 + result.sagitta_at_join

    expect(Math.abs(result.fb_thickness_at_nut - expectedNut)).toBeLessThan(0.001)
    expect(Math.abs(result.fb_thickness_at_join - expectedJoin)).toBeLessThan(0.001)
  })

  it('uses defaults for missing params', () => {
    const result = calculateFingerboardThickness({})
    expect(result.sagitta_at_nut).toBeGreaterThanOrEqual(0)
    expect(result.fb_thickness_at_nut).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateStringAnglesViolin
// ---------------------------------------------------------------------------

describe('calculateStringAnglesViolin', () => {
  const params = {
    body_stop: 195,
    arching_height: 15,
    bridge_height: 33,
    overstand: 12,
    string_height_nut: 0.6,
    string_height_eof: 4.0,
    fingerboard_length: 270,
  }

  it('returns expected keys', () => {
    const result = calculateStringAnglesViolin(params, 325, 7.5)
    expect('body_stop' in result).toBe(true)
    expect('neck_stop' in result).toBe(true)
    expect('string_angle_to_ribs' in result).toBe(true)
    expect('string_angle_to_fb' in result).toBe(true)
    expect('string_angle_to_fingerboard' in result).toBe(true)
  })

  it('angles are reasonable', () => {
    const result = calculateStringAnglesViolin(params, 325, 7.5)
    expect(result.string_angle_to_ribs).toBeGreaterThan(0)
    expect(result.string_angle_to_ribs).toBeLessThan(20)
  })

  it('neck stop is positive', () => {
    const result = calculateStringAnglesViolin(params, 325, 7.5)
    expect(result.neck_stop).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateStringAnglesGuitar
// ---------------------------------------------------------------------------

describe('calculateStringAnglesGuitar', () => {
  const params = {
    fret_join: 12,
    string_height_nut: 0.6,
    string_height_12th_fret: 4.0,
    arching_height: 10,
    bridge_height: 12,
    overstand: 6,
  }
  const fretPositions = calculateFretPositions(650, 14)

  it('returns expected keys', () => {
    const result = calculateStringAnglesGuitar(params, 650, fretPositions, 8.0)
    expect('body_stop' in result).toBe(true)
    expect('neck_stop' in result).toBe(true)
    expect('string_angle_to_ribs' in result).toBe(true)
  })

  it('calculates body stop', () => {
    const result = calculateStringAnglesGuitar(params, 650, fretPositions, 8.0)
    expect(result.body_stop).toBeGreaterThan(0)
    expect(result.body_stop).toBeLessThan(650)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateNeckGeometry
// ---------------------------------------------------------------------------

describe('calculateNeckGeometry', () => {
  const params = {
    arching_height: 15,
    bridge_height: 33,
    overstand: 12,
    string_height_nut: 0.6,
    body_stop: 195,
  }

  it('returns expected keys', () => {
    const result = calculateNeckGeometry(
      params, 325, 130, 0.05, 0.5, 5.5, 7.5
    )
    expect('neck_angle' in result).toBe(true)
    expect('neck_stop' in result).toBe(true)
    expect('neck_angle_rad' in result).toBe(true)
    expect('neck_end_x' in result).toBe(true)
    expect('neck_end_y' in result).toBe(true)
    expect('string_length' in result).toBe(true)
    expect('nut_relative_to_ribs' in result).toBe(true)
  })

  it('neck angle in reasonable range', () => {
    const result = calculateNeckGeometry(
      params, 325, 130, 0.05, 0.5, 5.5, 7.5
    )
    expect(result.neck_angle).toBeGreaterThan(70)
    expect(result.neck_angle).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateFingerboardGeometry
// ---------------------------------------------------------------------------

describe('calculateFingerboardGeometry', () => {
  it('returns expected keys', () => {
    const params = { fingerboard_length: 270 }
    const result = calculateFingerboardGeometry(
      params, 130, -125, 10, -0.1, 5.5, 7.5
    )
    expect('fb_direction_angle' in result).toBe(true)
    expect('fb_bottom_end_x' in result).toBe(true)
    expect('fb_bottom_end_y' in result).toBe(true)
    expect('fb_thickness_at_end' in result).toBe(true)
  })

  it('direction angle is opposite neck', () => {
    const params = { fingerboard_length: 270 }
    const neckLineAngle = -0.1
    const result = calculateFingerboardGeometry(
      params, 130, -125, 10, neckLineAngle, 5.5, 7.5
    )
    const expected = neckLineAngle + Math.PI
    expect(Math.abs(result.fb_direction_angle - expected)).toBeLessThan(0.001)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateFretPositions
// ---------------------------------------------------------------------------

describe('calculateFretPositions', () => {
  it('returns correct count', () => {
    const result = calculateFretPositions(325, 7)
    expect(result.length).toBe(7)
  })

  it('frets are increasing', () => {
    const result = calculateFretPositions(325, 12)
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThan(result[i - 1]!)
    }
  })

  it('12th fret is half length', () => {
    const vsl = 650
    const result = calculateFretPositions(vsl, 12)
    expect(Math.abs(result[11]! - vsl / 2)).toBeLessThan(0.001)
  })

  it('empty for zero frets', () => {
    const result = calculateFretPositions(325, 0)
    expect(result).toEqual([])
  })

  it('known fret ratios', () => {
    const vsl = 1000
    const result = calculateFretPositions(vsl, 12)
    const expectedFirst = vsl - vsl / (2 ** (1 / 12))
    expect(Math.abs(result[0]! - expectedFirst)).toBeLessThan(0.001)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateFingerboardThicknessAtFret
// ---------------------------------------------------------------------------

describe('calculateFingerboardThicknessAtFret', () => {
  function violinParams() {
    return {
      vsl: 330,
      fingerboard_length: 270,
      fingerboard_radius: 41,
      fb_visible_height_at_nut: 4.0,
      fb_visible_height_at_join: 6.0,
      fingerboard_width_at_nut: 24,
      fingerboard_width_at_end: 40,
    }
  }

  it('returns expected keys', () => {
    const result = calculateFingerboardThicknessAtFret(violinParams(), 1)
    expect('fret_distance_from_nut' in result).toBe(true)
    expect('position_ratio' in result).toBe(true)
    expect('fb_thickness_at_fret' in result).toBe(true)
  })

  it('fret 1 close to nut', () => {
    const params = violinParams()
    const result = calculateFingerboardThicknessAtFret(params, 1)
    const fb = calculateFingerboardThickness(params)
    expect(result.fb_thickness_at_fret).toBeGreaterThan(fb.fb_thickness_at_nut)
    expect(result.fb_thickness_at_fret).toBeLessThan(fb.fb_thickness_at_join)
    expect(result.position_ratio).toBeLessThan(0.1)
  })

  it('position ratio increases with fret', () => {
    const params = violinParams()
    const r1 = calculateFingerboardThicknessAtFret(params, 1)
    const r7 = calculateFingerboardThicknessAtFret(params, 7)
    const r12 = calculateFingerboardThicknessAtFret(params, 12)
    expect(r1.position_ratio).toBeLessThan(r7.position_ratio)
    expect(r7.position_ratio).toBeLessThan(r12.position_ratio)
  })

  it('thickness increases with fret', () => {
    const params = violinParams()
    const t1 = calculateFingerboardThicknessAtFret(params, 1).fb_thickness_at_fret
    const t12 = calculateFingerboardThicknessAtFret(params, 12).fb_thickness_at_fret
    expect(t12).toBeGreaterThan(t1)
  })

  it('fret distance uses equal temperament', () => {
    const params = violinParams()
    const vsl = params.vsl
    const result = calculateFingerboardThicknessAtFret(params, 12)
    const expected = calculateFretPositions(vsl, 12)[11]!
    expect(Math.abs(result.fret_distance_from_nut - expected)).toBeLessThan(0.001)
  })

  it('position ratio clamped beyond fingerboard', () => {
    const params = { ...violinParams(), fingerboard_length: 100 }
    const result = calculateFingerboardThicknessAtFret(params, 12)
    expect(result.position_ratio).toBe(1.0)
  })

  it('zero fingerboard length returns nut thickness', () => {
    const params = { ...violinParams(), fingerboard_length: 0 }
    const result = calculateFingerboardThicknessAtFret(params, 7)
    const fb = calculateFingerboardThickness(params)
    expect(result.fb_thickness_at_fret).toBe(fb.fb_thickness_at_nut)
  })
})

// ---------------------------------------------------------------------------
// TestIntegration
// ---------------------------------------------------------------------------

describe('Integration: full violin calculation pipeline', () => {
  it('full violin calculation pipeline', () => {
    const params = {
      vsl: 325,
      body_stop: 195,
      fingerboard_length: 270,
      arching_height: 15,
      bridge_height: 33,
      overstand: 12,
      string_height_nut: 0.6,
      string_height_eof: 4.0,
      fingerboard_radius: 41,
      fb_visible_height_at_nut: 4.0,
      fb_visible_height_at_join: 6.0,
      fingerboard_width_at_nut: 24,
      fingerboard_width_at_end: 30,
    }

    // Step 1: Calculate fingerboard thickness
    const fbResult = calculateFingerboardThickness(params)
    expect(fbResult.fb_thickness_at_nut).toBeGreaterThan(params.fb_visible_height_at_nut)

    // Step 2: Calculate string angles
    const stringResult = calculateStringAnglesViolin(
      params, params.vsl, fbResult.fb_thickness_at_join
    )
    expect(stringResult.neck_stop).toBeGreaterThan(0)

    // Step 3: Calculate neck geometry
    const neckResult = calculateNeckGeometry(
      params,
      params.vsl,
      stringResult.neck_stop,
      stringResult.string_angle_to_ribs_rad,
      stringResult.string_angle_to_fb,
      fbResult.fb_thickness_at_nut,
      fbResult.fb_thickness_at_join
    )
    expect('neck_angle' in neckResult).toBe(true)

    // Step 4: Calculate fingerboard geometry
    const fbGeomResult = calculateFingerboardGeometry(
      params,
      stringResult.neck_stop,
      neckResult.neck_end_x,
      neckResult.neck_end_y,
      neckResult.neck_line_angle,
      fbResult.fb_thickness_at_nut,
      fbResult.fb_thickness_at_join
    )
    expect('fb_direction_angle' in fbGeomResult).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateViolBackBreak
// ---------------------------------------------------------------------------

describe('calculateViolBackBreak', () => {
  it('returns expected keys', () => {
    const params = {
      back_break_length: 256.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)
    expect('back_break_length' in result).toBe(true)
    expect('break_start_x' in result).toBe(true)
    expect('break_start_y' in result).toBe(true)
    expect('break_end_x' in result).toBe(true)
    expect('break_end_y' in result).toBe(true)
    expect('break_angle_rad' in result).toBe(true)
  })

  it('derives break angle from back break length', () => {
    // With back_break_length=256.08, the angle should be ~15 degrees
    const remainingDrop = 100.0 - 40.0
    const breakHorizontal = remainingDrop / Math.tan((15.0 * Math.PI) / 180)
    const backBreakLength = 480.0 - breakHorizontal

    const params = {
      back_break_length: backBreakLength,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)

    const expectedAngleRad = (15.0 * Math.PI) / 180
    expect(Math.abs(result.break_angle_rad - expectedAngleRad)).toBeLessThan(0.001)
  })

  it('break start is at top block height', () => {
    const params = {
      back_break_length: 256.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)

    expect(result.break_start_x).toBe(0)
    const expectedY = 3.5 - 40.0
    expect(Math.abs(result.break_start_y - expectedY)).toBeLessThan(0.01)
  })

  it('break end is at back level', () => {
    const params = {
      back_break_length: 256.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)

    const expectedY = 3.5 - 100.0
    expect(Math.abs(result.break_end_y - expectedY)).toBeLessThan(0.01)
  })

  it('full flat back gives shallow angle', () => {
    const params = {
      back_break_length: 0.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)
    // angle = atan(60/480) ≈ 7.1° — shallow but not zero
    const expectedRad = Math.atan(60.0 / 480.0)
    expect(Math.abs(result.break_angle_rad - expectedRad)).toBeLessThan(0.001)
  })

  it('larger back break length gives steeper angle', () => {
    const paramsShort = {
      back_break_length: 100.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const paramsLong = {
      back_break_length: 400.0,
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const resultShort = calculateViolBackBreak(paramsShort)
    const resultLong = calculateViolBackBreak(paramsLong)

    expect(resultLong.break_angle_rad).toBeGreaterThan(resultShort.break_angle_rad)
  })
})

// ---------------------------------------------------------------------------
// TestEvaluateCubicBezier
// ---------------------------------------------------------------------------

describe('evaluateCubicBezier', () => {
  it('t=0 returns start point', () => {
    const p0: [number, number] = [0, 0]
    const cp1: [number, number] = [1, 2]
    const cp2: [number, number] = [3, 4]
    const p3: [number, number] = [5, 6]
    const [x, y] = evaluateCubicBezier(p0, cp1, cp2, p3, 0.0)
    expect(Math.abs(x - 0)).toBeLessThan(1e-9)
    expect(Math.abs(y - 0)).toBeLessThan(1e-9)
  })

  it('t=1 returns end point', () => {
    const p0: [number, number] = [0, 0]
    const cp1: [number, number] = [1, 2]
    const cp2: [number, number] = [3, 4]
    const p3: [number, number] = [5, 6]
    const [x, y] = evaluateCubicBezier(p0, cp1, cp2, p3, 1.0)
    expect(Math.abs(x - 5)).toBeLessThan(1e-9)
    expect(Math.abs(y - 6)).toBeLessThan(1e-9)
  })

  it('straight line midpoint', () => {
    const p0: [number, number] = [0.0, 0.0]
    const cp1: [number, number] = [1 / 3, 1 / 3]
    const cp2: [number, number] = [2 / 3, 2 / 3]
    const p3: [number, number] = [1.0, 1.0]
    const [x, y] = evaluateCubicBezier(p0, cp1, cp2, p3, 0.5)
    expect(Math.abs(x - 0.5)).toBeLessThan(1e-9)
    expect(Math.abs(y - 0.5)).toBeLessThan(1e-9)
  })

  it('result is tuple of two floats', () => {
    const result = evaluateCubicBezier([0, 0], [1, 0], [2, 0], [3, 0], 0.5)
    expect(result.length).toBe(2)
  })

  it('symmetric curve midpoint', () => {
    const p0: [number, number] = [0.0, 0.0]
    const cp1: [number, number] = [0.0, 10.0]
    const cp2: [number, number] = [10.0, 10.0]
    const p3: [number, number] = [10.0, 0.0]
    const [x, y] = evaluateCubicBezier(p0, cp1, cp2, p3, 0.5)
    expect(Math.abs(x - 5.0)).toBeLessThan(1e-9)
    expect(y).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// TestFindBezierTForY
// ---------------------------------------------------------------------------

describe('findBezierTForY', () => {
  function straightLineBezier(): [[number, number], [number, number], [number, number], [number, number]] {
    const p0: [number, number] = [0.0, 0.0]
    const cp1: [number, number] = [0.0, 10 / 3]
    const cp2: [number, number] = [0.0, 20 / 3]
    const p3: [number, number] = [0.0, 10.0]
    return [p0, cp1, cp2, p3]
  }

  it('finds start y', () => {
    const [p0, cp1, cp2, p3] = straightLineBezier()
    const t = findBezierTForY(p0, cp1, cp2, p3, 0.0)
    expect(Math.abs(t)).toBeLessThan(0.001)
  })

  it('finds end y', () => {
    const [p0, cp1, cp2, p3] = straightLineBezier()
    const t = findBezierTForY(p0, cp1, cp2, p3, 10.0)
    expect(Math.abs(t - 1.0)).toBeLessThan(0.001)
  })

  it('finds midpoint y', () => {
    const [p0, cp1, cp2, p3] = straightLineBezier()
    const t = findBezierTForY(p0, cp1, cp2, p3, 5.0)
    expect(Math.abs(t - 0.5)).toBeLessThan(0.001)
  })

  it('result evaluates to target y', () => {
    const p0: [number, number] = [0.0, 0.0]
    const cp1: [number, number] = [5.0, 3.0]
    const cp2: [number, number] = [5.0, 8.0]
    const p3: [number, number] = [10.0, 10.0]
    const targetY = 6.0
    const t = findBezierTForY(p0, cp1, cp2, p3, targetY)
    const [, yFound] = evaluateCubicBezier(p0, cp1, cp2, p3, t)
    expect(Math.abs(yFound - targetY)).toBeLessThan(0.001)
  })

  it('result in range 0 to 1', () => {
    const [p0, cp1, cp2, p3] = straightLineBezier()
    for (const targetY of [0.0, 2.5, 5.0, 7.5, 10.0]) {
      const t = findBezierTForY(p0, cp1, cp2, p3, targetY)
      expect(t).toBeGreaterThanOrEqual(0.0)
      expect(t).toBeLessThanOrEqual(1.0)
    }
  })
})

// ---------------------------------------------------------------------------
// TestCalculateBlendCurve
// ---------------------------------------------------------------------------

describe('calculateBlendCurve', () => {
  function defaultArgs() {
    return {
      halfNeckWidthAtRibs: 15.0,
      halfFbWidth: 12.0,
      yTopOfBlock: 35.0,
      yFbBottom: 41.0,
      fbVisibleHeight: 5.0,
      fbBlendPercent: 50.0,
      halfButtonWidth: 14.0,
      yButton: 0.0,
    }
  }

  it('returns expected keys', () => {
    const result = calculateBlendCurve(defaultArgs())
    expect('p0' in result).toBe(true)
    expect('cp1' in result).toBe(true)
    expect('cp2' in result).toBe(true)
    expect('p3' in result).toBe(true)
    expect('curve_end_y' in result).toBe(true)
    expect('neck_block_max_width' in result).toBe(true)
  })

  it('p0 is start point', () => {
    const result = calculateBlendCurve(defaultArgs())
    expect(result.p0).toEqual([15.0, 35.0])
  })

  it('p3 is end point', () => {
    const result = calculateBlendCurve(defaultArgs())
    expect(result.p3[0]).toBe(12.0)
    expect(Math.abs(result.p3[1] - result.curve_end_y)).toBeLessThan(1e-9)
  })

  it('zero blend gives fingerboard width', () => {
    const args = { ...defaultArgs(), fbBlendPercent: 0.0 }
    const result = calculateBlendCurve(args)
    expect(result.neck_block_max_width).toBe(12.0 * 2)
  })

  it('fb bottom at or below top of block gives neck width', () => {
    const args = { ...defaultArgs(), yFbBottom: 30.0 }
    const result = calculateBlendCurve(args)
    expect(result.neck_block_max_width).toBe(15.0 * 2)
  })

  it('zero fb visible height gives fingerboard width', () => {
    const args = { ...defaultArgs(), fbVisibleHeight: 0.0 }
    const result = calculateBlendCurve(args)
    expect(result.neck_block_max_width).toBe(12.0 * 2)
  })

  it('normal case uses bezier for intermediate width', () => {
    const result = calculateBlendCurve(defaultArgs())
    expect(result.neck_block_max_width).toBeGreaterThanOrEqual(12.0 * 2)
    expect(result.neck_block_max_width).toBeLessThanOrEqual(15.0 * 2)
  })

  it('vertical tangent case', () => {
    const args = { ...defaultArgs(), halfButtonWidth: 16.0 }
    const result = calculateBlendCurve(args)
    expect('neck_block_max_width' in result).toBe(true)
    expect(result.p0).toEqual([15.0, 35.0])
  })
})

// ---------------------------------------------------------------------------
// TestCalculateStringAnglesGuitarValidation
// ---------------------------------------------------------------------------

describe('calculateStringAnglesGuitar validation', () => {
  it('impossible geometry raises error', () => {
    const vsl = 650.0
    const fretPositions: number[] = []
    for (let n = 1; n <= 20; n++) {
      fretPositions.push(vsl * (1 - 2 ** (-n / 12)))
    }
    const params = {
      fret_join: 12,
      string_height_nut: 0.0,
      string_height_12th_fret: 0.0,
      arching_height: 0.0,
      bridge_height: 400.0, // Impossibly large
      overstand: 0.0,
    }
    expect(() =>
      calculateStringAnglesGuitar(params, vsl, fretPositions, 0.0)
    ).toThrow(/impossible/i)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateViolBackBreakClamping
// ---------------------------------------------------------------------------

describe('calculateViolBackBreak edge cases', () => {
  it('back_break_length >= body_length clamps horizontal to epsilon', () => {
    const params = {
      back_break_length: 500.0,  // Exceeds body_length
      top_block_height: 40.0,
      rib_height: 100.0,
      body_length: 100.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)
    // break_horizontal is clamped to EPSILON, angle approaches 90°
    expect(result.break_angle_rad).toBeGreaterThan(1.0) // > ~57°
  })

  it('remaining_drop <= 0 gives zero angle', () => {
    const params = {
      back_break_length: 200.0,
      top_block_height: 100.0,  // Same as rib_height — no drop
      rib_height: 100.0,
      body_length: 480.0,
      belly_edge_thickness: 3.5,
    }
    const result = calculateViolBackBreak(params)
    expect(result.break_angle_rad).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// TestCalculateCrossSectionGeometry
// ---------------------------------------------------------------------------

describe('calculateCrossSectionGeometry', () => {
  function defaultParams() {
    return {
      instrument_family: 'VIOLIN',
      rib_height: 35.0,
      button_width_at_join: 28.0,
      neck_width_at_top_of_ribs: 30.0,
      overstand: 6.0,
      belly_edge_thickness: 3.5,
      fingerboard_width_at_nut: 24.0,
      fingerboard_width_at_end: 42.0,
      fingerboard_length: 270.0,
      fingerboard_radius: 41.0,
      fb_visible_height_at_join: 1.2,
      vsl: 325.0,
      body_stop: 195.0,
      fb_blend_percent: 0.0,
    }
  }

  it('returns dict', () => {
    const result = calculateCrossSectionGeometry(defaultParams())
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('zero fingerboard length sets position ratio to zero', () => {
    const params = {
      ...defaultParams(),
      fingerboard_length: 0,
      fingerboard_width_at_nut: 24.0,
      fingerboard_width_at_end: 42.0,
    }
    const result = calculateCrossSectionGeometry(params)
    expect(result).not.toBeNull()
  })

  it('viol uses top block height', () => {
    const params = {
      ...defaultParams(),
      instrument_family: 'VIOL',
      top_block_height: 50.0,
      rib_height: 100.0,
    }
    const result = calculateCrossSectionGeometry(params)
    expect(result).not.toBeNull()
  })
})
