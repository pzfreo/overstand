/**
 * Overstand - Geometry Engine (TypeScript port)
 *
 * Pure mathematical calculations for instrument geometry,
 * independent of any drawing or UI logic.
 *
 * Ported from src/geometry_engine.py
 */

import {
  DEFAULT_FINGERBOARD_RADIUS,
  DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT,
  DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN,
  DEFAULT_FB_WIDTH_AT_NUT,
  DEFAULT_FB_WIDTH_AT_END,
  EPSILON,
} from './constants'

// ---------------------------------------------------------------------------
// Type aliases (canonical definitions in types.ts, re-exported for
// backwards compatibility with existing importers)
// ---------------------------------------------------------------------------

export type { Point2D, Params } from './types'
import type { Point2D, Params } from './types'

// ---------------------------------------------------------------------------
// calculateSagitta
// ---------------------------------------------------------------------------

/**
 * Calculate sagitta (height of arc) given radius and chord width.
 */
export function calculateSagitta(radius: number, width: number): number {
  if (radius <= 0 || width <= 0) {
    return 0.0
  }

  const halfWidth = width / 2.0
  if (halfWidth >= radius) {
    return (width ** 2) / (8.0 * radius)
  }

  return radius - Math.sqrt(radius ** 2 - halfWidth ** 2)
}

// ---------------------------------------------------------------------------
// Cubic Bezier helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a cubic Bezier curve at parameter t.
 */
export function evaluateCubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  const x = mt3 * p0[0] + 3 * mt2 * t * cp1[0] + 3 * mt * t2 * cp2[0] + t3 * p3[0]
  const y = mt3 * p0[1] + 3 * mt2 * t * cp1[1] + 3 * mt * t2 * cp2[1] + t3 * p3[1]

  return [x, y]
}

/**
 * Find parameter t where Bezier curve has the given y coordinate.
 *
 * Uses bisection method for robustness. Assumes y increases monotonically with t.
 */
export function findBezierTForY(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p3: Point2D,
  targetY: number,
  tolerance: number = 0.0001
): number {
  let tLow = 0.0
  let tHigh = 1.0

  for (let i = 0; i < 50; i++) {
    const tMid = (tLow + tHigh) / 2
    const [, yMid] = evaluateCubicBezier(p0, cp1, cp2, p3, tMid)

    if (Math.abs(yMid - targetY) < tolerance) {
      return tMid
    }

    // Assuming y increases with t (monotonic curve)
    if (yMid < targetY) {
      tLow = tMid
    } else {
      tHigh = tMid
    }
  }

  return (tLow + tHigh) / 2
}

// ---------------------------------------------------------------------------
// calculateBlendCurve
// ---------------------------------------------------------------------------

export interface BlendCurveResult {
  p0: Point2D
  cp1: Point2D
  cp2: Point2D
  p3: Point2D
  curve_end_y: number
  neck_block_max_width: number
}

export interface BlendCurveArgs {
  halfNeckWidthAtRibs: number
  halfFbWidth: number
  yTopOfBlock: number
  yFbBottom: number
  fbVisibleHeight: number
  fbBlendPercent: number
  halfButtonWidth: number
  yButton: number
}

/**
 * Calculate cubic Bezier curve parameters for the blended fillet.
 */
export function calculateBlendCurve(args: BlendCurveArgs): BlendCurveResult {
  const {
    halfNeckWidthAtRibs,
    halfFbWidth,
    yTopOfBlock,
    yFbBottom,
    fbVisibleHeight,
    fbBlendPercent,
    halfButtonWidth,
    yButton,
  } = args

  // Start point
  const p0: Point2D = [halfNeckWidthAtRibs, yTopOfBlock]

  // End Y coordinate based on blend percentage
  const curveEndY = yFbBottom + (fbBlendPercent / 100.0) * fbVisibleHeight

  // End point - always at full fingerboard width
  const p3: Point2D = [halfFbWidth, curveEndY]

  // Calculate incoming slope from button to top of block
  const dxStraight = halfNeckWidthAtRibs - halfButtonWidth
  const dyStraight = yTopOfBlock - yButton

  // Calculate curve length (approximate straight-line distance)
  const dx = p3[0] - p0[0]
  const dy = p3[1] - p0[1]
  const curveLength = Math.sqrt(dx * dx + dy * dy)

  // Control point distances (1/3 of curve length is standard heuristic)
  const t1 = curveLength / 3.0
  const t2 = curveLength / 3.0

  // cp1: Along incoming tangent direction from p0
  let cp1: Point2D
  if (dxStraight > EPSILON) {
    // Normalize the incoming tangent
    const tangentLength = Math.sqrt(dxStraight * dxStraight + dyStraight * dyStraight)
    const tangentDx = dxStraight / tangentLength
    const tangentDy = dyStraight / tangentLength
    cp1 = [p0[0] + t1 * tangentDx, p0[1] + t1 * tangentDy]
  } else {
    // Vertical or near-vertical incoming line - use a small horizontal offset
    cp1 = [p0[0] + t1 * 0.1, p0[1] + t1]
  }

  // cp2: Directly below p3 (same x) to ensure vertical end tangent
  const cp2: Point2D = [p3[0], p3[1] - t2]

  // Calculate width at yFbBottom
  let neckBlockMaxWidth: number
  if (fbBlendPercent < EPSILON) {
    // No blend - width equals fingerboard width
    neckBlockMaxWidth = halfFbWidth * 2
  } else if (yFbBottom <= yTopOfBlock) {
    // Edge case: fb_bottom at or below top of block
    neckBlockMaxWidth = halfNeckWidthAtRibs * 2
  } else if (yFbBottom >= curveEndY) {
    // Edge case: fb_bottom at or above curve end
    neckBlockMaxWidth = halfFbWidth * 2
  } else {
    // Find x at yFbBottom on the curve
    const t = findBezierTForY(p0, cp1, cp2, p3, yFbBottom)
    const [xAtFbBottom] = evaluateCubicBezier(p0, cp1, cp2, p3, t)
    neckBlockMaxWidth = xAtFbBottom * 2
  }

  return {
    p0,
    cp1,
    cp2,
    p3,
    curve_end_y: curveEndY,
    neck_block_max_width: neckBlockMaxWidth,
  }
}

// ---------------------------------------------------------------------------
// calculateFingerboadThickness
// ---------------------------------------------------------------------------

export interface FingerboadThicknessResult {
  sagitta_at_nut: number
  sagitta_at_join: number
  fb_thickness_at_nut: number
  fb_thickness_at_join: number
}

/**
 * Calculate fingerboard thickness including sagitta for radiused fingerboard.
 */
export function calculateFingerboadThickness(params: Params): FingerboadThicknessResult {
  const fingerboadRadius = (params['fingerboard_radius'] as number | null | undefined) ?? DEFAULT_FINGERBOARD_RADIUS
  const fbVisibleHeightAtNut = (params['fb_visible_height_at_nut'] as number | null | undefined) ?? DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT
  const fbVisibleHeightAtJoin = (params['fb_visible_height_at_join'] as number | null | undefined) ?? DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN
  const fbWidthAtNut = (params['fingerboard_width_at_nut'] as number | null | undefined) ?? DEFAULT_FB_WIDTH_AT_NUT
  const fbWidthAtJoin = (params['fingerboard_width_at_end'] as number | null | undefined) ?? DEFAULT_FB_WIDTH_AT_END

  const sagittaAtNut = calculateSagitta(fingerboadRadius || DEFAULT_FINGERBOARD_RADIUS, fbWidthAtNut || DEFAULT_FB_WIDTH_AT_NUT)
  const sagittaAtJoin = calculateSagitta(fingerboadRadius || DEFAULT_FINGERBOARD_RADIUS, fbWidthAtJoin || DEFAULT_FB_WIDTH_AT_END)

  const fbThicknessAtNut = (fbVisibleHeightAtNut || DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT) + sagittaAtNut
  const fbThicknessAtJoin = (fbVisibleHeightAtJoin || DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN) + sagittaAtJoin

  return {
    sagitta_at_nut: sagittaAtNut,
    sagitta_at_join: sagittaAtJoin,
    fb_thickness_at_nut: fbThicknessAtNut,
    fb_thickness_at_join: fbThicknessAtJoin,
  }
}

// ---------------------------------------------------------------------------
// calculateStringAnglesViolin
// ---------------------------------------------------------------------------

export interface StringAnglesViolinResult {
  body_stop: number
  neck_stop: number
  fret_join_position: number | null
  string_angle_to_ribs_rad: number
  string_angle_to_fb: number
  string_angle_to_ribs: number
  string_angle_to_fingerboard: number
}

/**
 * Calculate string angles for violin/viol family instruments.
 */
export function calculateStringAnglesViolin(
  params: Params,
  vsl: number,
  fbThicknessAtJoin: number
): StringAnglesViolinResult {
  const bodyStop = (params['body_stop'] as number) || 0
  const archingHeight = (params['arching_height'] as number) || 0
  const bridgeHeight = (params['bridge_height'] as number) || 0
  const overstand = (params['overstand'] as number) || 0
  const stringHeightNut = (params['string_height_nut'] as number) || 0
  const stringHeightEof = (params['string_height_eof'] as number) || 0
  const fingerboadLength = (params['fingerboard_length'] as number) || 0

  const stringHeightAtJoin =
    ((stringHeightEof - stringHeightNut) * ((vsl - bodyStop) / fingerboadLength)) +
    stringHeightNut
  const opposite = archingHeight + bridgeHeight - overstand - fbThicknessAtJoin - stringHeightAtJoin
  const stringAngleToRibsRad = Math.atan(opposite / bodyStop)
  const stringAngleToRibs = (stringAngleToRibsRad * 180) / Math.PI
  const stringToJoin = Math.sqrt(opposite ** 2 + bodyStop ** 2)
  const stringNutToJoin = vsl - stringToJoin
  const neckStop = Math.cos(stringAngleToRibsRad) * stringNutToJoin
  const oppositeStringToFb = stringHeightEof - stringHeightNut
  const stringAngleToFb =
    Math.atan(oppositeStringToFb / fingerboadLength) * (180 / Math.PI)
  const fretJoinPosition =
    stringToJoin > 0 && vsl > 0 ? 12 * Math.log2(vsl / stringToJoin) : null

  return {
    body_stop: bodyStop,
    neck_stop: neckStop,
    fret_join_position: fretJoinPosition,
    string_angle_to_ribs_rad: stringAngleToRibsRad,
    string_angle_to_fb: stringAngleToFb,
    string_angle_to_ribs: stringAngleToRibs,
    string_angle_to_fingerboard: stringAngleToFb,
  }
}

// ---------------------------------------------------------------------------
// calculateStringAnglesGuitar
// ---------------------------------------------------------------------------

export interface StringAnglesGuitarResult {
  body_stop: number
  neck_stop: number
  string_angle_to_ribs_rad: number
  string_angle_to_fb: number
  string_angle_to_ribs: number
  string_angle_to_fingerboard: number
}

/**
 * Calculate string angles for guitar/mandolin family instruments.
 */
export function calculateStringAnglesGuitar(
  params: Params,
  vsl: number,
  fretPositions: number[],
  fbThicknessAtJoin: number
): StringAnglesGuitarResult {
  const fretJoin = (params['fret_join'] as number) || 12
  const stringHeightNut = (params['string_height_nut'] as number) || 0
  const stringHeight12thFret = (params['string_height_12th_fret'] as number) || 0
  const archingHeight = (params['arching_height'] as number) || 0
  const bridgeHeight = (params['bridge_height'] as number) || 0
  const overstand = (params['overstand'] as number) || 0

  // fretPositions is 0-indexed: index 0 = fret 1, index N-1 = fret N
  const fretJoinIdx = fretJoin - 1
  const fret12Idx = 11 // 12th fret

  const fretPosAtJoin = fretPositions[fretJoinIdx]!
  const fretPosAt12 = fretPositions[fret12Idx]!

  const stringHeightAtJoin =
    ((stringHeight12thFret - stringHeightNut) * (fretPosAtJoin / fretPosAt12)) +
    stringHeightNut
  const hypotenuse = vsl - fretPosAtJoin
  const opposite = archingHeight + bridgeHeight - overstand - fbThicknessAtJoin - stringHeightAtJoin

  const sinValue = opposite / hypotenuse
  if (Math.abs(sinValue) > 1.0) {
    throw new Error(
      `Geometric constraints are impossible: string angle calculation requires sin(${sinValue.toFixed(3)}). ` +
      `Try adjusting: bridge_height (${bridgeHeight.toFixed(1)}mm), arching_height (${archingHeight.toFixed(1)}mm), ` +
      `overstand (${overstand.toFixed(1)}mm), or neck angle to make the geometry work.`
    )
  }

  const stringAngleToRibsRad = Math.asin(sinValue)
  const stringAngleToRibs = (stringAngleToRibsRad * 180) / Math.PI
  const stringNutToJoin = fretPosAtJoin
  const neckStop = Math.cos(stringAngleToRibsRad) * stringNutToJoin
  const bodyStop = Math.cos(stringAngleToRibsRad) * hypotenuse
  const oppositeStringToJoin = stringHeightAtJoin - stringHeightNut
  const stringAngleToFb =
    Math.atan(oppositeStringToJoin / fretPosAtJoin) * (180 / Math.PI)

  return {
    body_stop: bodyStop,
    neck_stop: neckStop,
    string_angle_to_ribs_rad: stringAngleToRibsRad,
    string_angle_to_fb: stringAngleToFb,
    string_angle_to_ribs: stringAngleToRibs,
    string_angle_to_fingerboard: stringAngleToFb,
  }
}

// ---------------------------------------------------------------------------
// calculateNeckGeometry
// ---------------------------------------------------------------------------

export interface NeckGeometryResult {
  neck_angle: number
  neck_stop: number
  neck_angle_rad: number
  neck_end_x: number
  neck_end_y: number
  nut_draw_radius: number
  neck_line_angle: number
  nut_top_x: number
  nut_top_y: number
  bridge_top_x: number
  bridge_top_y: number
  string_length: number
  nut_relative_to_ribs: number
}

/**
 * Calculate neck angle and nut position.
 *
 * @param bodyStop - The body stop position. For GUITAR_MANDOLIN this is derived from
 *                   fret positions, so must be passed explicitly. Falls back to params if null/undefined.
 */
export function calculateNeckGeometry(
  params: Params,
  vsl: number,
  neckStop: number,
  stringAngleToRibsRad: number,
  stringAngleToFb: number,
  fbThicknessAtNut: number,
  fbThicknessAtJoin: number,
  bodyStop: number | null = null
): NeckGeometryResult {
  const archingHeight = (params['arching_height'] as number) || 0
  const bridgeHeight = (params['bridge_height'] as number) || 0
  const overstand = (params['overstand'] as number) || 0
  const stringHeightNut = (params['string_height_nut'] as number) || 0

  // Use passed bodyStop (for GUITAR_MANDOLIN) or fall back to params (for VIOLIN/VIOL)
  const bridgeTopX = bodyStop !== null ? bodyStop : ((params['body_stop'] as number) ?? 0)
  const bridgeTopY = archingHeight + bridgeHeight
  const nutTopX = -neckStop
  const nutTopY = bridgeTopY - Math.sin(stringAngleToRibsRad) * vsl

  const oppositeFb = fbThicknessAtJoin - fbThicknessAtNut
  const fingerboadAngle = Math.atan(oppositeFb / neckStop) * (180 / Math.PI)
  const neckAngle =
    90 - ((stringAngleToRibsRad * 180) / Math.PI - stringAngleToFb - fingerboadAngle)
  const neckAngleRad = (neckAngle * Math.PI) / 180

  const neckEndX = 0 - neckStop + Math.cos(neckAngleRad) * fbThicknessAtNut
  const neckEndY = overstand - neckStop * Math.cos(neckAngleRad)
  const nutDrawRadius = fbThicknessAtNut + stringHeightNut
  const neckLineAngle = Math.atan2(neckEndY - overstand, neckEndX - 0)

  const stringLength = Math.sqrt(
    (bridgeTopX - nutTopX) ** 2 + (bridgeTopY - nutTopY) ** 2
  )

  return {
    neck_angle: neckAngle,
    neck_stop: neckStop,
    neck_angle_rad: neckAngleRad,
    neck_end_x: neckEndX,
    neck_end_y: neckEndY,
    nut_draw_radius: nutDrawRadius,
    neck_line_angle: neckLineAngle,
    nut_top_x: nutTopX,
    nut_top_y: nutTopY,
    bridge_top_x: bridgeTopX,
    bridge_top_y: bridgeTopY,
    string_length: stringLength,
    nut_relative_to_ribs: nutTopY,
  }
}

// ---------------------------------------------------------------------------
// calculateFingerboadGeometry
// ---------------------------------------------------------------------------

export interface FingerboadGeometryResult {
  fb_direction_angle: number
  fb_bottom_end_x: number
  fb_bottom_end_y: number
  fb_thickness_at_end: number
}

/**
 * Calculate fingerboard geometry including direction angle and end position.
 */
export function calculateFingerboadGeometry(
  params: Params,
  neckStop: number,
  neckEndX: number,
  neckEndY: number,
  neckLineAngle: number,
  fbThicknessAtNut: number,
  fbThicknessAtJoin: number
): FingerboadGeometryResult {
  const fingerboadLength = (params['fingerboard_length'] as number) || 0

  const fbDirectionAngle = neckLineAngle + Math.PI
  const fbBottomEndX = neckEndX + fingerboadLength * Math.cos(fbDirectionAngle)
  const fbBottomEndY = neckEndY + fingerboadLength * Math.sin(fbDirectionAngle)
  const fbThicknessAtEnd =
    fbThicknessAtNut + (fbThicknessAtJoin - fbThicknessAtNut) * (fingerboadLength / neckStop)

  return {
    fb_direction_angle: fbDirectionAngle,
    fb_bottom_end_x: fbBottomEndX,
    fb_bottom_end_y: fbBottomEndY,
    fb_thickness_at_end: fbThicknessAtEnd,
  }
}

// ---------------------------------------------------------------------------
// calculateStringHeightAndDimensions
// ---------------------------------------------------------------------------

export interface StringHeightAndDimensionsResult {
  nut_perpendicular_intersection_x: number
  nut_perpendicular_intersection_y: number
  nut_to_perpendicular_distance: number
  string_x_at_fb_end: number
  string_y_at_fb_end: number
  fb_surface_point_x: number
  fb_surface_point_y: number
  string_height_at_fb_end: number
}

/**
 * Calculate string height at fingerboard end and dimension points.
 */
export function calculateStringHeightAndDimensions(
  params: Params,
  neckEndX: number,
  neckEndY: number,
  nutTopX: number,
  nutTopY: number,
  bridgeTopX: number,
  bridgeTopY: number,
  fbBottomEndX: number,
  fbBottomEndY: number,
  fbDirectionAngle: number,
  fbThicknessAtEnd: number
): StringHeightAndDimensionsResult {
  const overstand = (params['overstand'] as number) || 0

  const perpAngle = fbDirectionAngle + Math.PI / 2
  const fbTopRightX = fbBottomEndX + fbThicknessAtEnd * Math.cos(perpAngle)
  const fbTopRightY = fbBottomEndY + fbThicknessAtEnd * Math.sin(perpAngle)

  const neckDx = neckEndX - 0
  const neckDy = neckEndY - overstand
  const perpNeckDx = -neckDy
  const perpNeckDy = neckDx

  const stringDx = bridgeTopX - nutTopX
  const stringDy = bridgeTopY - nutTopY

  const det = stringDx * perpNeckDy - stringDy * perpNeckDx

  let intersectX: number
  let intersectY: number
  let nutToPerp: number

  if (Math.abs(det) > EPSILON) {
    const t =
      ((0 - nutTopX) * perpNeckDy - (overstand - nutTopY) * perpNeckDx) / det
    intersectX = nutTopX + t * stringDx
    intersectY = nutTopY + t * stringDy
    nutToPerp = Math.sqrt(
      (intersectX - nutTopX) ** 2 + (intersectY - nutTopY) ** 2
    )
  } else {
    intersectX = 0.0
    intersectY = 0.0
    nutToPerp = 0.0
  }

  const fbDx = fbBottomEndX - neckEndX
  const fbDy = fbBottomEndY - neckEndY

  let t: number
  if (stringDx !== 0) {
    t = fbDx / stringDx
  } else {
    t = stringDy !== 0 ? fbDy / stringDy : 0
  }

  const stringXAtFbEnd = nutTopX + t * stringDx
  const stringYAtFbEnd = nutTopY + t * stringDy

  const vecX = stringXAtFbEnd - fbTopRightX
  const vecY = stringYAtFbEnd - fbTopRightY

  const perpDx = Math.cos(perpAngle)
  const perpDy = Math.sin(perpAngle)

  const stringHeightAtFbEnd = vecX * perpDx + vecY * perpDy

  const fbSurfacePointX = stringXAtFbEnd - stringHeightAtFbEnd * perpDx
  const fbSurfacePointY = stringYAtFbEnd - stringHeightAtFbEnd * perpDy

  return {
    nut_perpendicular_intersection_x: intersectX,
    nut_perpendicular_intersection_y: intersectY,
    nut_to_perpendicular_distance: nutToPerp,
    string_x_at_fb_end: stringXAtFbEnd,
    string_y_at_fb_end: stringYAtFbEnd,
    fb_surface_point_x: fbSurfacePointX,
    fb_surface_point_y: fbSurfacePointY,
    string_height_at_fb_end: stringHeightAtFbEnd,
  }
}

// ---------------------------------------------------------------------------
// calculateFretPositions
// ---------------------------------------------------------------------------

/**
 * Calculate fret positions from nut.
 */
export function calculateFretPositions(vsl: number, noFrets: number): number[] {
  const fretPositions: number[] = []
  for (let i = 1; i <= noFrets; i++) {
    fretPositions.push(vsl - vsl / 2 ** (i / 12))
  }
  return fretPositions
}

// ---------------------------------------------------------------------------
// calculateFingerboadThicknessAtFret
// ---------------------------------------------------------------------------

export interface FingerboadThicknessAtFretResult {
  fret_distance_from_nut: number
  position_ratio: number
  fb_thickness_at_fret: number
}

/**
 * Calculate fingerboard thickness at a given fret number.
 *
 * Interpolates between the already-defined nut and join thicknesses using
 * the fret's position along the fingerboard.
 */
export function calculateFingerboadThicknessAtFret(
  params: Params,
  fretNumber: number
): FingerboadThicknessAtFretResult {
  const vsl = (params['vsl'] as number) || 0
  const fingerboadLength = (params['fingerboard_length'] as number) || 0

  const fretPositions = calculateFretPositions(vsl, fretNumber)
  const fretDistance = fretPositions[fretNumber - 1]!

  const fb = calculateFingerboadThickness(params)
  const fbThicknessAtNut = fb.fb_thickness_at_nut
  const fbThicknessAtJoin = fb.fb_thickness_at_join

  let t: number
  if (fingerboadLength > 0) {
    t = Math.min(fretDistance / fingerboadLength, 1.0)
  } else {
    t = 0.0
  }

  const fbThicknessAtFret = fbThicknessAtNut + (fbThicknessAtJoin - fbThicknessAtNut) * t

  return {
    fret_distance_from_nut: fretDistance,
    position_ratio: t,
    fb_thickness_at_fret: fbThicknessAtFret,
  }
}

// ---------------------------------------------------------------------------
// calculateViolBackBreak
// ---------------------------------------------------------------------------

export interface ViolBackBreakResult {
  back_break_length: number
  break_start_x: number
  break_start_y: number
  break_end_x: number
  break_end_y: number
  break_angle_rad: number
}

/**
 * Calculate viol back break geometry.
 */
export function calculateViolBackBreak(params: Params): ViolBackBreakResult {
  const breakAngleDeg = (params['break_angle'] as number) ?? 15.0
  const topBlockHeight = (params['top_block_height'] as number) ?? 40.0
  const ribHeight = (params['rib_height'] as number) ?? 100.0
  const bodyLength = (params['body_length'] as number) ?? 355.0
  const bellyEdgeThickness = (params['belly_edge_thickness'] as number) ?? 3.5

  // Convert angle to radians
  const breakAngleRad = (breakAngleDeg * Math.PI) / 180

  // Y coordinates (belly is at bellyEdgeThickness, back is at bellyEdgeThickness - ribHeight)
  const bellyY = bellyEdgeThickness
  // const backY = bellyEdgeThickness - ribHeight  // computed below

  // Break start: bottom of vertical section at x=0
  const breakStartX = 0
  const breakStartY = bellyY - topBlockHeight

  // Calculate remaining vertical drop to the back
  const remainingDrop = ribHeight - topBlockHeight

  // Calculate horizontal distance of break line
  // tan(angle) = opposite/adjacent = remainingDrop/breakHorizontal
  let breakHorizontal: number
  if (breakAngleRad < 0.001) {
    breakHorizontal = bodyLength // Effectively horizontal
  } else {
    breakHorizontal = remainingDrop / Math.tan(breakAngleRad)
  }

  // Clamp break_horizontal to body_length
  if (breakHorizontal > bodyLength) {
    breakHorizontal = bodyLength
  }

  const backY = bellyEdgeThickness - ribHeight

  // Break end point (on the back)
  const breakEndX = breakHorizontal
  const breakEndY = backY

  // Back break length is from tail to break point
  const backBreakLength = bodyLength - breakHorizontal

  return {
    back_break_length: backBreakLength,
    break_start_x: breakStartX,
    break_start_y: breakStartY,
    break_end_x: breakEndX,
    break_end_y: breakEndY,
    break_angle_rad: breakAngleRad,
  }
}

// ---------------------------------------------------------------------------
// calculateCrossSectionGeometry
// ---------------------------------------------------------------------------

export interface CrossSectionGeometryResult {
  block_height: number
  overstand: number
  belly_edge_thickness: number
  button_width: number
  neck_width_at_ribs: number
  fb_width_at_body_join: number
  fb_thickness_at_join: number
  sagitta_at_join: number
  fingerboard_radius: number

  y_button: number
  y_top_of_block: number
  y_fb_bottom: number
  y_fb_top: number

  half_button_width: number
  half_neck_width_at_ribs: number
  half_fb_width: number

  fb_blend_percent: number
  fb_visible_height: number
  curve_end_y: number
  neck_block_max_width: number
  blend_p0: Point2D | null
  blend_cp1: Point2D | null
  blend_cp2: Point2D | null
  blend_p3: Point2D | null
}

/**
 * Calculate geometry for the neck cross-section view at the body join.
 */
export function calculateCrossSectionGeometry(params: Params): CrossSectionGeometryResult {
  // Get instrument family to determine block height
  const instrumentFamily = (params['instrument_family'] as string) ?? 'VIOLIN'

  // Block height varies by instrument family
  let blockHeight: number
  if (instrumentFamily === 'VIOL') {
    blockHeight =
      ((params['top_block_height'] as number) ?? null) ??
      ((params['rib_height'] as number) ?? 35.0)
  } else {
    blockHeight = (params['rib_height'] as number) ?? 35.0
  }

  // Get width parameters
  const buttonWidth = (params['button_width_at_join'] as number) ?? 28.0
  const neckWidthAtRibs = (params['neck_width_at_top_of_ribs'] as number) ?? 30.0
  const overstand = (params['overstand'] as number) ?? 6.0
  const bellyEdgeThickness = (params['belly_edge_thickness'] as number) ?? 3.5

  // Fingerboard parameters
  const fbWidthAtNut = (params['fingerboard_width_at_nut'] as number) ?? DEFAULT_FB_WIDTH_AT_NUT
  const fbWidthAtEnd = (params['fingerboard_width_at_end'] as number) ?? DEFAULT_FB_WIDTH_AT_END
  const fingerboadLength = (params['fingerboard_length'] as number) ?? 270.0
  const fingerboadRadius = (params['fingerboard_radius'] as number) ?? DEFAULT_FINGERBOARD_RADIUS
  const fbVisibleHeightAtJoin =
    (params['fb_visible_height_at_join'] as number) ?? DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN

  // Calculate neck_stop to determine position along fingerboard
  const vsl = (params['vsl'] as number) ?? 330.0
  const bodyStop = (params['body_stop'] as number) ?? 195.0
  const neckStop = vsl - bodyStop

  // Interpolate fingerboard width at body join
  let positionRatio: number
  if (fingerboadLength > 0) {
    positionRatio = Math.min(neckStop / fingerboadLength, 1.0)
  } else {
    positionRatio = 0.0
  }

  const fbWidthAtBodyJoin =
    fbWidthAtNut + (fbWidthAtEnd - fbWidthAtNut) * positionRatio

  // Calculate fingerboard thickness at body join (including sagitta for curve)
  const sagittaAtJoin = calculateSagitta(fingerboadRadius, fbWidthAtBodyJoin)
  const fbThicknessAtJoin = fbVisibleHeightAtJoin + sagittaAtJoin

  // Y coordinates (from bottom to top)
  const yButton = 0.0
  const yTopOfBlock = blockHeight
  const yFbBottom = blockHeight + overstand
  const yFbTop = yFbBottom + fbThicknessAtJoin

  // Half-widths (for symmetrical drawing about X=0)
  const halfButtonWidth = buttonWidth / 2.0
  const halfNeckWidthAtRibs = neckWidthAtRibs / 2.0
  const halfFbWidth = fbWidthAtBodyJoin / 2.0

  // Blend parameters
  const fbBlendPercent = (params['fb_blend_percent'] as number) ?? 0.0
  const fbVisibleHeight = fbThicknessAtJoin - sagittaAtJoin // Edge height of FB

  // Calculate blend curve if fingerboard is wider than neck
  let curveEndY: number
  let neckBlockMaxWidth: number
  let blendP0: Point2D | null = null
  let blendCp1: Point2D | null = null
  let blendCp2: Point2D | null = null
  let blendP3: Point2D | null = null

  if (halfFbWidth > halfNeckWidthAtRibs) {
    const blendResult = calculateBlendCurve({
      halfNeckWidthAtRibs,
      halfFbWidth,
      yTopOfBlock,
      yFbBottom,
      fbVisibleHeight,
      fbBlendPercent,
      halfButtonWidth,
      yButton,
    })
    curveEndY = blendResult.curve_end_y
    neckBlockMaxWidth = blendResult.neck_block_max_width
    blendP0 = blendResult.p0
    blendCp1 = blendResult.cp1
    blendCp2 = blendResult.cp2
    blendP3 = blendResult.p3
  } else {
    // Invalid geometry - no blend possible
    curveEndY = yFbBottom
    neckBlockMaxWidth = fbWidthAtBodyJoin
  }

  return {
    block_height: blockHeight,
    overstand,
    belly_edge_thickness: bellyEdgeThickness,
    button_width: buttonWidth,
    neck_width_at_ribs: neckWidthAtRibs,
    fb_width_at_body_join: fbWidthAtBodyJoin,
    fb_thickness_at_join: fbThicknessAtJoin,
    sagitta_at_join: sagittaAtJoin,
    fingerboard_radius: fingerboadRadius,

    y_button: yButton,
    y_top_of_block: yTopOfBlock,
    y_fb_bottom: yFbBottom,
    y_fb_top: yFbTop,

    half_button_width: halfButtonWidth,
    half_neck_width_at_ribs: halfNeckWidthAtRibs,
    half_fb_width: halfFbWidth,

    fb_blend_percent: fbBlendPercent,
    fb_visible_height: fbVisibleHeight,
    curve_end_y: curveEndY,
    neck_block_max_width: neckBlockMaxWidth,
    blend_p0: blendP0,
    blend_cp1: blendCp1,
    blend_cp2: blendCp2,
    blend_p3: blendP3,
  }
}
