/**
 * Overstand - Radius Template Generator (TypeScript port)
 *
 * Generates fingerboard radius checking templates for 3D printing.
 *
 * The Python version uses matplotlib TextPath for text-to-bezier conversion.
 * This TypeScript port uses opentype.js for the same purpose, with graceful
 * degradation when the font is not available.
 *
 * Ported from src/radius_template.py
 */

import opentype from 'opentype.js'
import {
  TEMPLATE_WIDTH_MARGIN,
  MIN_FLAT_AREA_HEIGHT,
  ARC_POINT_RESOLUTION,
  TEXT_HEIGHT_FRACTION,
  TEXT_WIDTH_FACTOR,
  TEXT_MARGIN_FRACTION,
  SVG_MARGIN,
} from './constants'

type Params = Record<string, number | boolean | string | null | undefined>

// Font URL - served alongside the web app
export const FONT_URL = '/fonts/AllertaStencil-Regular.ttf'

// Module-level font cache (populated by loadStencilFont)
let _font: unknown = null

/**
 * Load the AllertaStencil font and cache it for use in generateRadiusTemplateSvg.
 * Call this once during app initialization before generating radius templates.
 */
export async function loadStencilFont(url = FONT_URL): Promise<void> {
  try {
    _font = await opentype.load(url)
  } catch (e) {
    console.warn('Could not load stencil font:', e)
    _font = null
  }
}

// ============================================================================
// mirrorPathDataX
// ============================================================================

/**
 * Negate all X coordinates in an SVG absolute path data string.
 * Only handles absolute commands (M, L, C, Q, Z) as output by opentype.js.
 */
export function mirrorPathDataX(d: string): string {
  const tokens = d.match(/[MLCQZmlcqz]|[-+]?[0-9]*\.?[0-9]+/g) ?? []
  const out: string[] = []
  const coordCounts: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, m: 2, l: 2, c: 6, q: 4 }
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i++]
    out.push(t)
    if (t === 'Z' || t === 'z') continue
    const n = coordCounts[t] ?? 0
    for (let j = 0; j < n; j++) {
      const val = parseFloat(tokens[i++])
      out.push(j % 2 === 0 ? `${-val}` : `${val}`)
    }
  }
  return out.join(' ')
}

// ============================================================================
// preTransformTextForRotation
// ============================================================================

/**
 * Pre-transform opentype.js text path data so that a subsequent rotate(180)
 * produces readable, correctly-oriented text cutouts.
 *
 * The problem: opentype.js uses Y-down SVG coordinates, but matplotlib's
 * TextPath (used by the Python version) uses Y-up math coordinates. After
 * rotate(180), the Y-flip converts Y-up→Y-down (Python: correct), but for
 * Y-down opentype paths the same Y-flip makes glyphs appear upside-down.
 *
 * The fix applies (x, y) → (−x, 2·baseline_y − y):
 *   • Negate X: so rotate(180)'s X-flip restores left-to-right reading order
 *   • Reflect Y around baseline_y: converts opentype Y-down to Y-up convention
 *     so rotate(180)'s Y-flip produces correctly-oriented glyphs
 *
 * This is equivalent to Python's `-(vertices[0] + x)` X-negation combined with
 * the implicit Y-up convention of matplotlib TextPath.
 */
export function preTransformTextForRotation(d: string, baseline_y: number): string {
  const tokens = d.match(/[MLCQZmlcqz]|[-+]?[0-9]*\.?[0-9]+/g) ?? []
  const out: string[] = []
  const coordCounts: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, m: 2, l: 2, c: 6, q: 4 }
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i++]
    out.push(t)
    if (t === 'Z' || t === 'z') continue
    const n = coordCounts[t] ?? 0
    for (let j = 0; j < n; j++) {
      const val = parseFloat(tokens[i++])
      if (j % 2 === 0) {
        out.push(`${-val}`)                    // X: negate
      } else {
        out.push(`${2 * baseline_y - val}`)    // Y: reflect around baseline
      }
    }
  }
  return out.join(' ')
}

// ============================================================================
// textToSvgPath
// ============================================================================

/**
 * Convert text to SVG path using opentype.js.
 *
 * In the TypeScript/browser context this requires a pre-loaded opentype Font
 * object. If no font is provided, returns null and the caller degrades to
 * the outline-only fallback.
 *
 * Signature mirrors the Python _text_to_svg_path_with_textpath() but accepts
 * an optional pre-loaded font instead of a font file path.
 *
 * @param text  Text string to convert (e.g., "41mm")
 * @param x     Starting X position for text
 * @param y     Starting Y position for text
 * @param font_size  Height of text in mm
 * @param font  Optional pre-loaded opentype Font object
 * @returns SVG path data string, or null if font not available
 */
export function textToSvgPath(
  text: string,
  x: number,
  y: number,
  font_size: number,
  font: unknown = null,
): string | null {
  if (!font) return null

  try {
    // opentype.js font interface
    const otFont = font as {
      getPath: (
        text: string,
        x: number,
        y: number,
        fontSize: number,
      ) => { toPathData: (decimals?: number) => string }
    }
    const pathData = otFont
      .getPath(text, x, y, font_size)
      .toPathData(2)
    return pathData || null
  } catch {
    return null
  }
}

// ============================================================================
// generateRadiusTemplateSvg
// ============================================================================

/**
 * Generate fingerboard radius checking template for 3D printing.
 *
 * Creates a rectangle with circular arc cutout based on:
 * - fingerboard_radius (radius of the arc)
 * - fingerboard_width_at_end (chord width)
 * - Template is 10mm wider than fingerboard, minimum 25mm high
 * - Text appears as cutout holes using bezier paths (if font available)
 *
 * @param params  Dictionary of instrument parameters
 * @param font    Optional pre-loaded opentype Font object for text cutouts
 * @returns SVG string of the template
 */
export function generateRadiusTemplateSvg(
  params: Params,
  font: unknown = _font,
): string {
  const fingerboard_radius = (params['fingerboard_radius'] as number) ?? 41.0
  const fb_width_at_end = (params['fingerboard_width_at_end'] as number) ?? 42.0

  const template_width = fb_width_at_end + TEMPLATE_WIDTH_MARGIN
  const half_template_width = template_width / 2.0

  // Calculate arc depth (sagitta for template width)
  let arc_depth: number
  let template_height: number

  if (half_template_width >= fingerboard_radius) {
    // Edge case: radius too small for template width - first branch
    arc_depth = fingerboard_radius  // Approximate
    template_height = 20.0
    // Will still hit ValueError below
  } else {
    arc_depth =
      fingerboard_radius -
      Math.sqrt(
        fingerboard_radius * fingerboard_radius -
          half_template_width * half_template_width,
      )
    template_height = arc_depth + MIN_FLAT_AREA_HEIGHT
  }

  // Generate points for the template outline
  const points: Array<[number, number]> = []

  const top_left: [number, number] = [-half_template_width, template_height]
  const top_right: [number, number] = [half_template_width, template_height]

  points.push(top_left)
  points.push(top_right)

  // Right side edge
  points.push([half_template_width, 0])

  // Arc along bottom edge - CONCAVE
  if (half_template_width >= fingerboard_radius) {
    throw new Error(
      `Fingerboard radius (${fingerboard_radius.toFixed(1)}mm) must be larger than ` +
        `half the template width (${half_template_width.toFixed(1)}mm). ` +
        `Increase fingerboard_radius or decrease fb_width_at_end.`,
    )
  }

  const arc_center_y = -Math.sqrt(
    fingerboard_radius * fingerboard_radius -
      half_template_width * half_template_width,
  )

  const num_arc_points = ARC_POINT_RESOLUTION

  const angle_right = Math.atan2(0 - arc_center_y, half_template_width)
  const angle_left = Math.atan2(0 - arc_center_y, -half_template_width)

  for (let i = 0; i <= num_arc_points; i++) {
    const t = i / num_arc_points
    const angle = angle_right + t * (angle_left - angle_right)
    const px = fingerboard_radius * Math.cos(angle)
    const py = arc_center_y + fingerboard_radius * Math.sin(angle)
    points.push([px, py])
  }

  // Left side edge
  points.push([-half_template_width, 0])

  // Close back to start
  points.push(top_left)

  // Build rectangle path
  const rect_path_d =
    'M ' + points.map(([px, py]) => `${px},${py}`).join(' L ') + ' Z'

  // Generate text cutouts
  const radius_str = `${fingerboard_radius.toFixed(0)}mm`
  const flat_area = template_height - arc_depth
  const char_height = flat_area * TEXT_HEIGHT_FRACTION

  const text_width = radius_str.length * char_height * TEXT_WIDTH_FACTOR
  const text_x = -text_width / 2
  const text_margin = char_height * TEXT_MARGIN_FRACTION
  const text_y = template_height - char_height - text_margin

  // Get text as bezier paths (or null if no font)
  const text_path_d = textToSvgPath(radius_str, text_x, text_y, char_height, font)

  // Calculate bounds for viewBox
  const all_x = points.map(([px]) => px)
  const all_y = points.map(([, py]) => py)

  if (text_path_d) {
    const text_width_estimate = radius_str.length * char_height * TEXT_WIDTH_FACTOR
    all_x.push(text_x, text_x + text_width_estimate)
    all_y.push(text_y, text_y + char_height)
  }

  const min_x = Math.min(...all_x)
  const max_x = Math.max(...all_x)
  const min_y = Math.min(...all_y)
  const max_y = Math.max(...all_y)

  const viewBox = `${min_x - SVG_MARGIN} ${min_y - SVG_MARGIN} ${max_x - min_x + 2 * SVG_MARGIN} ${max_y - min_y + 2 * SVG_MARGIN}`

  const svg_width = max_x - min_x + 2 * SVG_MARGIN
  const svg_height = max_y - min_y + 2 * SVG_MARGIN

  if (text_path_d) {
    // Compound path with evenodd fill-rule (text creates cutout holes)
    // Pre-transform text to account for opentype.js (Y-down) vs matplotlib
    // TextPath (Y-up) coordinate difference, so rotate(180) produces readable
    // correctly-oriented glyphs.
    const combined_path_d = `${rect_path_d} ${preTransformTextForRotation(text_path_d, text_y)}`

    const center_x = (min_x + max_x) / 2
    const center_y = (min_y + max_y) / 2
    const transform = `rotate(180, ${center_x}, ${center_y})`

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
      `width="${svg_width}mm" height="${svg_height}mm">\n` +
      `  <path fill="black" stroke="none" fill-rule="evenodd" transform="${transform}" d="${combined_path_d}"/>\n` +
      `</svg>`
    )
  } else {
    // Fallback: rectangle outline only
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
      `width="${svg_width}mm" height="${svg_height}mm">\n` +
      `  <path fill="black" stroke="black" stroke-width="0.5" d="${rect_path_d}"/>\n` +
      `</svg>`
    )
  }
}
