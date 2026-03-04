/**
 * Overstand - View Generator (TypeScript port)
 *
 * Handles the generation of HTML-based views like fret position tables.
 *
 * Ported from src/view_generator.py
 */

import { calculateFretPositions } from './geometry_engine'
import type { Params } from './types'
import { getNumParam, getStringParam } from './utils'

// ============================================================================
// generateFretPositionsView
// ============================================================================

/**
 * Generate fret positions data for display.
 *
 * Returns an object with either:
 * - { available: false, message: string } - frets not applicable
 * - { available: true, html: string, vsl: number, no_frets: number } - fret table HTML
 */
export function generateFretPositionsView(params: Params): {
  available: boolean
  message?: string
  html?: string
  vsl?: number
  no_frets?: number
} {
  const vsl = getNumParam(params, 'vsl')
  const instrument_family = getStringParam(params, 'instrument_family', 'VIOLIN')

  let no_frets: number
  if (params['no_frets'] != null) {
    no_frets = params['no_frets'] as number
  } else if (instrument_family === 'VIOL') {
    no_frets = 7
  } else if (instrument_family === 'GUITAR_MANDOLIN') {
    no_frets = 20
  } else {
    no_frets = 0
  }

  if (no_frets === 0) {
    return {
      available: false,
      message: 'Fret positions not applicable for violin family',
    }
  }

  const fret_positions = calculateFretPositions(vsl, no_frets)

  let html = '<div class="fret-table-container">'
  html += '<table class="fret-table">'
  html +=
    '<thead><tr><th>Fret</th><th>Distance from Nut (mm)</th><th>Distance from Previous Fret (mm)</th></tr></thead>'
  html += '<tbody>'

  let prev_pos = 0
  for (let i = 0; i < fret_positions.length; i++) {
    const pos = fret_positions[i]!
    const fret_num = i + 1
    const from_nut = pos
    const from_prev = pos - prev_pos
    html += `<tr><td>${fret_num}</td><td>${from_nut.toFixed(1)}</td><td>${from_prev.toFixed(1)}</td></tr>`
    prev_pos = pos
  }

  html += '</tbody></table></div>'

  return {
    available: true,
    html,
    vsl,
    no_frets,
  }
}
