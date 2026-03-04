import { describe, test, expect } from 'vitest'
import {
  toRadians,
  toDegrees,
  getNumParam,
  getNumParamNullish,
  getStringParam,
  getBoolParam,
  getErrorMessage,
  lerp,
  magnitude,
  toRgbString,
} from '../utils'

// ---------------------------------------------------------------------------
// Angle conversion
// ---------------------------------------------------------------------------

describe('toRadians', () => {
  test('converts 0 degrees', () => {
    expect(toRadians(0)).toBe(0)
  })
  test('converts 180 degrees to PI', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10)
  })
  test('converts 90 degrees to PI/2', () => {
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10)
  })
  test('converts 360 degrees to 2*PI', () => {
    expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10)
  })
  test('handles negative degrees', () => {
    expect(toRadians(-45)).toBeCloseTo(-Math.PI / 4, 10)
  })
})

describe('toDegrees', () => {
  test('converts 0 radians', () => {
    expect(toDegrees(0)).toBe(0)
  })
  test('converts PI to 180 degrees', () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 10)
  })
  test('converts PI/2 to 90 degrees', () => {
    expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 10)
  })
  test('round-trips with toRadians', () => {
    expect(toDegrees(toRadians(42.5))).toBeCloseTo(42.5, 10)
  })
})

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

describe('getNumParam', () => {
  test('returns value when present', () => {
    expect(getNumParam({ x: 5 }, 'x')).toBe(5)
  })
  test('returns default when key missing', () => {
    expect(getNumParam({}, 'x', 10)).toBe(10)
  })
  test('returns default when value is null', () => {
    expect(getNumParam({ x: null }, 'x', 10)).toBe(10)
  })
  test('returns default when value is undefined', () => {
    expect(getNumParam({ x: undefined }, 'x', 10)).toBe(10)
  })
  test('returns default when value is 0 (mirrors || pattern)', () => {
    expect(getNumParam({ x: 0 }, 'x', 10)).toBe(10)
  })
  test('returns default when value is a string', () => {
    expect(getNumParam({ x: 'hello' }, 'x', 7)).toBe(7)
  })
  test('returns 0 as default when no default specified and key missing', () => {
    expect(getNumParam({}, 'x')).toBe(0)
  })
  test('returns negative numbers', () => {
    expect(getNumParam({ x: -3 }, 'x')).toBe(-3)
  })
})

describe('getNumParamNullish', () => {
  test('returns value when present', () => {
    expect(getNumParamNullish({ x: 5 }, 'x')).toBe(5)
  })
  test('preserves 0 (differs from getNumParam)', () => {
    expect(getNumParamNullish({ x: 0 }, 'x', 10)).toBe(0)
  })
  test('returns default when key missing', () => {
    expect(getNumParamNullish({}, 'x', 10)).toBe(10)
  })
  test('returns default when value is null', () => {
    expect(getNumParamNullish({ x: null }, 'x', 10)).toBe(10)
  })
  test('returns default when value is undefined', () => {
    expect(getNumParamNullish({ x: undefined }, 'x', 10)).toBe(10)
  })
  test('returns default when value is a string', () => {
    expect(getNumParamNullish({ x: 'hello' }, 'x', 7)).toBe(7)
  })
})

describe('getStringParam', () => {
  test('returns string value', () => {
    expect(getStringParam({ x: 'hello' }, 'x')).toBe('hello')
  })
  test('returns default when missing', () => {
    expect(getStringParam({}, 'x', 'fallback')).toBe('fallback')
  })
  test('returns default when value is a number', () => {
    expect(getStringParam({ x: 42 }, 'x', 'fallback')).toBe('fallback')
  })
  test('returns empty string by default', () => {
    expect(getStringParam({}, 'x')).toBe('')
  })
})

describe('getBoolParam', () => {
  test('returns true when true', () => {
    expect(getBoolParam({ x: true }, 'x')).toBe(true)
  })
  test('returns false when false', () => {
    expect(getBoolParam({ x: false }, 'x', true)).toBe(false)
  })
  test('returns default when missing', () => {
    expect(getBoolParam({}, 'x', true)).toBe(true)
  })
  test('returns false by default', () => {
    expect(getBoolParam({}, 'x')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('getErrorMessage', () => {
  test('extracts message from Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })
  test('converts string to string', () => {
    expect(getErrorMessage('oops')).toBe('oops')
  })
  test('converts number to string', () => {
    expect(getErrorMessage(42)).toBe('42')
  })
  test('converts null to string', () => {
    expect(getErrorMessage(null)).toBe('null')
  })
})

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

describe('lerp', () => {
  test('t=0 returns a', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })
  test('t=1 returns b', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })
  test('t=0.5 returns midpoint', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
  test('t=0.25', () => {
    expect(lerp(0, 100, 0.25)).toBe(25)
  })
  test('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })
})

describe('magnitude', () => {
  test('3-4-5 triangle', () => {
    expect(magnitude(3, 4)).toBe(5)
  })
  test('zero vector', () => {
    expect(magnitude(0, 0)).toBe(0)
  })
  test('unit x', () => {
    expect(magnitude(1, 0)).toBe(1)
  })
  test('unit y', () => {
    expect(magnitude(0, 1)).toBe(1)
  })
  test('negative components', () => {
    expect(magnitude(-3, -4)).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

describe('toRgbString', () => {
  test('formats RGB values', () => {
    expect(toRgbString([255, 0, 128])).toBe('rgb(255,0,128)')
  })
  test('all zeros', () => {
    expect(toRgbString([0, 0, 0])).toBe('rgb(0,0,0)')
  })
  test('all 255', () => {
    expect(toRgbString([255, 255, 255])).toBe('rgb(255,255,255)')
  })
})
