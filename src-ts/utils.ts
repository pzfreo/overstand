/**
 * Shared utility functions for the Overstand TypeScript codebase.
 *
 * Centralises common patterns: angle conversion, parameter extraction,
 * error handling, and small math helpers.
 */

import type { Params } from './geometry_engine'

// ---------------------------------------------------------------------------
// Angle conversion
// ---------------------------------------------------------------------------

/** Convert degrees to radians. */
export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Convert radians to degrees. */
export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

// ---------------------------------------------------------------------------
// Parameter extraction
//
// The codebase has two distinct defaulting conventions:
//   1.  (params['x'] as number) || defaultVal   – treats 0 as falsy
//   2.  (params['x'] as number) ?? defaultVal   – preserves 0
//
// getNumParam   mirrors pattern 1 (|| default)
// getNumParamNullish mirrors pattern 2 (?? default)
// ---------------------------------------------------------------------------

/**
 * Extract a numeric parameter, falling back to `defaultVal` when the value
 * is missing **or zero** (mirrors the `|| default` pattern).
 */
export function getNumParam(
  params: Params,
  key: string,
  defaultVal: number = 0,
): number {
  const v = params[key]
  return (typeof v === 'number' ? v : defaultVal) || defaultVal
}

/**
 * Extract a numeric parameter, falling back to `defaultVal` only when the
 * value is missing (mirrors the `?? default` pattern). Zero is preserved.
 */
export function getNumParamNullish(
  params: Params,
  key: string,
  defaultVal: number = 0,
): number {
  const v = params[key]
  return typeof v === 'number' ? v : defaultVal
}

/** Extract a string parameter with a default. */
export function getStringParam(
  params: Params,
  key: string,
  defaultVal: string = '',
): string {
  const v = params[key]
  return typeof v === 'string' ? v : defaultVal
}

/** Extract a boolean parameter with a default. */
export function getBoolParam(
  params: Params,
  key: string,
  defaultVal: boolean = false,
): boolean {
  const v = params[key]
  return typeof v === 'boolean' ? v : defaultVal
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/** Safely extract an error message from an unknown thrown value. */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Linear interpolation between `a` and `b` at parameter `t`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Euclidean magnitude (length) of a 2-D vector. */
export function magnitude(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy)
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Format an RGB triple as a CSS `rgb(r,g,b)` string. */
export function toRgbString(color: [number, number, number]): string {
  return `rgb(${color[0]},${color[1]},${color[2]})`
}
