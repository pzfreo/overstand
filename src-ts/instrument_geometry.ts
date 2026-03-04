/**
 * Overstand - Instrument Geometry Orchestrator (TypeScript port)
 *
 * This module acts as an orchestrator, combining logic from:
 * - geometry_engine.ts: Pure mathematical calculations
 *
 * SVG rendering (svg_renderer) is stubbed out and will be ported in Phase 3.
 *
 * Ported from src/instrument_geometry.py
 */

import {
  DEFAULT_FRETS_VIOL,
  DEFAULT_FRETS_GUITAR,
  DEFAULT_FRETS_VIOLIN,
} from './constants'

import {
  calculateFretPositions,
  calculateFingerboadThickness,
  calculateFingerboadThicknessAtFret,
  calculateStringAnglesViolin,
  calculateStringAnglesGuitar,
  calculateNeckGeometry,
  calculateFingerboadGeometry,
  calculateStringHeightAndDimensions,
  calculateViolBackBreak,
  calculateCrossSectionGeometry,
} from './geometry_engine'

import type { Params, DerivedValues } from './types'
export type { DerivedValues } from './types'

import { toDegrees, toRadians, getNumParam, getStringParam } from './utils'

import { renderSideView, renderCrossSectionView } from './svg_renderer'
import { generateRadiusTemplateSvg } from './radius_template'

// ---------------------------------------------------------------------------
// calculateDerivedValues
// ---------------------------------------------------------------------------

/**
 * Calculate derived values by orchestrating engine functions.
 *
 * This is the main orchestration function - it calls all geometry_engine
 * functions in the correct sequence and builds up the result object.
 *
 * Ported from instrument_geometry.py calculate_derived_values()
 */
export function calculateDerivedValues(params: Params): DerivedValues {
  const derived: DerivedValues = {}

  const vsl = getNumParam(params, 'vsl')
  const instrumentFamily = getStringParam(params, 'instrument_family', 'VIOLIN')

  // Determine number of frets
  let noFrets: number
  if (params['no_frets'] != null) {
    noFrets = params['no_frets'] as number
  } else if (instrumentFamily === 'VIOL') {
    noFrets = DEFAULT_FRETS_VIOL
  } else if (instrumentFamily === 'GUITAR_MANDOLIN') {
    noFrets = DEFAULT_FRETS_GUITAR
  } else {
    noFrets = DEFAULT_FRETS_VIOLIN
  }

  // For guitar family, ensure we calculate enough frets for fret_join and
  // the 12th fret reference used in string height interpolation
  const fretJoin = getNumParam(params, 'fret_join', 12)
  if (instrumentFamily === 'GUITAR_MANDOLIN') {
    noFrets = Math.max(noFrets, fretJoin, 12)
  }

  const fretPositions = calculateFretPositions(vsl, noFrets)

  const fbResult = calculateFingerboadThickness(params)
  Object.assign(derived, fbResult)
  const fbThicknessAtNut = fbResult.fb_thickness_at_nut
  const fbThicknessAtJoin = fbResult.fb_thickness_at_join

  // FB thickness at fret 1 and reference fret
  let fbRefFret: number
  if (instrumentFamily === 'GUITAR_MANDOLIN') {
    fbRefFret = Math.max(1, fretJoin - 2)
  } else {
    fbRefFret = 7
  }
  const fret1Result = calculateFingerboadThicknessAtFret(params, 1)
  derived['fb_thickness_at_fret_1'] = fret1Result.fb_thickness_at_fret
  derived['fb_fret_1_distance'] = fret1Result.fret_distance_from_nut
  const refResult = calculateFingerboadThicknessAtFret(params, fbRefFret)
  derived['fb_thickness_at_ref_fret'] = refResult.fb_thickness_at_fret
  derived['fb_ref_fret_distance'] = refResult.fret_distance_from_nut
  derived['fb_ref_fret_number'] = fbRefFret

  let angleResult: {
    body_stop: number
    neck_stop: number
    string_angle_to_ribs_rad: number
    string_angle_to_fb: number
    string_angle_to_ribs: number
    string_angle_to_fingerboard: number
    fret_join_position?: number | null
  }

  if (instrumentFamily === 'VIOLIN' || instrumentFamily === 'VIOL') {
    angleResult = calculateStringAnglesViolin(params, vsl, fbThicknessAtJoin)
  } else if (instrumentFamily === 'GUITAR_MANDOLIN') {
    angleResult = calculateStringAnglesGuitar(params, vsl, fretPositions, fbThicknessAtJoin)
  } else {
    throw new Error(`Invalid instrument family: ${instrumentFamily}`)
  }

  Object.assign(derived, angleResult)
  const neckStop = angleResult.neck_stop
  const stringAngleToRibsRad = angleResult.string_angle_to_ribs_rad
  const stringAngleToFb = angleResult.string_angle_to_fb

  const neckResult = calculateNeckGeometry(
    params,
    vsl,
    neckStop,
    stringAngleToRibsRad,
    stringAngleToFb,
    fbThicknessAtNut,
    fbThicknessAtJoin,
    angleResult.body_stop
  )
  derived['body_stop'] = angleResult.body_stop
  Object.assign(derived, neckResult)

  const fbGeomResult = calculateFingerboadGeometry(
    params,
    neckStop,
    derived['neck_end_x']!,
    derived['neck_end_y']!,
    derived['neck_line_angle']!,
    fbThicknessAtNut,
    fbThicknessAtJoin
  )
  Object.assign(derived, fbGeomResult)

  const stringHeightResult = calculateStringHeightAndDimensions(
    params,
    derived['neck_end_x']!,
    derived['neck_end_y']!,
    derived['nut_top_x']!,
    derived['nut_top_y']!,
    derived['bridge_top_x']!,
    derived['bridge_top_y']!,
    derived['fb_bottom_end_x']!,
    derived['fb_bottom_end_y']!,
    derived['fb_direction_angle']!,
    derived['fb_thickness_at_end']!
  )
  Object.assign(derived, stringHeightResult)

  // Add degree versions of internal angles for display
  derived['neck_line_angle_deg'] = toDegrees(derived['neck_line_angle']!)
  derived['fb_direction_angle_deg'] = toDegrees(derived['fb_direction_angle']!)

  // Calculate afterlength angle (angle of string from bridge to tailpiece relative to ribs)
  // Positive angle indicates downward slope from bridge to tailpiece
  const bodyLength = getNumParam(params, 'body_length')
  const bellyEdgeThickness = getNumParam(params, 'belly_edge_thickness')
  const tailpieceHeight = getNumParam(params, 'tailpiece_height')

  const dx = bodyLength - derived['bridge_top_x']!
  const dy = derived['bridge_top_y']! - (bellyEdgeThickness + tailpieceHeight)
  derived['afterlength_angle'] = toDegrees(Math.atan2(dy, dx))

  // Calculate string break angle at the bridge
  derived['string_break_angle'] = 180 - derived['string_angle_to_ribs']! - derived['afterlength_angle']!

  // Calculate percentage of string tension pushing downward on the belly
  // Convert angles from degrees to radians for sin calculation
  const stringAngleRad = toRadians(derived['string_angle_to_ribs']!)
  const afterlengthAngleRad = toRadians(derived['afterlength_angle']!)
  derived['downward_force_percent'] = (Math.sin(stringAngleRad) + Math.sin(afterlengthAngleRad)) * 100

  // Calculate viol-specific back break geometry
  if (instrumentFamily === 'VIOL') {
    const backBreakResult = calculateViolBackBreak(params)
    Object.assign(derived, backBreakResult)
  } else {
    derived['back_break_length'] = 0
  }

  // Calculate cross-section geometry (for neck_block_max_width)
  const csGeom = calculateCrossSectionGeometry(params)
  derived['neck_block_max_width'] = csGeom.neck_block_max_width ?? csGeom.fb_width_at_body_join

  return derived
}

// ---------------------------------------------------------------------------
// generateSideViewSvg
// ---------------------------------------------------------------------------

/**
 * Generate side view SVG.
 *
 * Delegates to renderSideView from svg_renderer.ts.
 */
export function generateSideViewSvg(
  params: Params,
  derivedValues?: DerivedValues
): string {
  const derived = derivedValues ?? calculateDerivedValues(params)
  return renderSideView(params, derived)
}

// ---------------------------------------------------------------------------
// generateMultiViewSvg
// ---------------------------------------------------------------------------

/**
 * Generate all SVG views.
 */
export function generateMultiViewSvg(
  params: Params
): Record<string, string> {
  const derived = calculateDerivedValues(params)
  const sideView = generateSideViewSvg(params, derived)

  // Cross-section view
  const csGeom = calculateCrossSectionGeometry(params)
  const crossSectionView = renderCrossSectionView(params, csGeom as Record<string, number | null | undefined | [number, number]>)

  return {
    side: sideView,
    top: 'Top View Placeholder',
    cross_section: crossSectionView,
    radius_template: generateRadiusTemplateSvg(params),
  }
}
