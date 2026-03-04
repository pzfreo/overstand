/**
 * TypeScript port of tests/test_instrument_geometry.py
 *
 * All 8 Python tests ported to Vitest.
 */

import { calculateDerivedValues } from '../instrument_geometry'
import { getDefaultValues } from '../parameter_registry'

// ---------------------------------------------------------------------------
// test_calculate_derived_values_violin
// ---------------------------------------------------------------------------

describe('calculateDerivedValues violin', () => {
  it('calculates neck_stop and body_stop for violin', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'
    const result = calculateDerivedValues(params)

    expect('neck_stop' in result).toBe(true)
    expect('body_stop' in result).toBe(true)
    expect(result['neck_stop']!).toBeGreaterThan(0)
    expect(result['body_stop']!).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// test_viol_derived_values
// ---------------------------------------------------------------------------

describe('calculateDerivedValues viol', () => {
  it('calculates neck_stop and body_stop for viol', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOL'
    params['no_frets'] = 7
    const result = calculateDerivedValues(params)

    expect('neck_stop' in result).toBe(true)
    expect('body_stop' in result).toBe(true)
    expect(result['neck_stop']!).toBeGreaterThan(0)
    expect(result['body_stop']!).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// test_guitar_derived_values_with_low_fret_count
// ---------------------------------------------------------------------------

describe('calculateDerivedValues guitar with low fret count', () => {
  it('works when no_frets < fret_join (regression test)', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'GUITAR_MANDOLIN'
    params['no_frets'] = 7  // Less than fret_join default of 12
    const result = calculateDerivedValues(params)

    expect('neck_stop' in result).toBe(true)
    expect('body_stop' in result).toBe(true)
    expect(result['neck_stop']!).toBeGreaterThan(0)
    expect(result['body_stop']!).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// test_string_angle_calculation
// ---------------------------------------------------------------------------

describe('string angle calculation', () => {
  it('string angles are within valid range for violin', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'
    const result = calculateDerivedValues(params)

    expect('string_angle_to_ribs' in result).toBe(true)
    expect('string_angle_to_fingerboard' in result).toBe(true)
    // String angles should be reasonable (between 0 and 90 degrees)
    expect(result['string_angle_to_ribs']!).toBeGreaterThan(0)
    expect(result['string_angle_to_ribs']!).toBeLessThan(90)
    expect(result['string_angle_to_fingerboard']!).toBeGreaterThan(0)
    expect(result['string_angle_to_fingerboard']!).toBeLessThan(90)
  })
})

// ---------------------------------------------------------------------------
// test_neck_line_angle_calculation
// ---------------------------------------------------------------------------

describe('neck line angle calculation', () => {
  it('neck_line_angle is calculated and in valid range for violin', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'
    const result = calculateDerivedValues(params)

    expect('neck_line_angle' in result).toBe(true)
    // Neck line angle should be reasonable (typically -10 to +10 degrees)
    // Note: neck_line_angle is stored in radians internally; we check the deg version
    // The Python test checks the raw value < 10 which is in radians - but it's a small angle
    // Actually the Python test checks: -10 < result['neck_line_angle'] < 10
    // In radians, atan2 for small angles is very small, so this holds
    expect(result['neck_line_angle']!).toBeGreaterThan(-10)
    expect(result['neck_line_angle']!).toBeLessThan(10)
  })
})

// ---------------------------------------------------------------------------
// test_fingerboard_thickness
// ---------------------------------------------------------------------------

describe('fingerboard thickness', () => {
  it('fb_thickness_at_nut and fb_thickness_at_end are positive and end > nut', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'
    const result = calculateDerivedValues(params)

    expect('fb_thickness_at_nut' in result).toBe(true)
    expect('fb_thickness_at_end' in result).toBe(true)
    // Thickness values should be positive
    expect(result['fb_thickness_at_nut']!).toBeGreaterThan(0)
    expect(result['fb_thickness_at_end']!).toBeGreaterThan(0)
    // End thickness should be greater than nut thickness
    expect(result['fb_thickness_at_end']!).toBeGreaterThan(result['fb_thickness_at_nut']!)
  })
})

// ---------------------------------------------------------------------------
// test_afterlength_angle_calculation
// ---------------------------------------------------------------------------

describe('afterlength angle calculation', () => {
  it('afterlength_angle is positive and within reasonable range', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'
    params['tailpiece_height'] = 0
    const result = calculateDerivedValues(params)

    expect('afterlength_angle' in result).toBe(true)
    // Afterlength angle should be positive (downward slope from bridge to tailpiece)
    expect(result['afterlength_angle']!).toBeGreaterThan(0)
    // Should be within reasonable range (0 to 45 degrees typically)
    expect(result['afterlength_angle']!).toBeLessThan(45)
  })
})

// ---------------------------------------------------------------------------
// test_afterlength_angle_decreases_with_tailpiece_height
// ---------------------------------------------------------------------------

describe('afterlength angle with tailpiece height', () => {
  it('afterlength_angle decreases when tailpiece height increases', () => {
    const params = getDefaultValues()
    params['instrument_family'] = 'VIOLIN'

    params['tailpiece_height'] = 0
    const resultNoHeight = calculateDerivedValues(params)

    params['tailpiece_height'] = 10
    const resultWithHeight = calculateDerivedValues(params)

    // Higher tailpiece means smaller angle (string goes down less steeply)
    expect(resultWithHeight['afterlength_angle']!).toBeLessThan(resultNoHeight['afterlength_angle']!)
  })
})
