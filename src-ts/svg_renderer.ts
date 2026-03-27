/**
 * Overstand - SVG Renderer (TypeScript port)
 *
 * Handles conversion of geometric models into SVG elements.
 * Provides setup_exporter, draw_* and add_* functions that write shapes
 * into an ExportSVG instance.
 *
 * Ported from src/svg_renderer.py
 */

import {
  ExportSVG,
  Edge,
  Arc,
  Rectangle,
  Spline,
  Polygon,
  Text,
  Location,
  LineType,
  Unit,
  FONT_NAME,
  TITLE_FONT_SIZE,
  FOOTER_FONT_SIZE,
  DIMENSION_FONT_SIZE,
} from './buildprimitives'

import {
  createDimensionArrows,
  createVerticalDimension,
  createHorizontalDimension,
  createDiagonalDimension,
  createAngleDimension,
} from './dimension_helpers'

import type { Params, DerivedValues } from './types'

import { getNumParam, getNumParamNullish, getStringParam, getBoolParam, toDegrees, magnitude } from './utils'

// ============================================================================
// Dimension helper
// ============================================================================

type ShapeLayerPair = [Edge | Arc | Text, string]

/** Add an array of dimension shapes to the exporter (eliminates repeated for-of loops). */
function addDimensionShapes(exporter: ExportSVG, shapes: ShapeLayerPair[]): void {
  for (const [shape, layer] of shapes) {
    exporter.add_shape(shape, layer)
  }
}

// ============================================================================
// setupExporter
// ============================================================================

/**
 * Create and configure SVG exporter with all necessary layers.
 */
export function setupExporter(show_measurements: boolean): ExportSVG {
  const exporter = new ExportSVG(1.0, Unit.MM, 0.5)
  exporter.add_layer('text', [0, 0, 255], null, LineType.HIDDEN)
  exporter.add_layer('drawing', null, [0, 0, 0], LineType.CONTINUOUS)
  exporter.add_layer('schematic', null, [0, 0, 0], LineType.DASHED)
  exporter.add_layer('schematic_dotted', null, [100, 100, 100], LineType.DOTTED)

  const dim_color: [number, number, number] | null = show_measurements
    ? [255, 0, 0]
    : null
  exporter.add_layer('dimensions', dim_color, dim_color, LineType.DASHED)
  exporter.add_layer('extensions', dim_color, dim_color, LineType.CONTINUOUS)
  exporter.add_layer('arrows', dim_color, dim_color, LineType.CONTINUOUS)
  exporter.add_layer('dimension_leader', dim_color, dim_color, LineType.DOTTED)

  return exporter
}

// ============================================================================
// drawBody
// ============================================================================

/**
 * Draw body geometry.
 */
export function drawBody(
  exporter: ExportSVG,
  body_length: number,
  belly_edge_thickness: number,
  rib_height: number,
  body_stop: number,
  arching_height: number,
  viol_break_end_x?: number | null,
  viol_break_end_y?: number | null,
): void {
  const belly_rect = new Rectangle(body_length, belly_edge_thickness)
  exporter.add_shape(
    belly_rect.move(
      new Location([body_length / 2, belly_edge_thickness / 2]),
    ),
    'drawing',
  )

  const back_y = belly_edge_thickness - rib_height

  if (viol_break_end_x != null && viol_break_end_y != null) {
    // For viols: draw individual edges, skipping the cut corner
    // Tail end and bottom are dashed — rib height tapers, only accurate at neck join
    const right_edge = Edge.make_line(
      [body_length, belly_edge_thickness],
      [body_length, back_y],
    )
    exporter.add_shape(right_edge, 'schematic')

    const bottom_edge = Edge.make_line(
      [viol_break_end_x, back_y],
      [body_length, back_y],
    )
    exporter.add_shape(bottom_edge, 'schematic')
    // Left edge is drawn by drawViolBack
  } else {
    // Non-viols: draw individual edges so rib bottom + tail can be dotted
    // Rib height is only accurate at the neck join — ribs taper toward the tail
    const left_edge = Edge.make_line(
      [0, belly_edge_thickness],
      [0, back_y],
    )
    exporter.add_shape(left_edge, 'drawing')

    const top_edge = Edge.make_line(
      [0, belly_edge_thickness],
      [body_length, belly_edge_thickness],
    )
    exporter.add_shape(top_edge, 'drawing')

    const bottom_edge = Edge.make_line(
      [0, back_y],
      [body_length, back_y],
    )
    exporter.add_shape(bottom_edge, 'schematic')

    const right_edge = Edge.make_line(
      [body_length, belly_edge_thickness],
      [body_length, back_y],
    )
    exporter.add_shape(right_edge, 'schematic')
  }

  const arch_spline = Spline.interpolate_three_points(
    [0, belly_edge_thickness],
    [body_stop, arching_height],
    [body_length, belly_edge_thickness],
  )
  exporter.add_shape(arch_spline, 'schematic')
}

// ============================================================================
// drawViolBack
// ============================================================================

/**
 * Draw viol back break geometry.
 */
export function drawViolBack(
  exporter: ExportSVG,
  _body_length: number,
  belly_edge_thickness: number,
  _rib_height: number,
  _top_block_height: number,
  break_start_x: number,
  break_start_y: number,
  break_end_x: number,
  break_end_y: number,
): void {
  const vertical_line = Edge.make_line(
    [0, belly_edge_thickness],
    [break_start_x, break_start_y],
  )
  exporter.add_shape(vertical_line, 'drawing')

  const break_line = Edge.make_line(
    [break_start_x, break_start_y],
    [break_end_x, break_end_y],
  )
  exporter.add_shape(break_line, 'drawing')

  const back_y = belly_edge_thickness - _rib_height
  // Flat back after break is dashed — rib height tapers, only accurate at neck join
  const flat_back_line = Edge.make_line(
    [break_end_x, break_end_y],
    [_body_length, back_y],
  )
  exporter.add_shape(flat_back_line, 'schematic')
}

// ============================================================================
// addViolBackDimensions
// ============================================================================

/**
 * Add dimension annotations for viol back break geometry.
 */
export function addViolBackDimensions(
  exporter: ExportSVG,
  show_measurements: boolean,
  body_length: number,
  belly_edge_thickness: number,
  rib_height: number,
  _top_block_height: number,
  break_angle_deg: number,
  back_break_length: number,
  break_start_x: number,
  break_start_y: number,
  break_end_x: number,
  break_end_y: number,
): void {
  if (!show_measurements) return

  const back_y = belly_edge_thickness - rib_height

  const break_length_line = Edge.make_line(
    [break_end_x, back_y],
    [body_length, back_y],
  )
  addDimensionShapes(exporter, createHorizontalDimension(
    break_length_line,
    `${back_break_length.toFixed(1)}`,
    -45,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const top_block_line = Edge.make_line(
    [0, belly_edge_thickness],
    [0, break_start_y],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    top_block_line,
    `${_top_block_height.toFixed(1)}`,
    -12,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const horizontal_ref = Edge.make_line(
    [break_end_x, break_end_y],
    [break_end_x - 20, break_end_y],
  )
  const break_line = Edge.make_line(
    [break_end_x, break_end_y],
    [break_start_x, break_start_y],
  )
  addDimensionShapes(exporter, createAngleDimension(
    horizontal_ref,
    break_line,
    `${break_angle_deg.toFixed(1)}°`,
    12,
    DIMENSION_FONT_SIZE,
    0,
    false,
    true,
  ))
}

// ============================================================================
// drawNeck
// ============================================================================

/**
 * Draw neck structure. Returns [neck_vertical_line, neck_angled_line].
 */
export function drawNeck(
  exporter: ExportSVG,
  overstand: number,
  neck_end_x: number,
  neck_end_y: number,
  bridge_height: number,
  body_stop: number,
  arching_height: number,
  nut_radius: number,
  neck_line_angle: number,
  neck_angle_deg: number,
): [Edge, Edge] {
  const bridge_line = Edge.make_line(
    [body_stop, arching_height],
    [body_stop, arching_height + bridge_height],
  )
  exporter.add_shape(bridge_line, 'drawing')

  const neck_vertical_line = Edge.make_line([0, 0], [0, overstand])
  exporter.add_shape(neck_vertical_line, 'drawing')

  const neck_angled_line = Edge.make_line(
    [0, overstand],
    [neck_end_x, neck_end_y],
  )
  exporter.add_shape(neck_angled_line, 'drawing')

  const start_angle = neck_line_angle - Math.PI / 2
  const end_angle = start_angle + Math.PI / 2

  const nut_arc = Arc.make_arc(
    [neck_end_x, neck_end_y],
    nut_radius,
    start_angle,
    end_angle,
  )
  exporter.add_shape(nut_arc, 'schematic_dotted')

  const arc_start_x = neck_end_x + nut_radius * Math.cos(start_angle)
  const arc_start_y = neck_end_y + nut_radius * Math.sin(start_angle)
  const arc_end_x = neck_end_x + nut_radius * Math.cos(end_angle)
  const arc_end_y = neck_end_y + nut_radius * Math.sin(end_angle)

  exporter.add_shape(
    Edge.make_line([neck_end_x, neck_end_y], [arc_start_x, arc_start_y]),
    'schematic_dotted',
  )
  exporter.add_shape(
    Edge.make_line([neck_end_x, neck_end_y], [arc_end_x, arc_end_y]),
    'schematic_dotted',
  )

  addDimensionShapes(exporter, createAngleDimension(
    neck_vertical_line,
    neck_angled_line,
    `${neck_angle_deg.toFixed(1)}°`,
    15,
    DIMENSION_FONT_SIZE,
    5,
    true,
  ))

  return [neck_vertical_line, neck_angled_line]
}

// ============================================================================
// drawFingerboard
// ============================================================================

/**
 * Draw fingerboard. Returns [fb_top_end_x, fb_top_end_y].
 */
export function drawFingerboard(
  exporter: ExportSVG,
  neck_end_x: number,
  neck_end_y: number,
  fb_bottom_end_x: number,
  fb_bottom_end_y: number,
  fb_thickness_at_nut: number,
  fb_thickness_at_end: number,
  fb_direction_angle: number,
  fb_visible_height_at_nut: number,
  fb_visible_height_at_join: number,
): [number, number] {
  const perp_angle = fb_direction_angle + Math.PI / 2

  const visible_top_nut_x =
    neck_end_x + fb_visible_height_at_nut * Math.cos(perp_angle)
  const visible_top_nut_y =
    neck_end_y + fb_visible_height_at_nut * Math.sin(perp_angle)

  const visible_top_end_x =
    fb_bottom_end_x + fb_visible_height_at_join * Math.cos(perp_angle)
  const visible_top_end_y =
    fb_bottom_end_y + fb_visible_height_at_join * Math.sin(perp_angle)

  const fb_top_nut_x =
    neck_end_x + fb_thickness_at_nut * Math.cos(perp_angle)
  const fb_top_nut_y =
    neck_end_y + fb_thickness_at_nut * Math.sin(perp_angle)

  const fb_top_end_x =
    fb_bottom_end_x + fb_thickness_at_end * Math.cos(perp_angle)
  const fb_top_end_y =
    fb_bottom_end_y + fb_thickness_at_end * Math.sin(perp_angle)

  const visible_side_points: Array<[number, number]> = [
    [neck_end_x, neck_end_y],
    [fb_bottom_end_x, fb_bottom_end_y],
    [visible_top_end_x, visible_top_end_y],
    [visible_top_nut_x, visible_top_nut_y],
  ]
  const visible_side_polygon = new Polygon(
    visible_side_points,
    true,
    'diagonalHatch',
  )
  exporter.add_shape(visible_side_polygon, 'drawing')

  exporter.add_shape(
    Edge.make_line(
      [visible_top_nut_x, visible_top_nut_y],
      [fb_top_nut_x, fb_top_nut_y],
    ),
    'drawing',
  )
  exporter.add_shape(
    Edge.make_line(
      [visible_top_end_x, visible_top_end_y],
      [fb_top_end_x, fb_top_end_y],
    ),
    'drawing',
  )
  exporter.add_shape(
    Edge.make_line(
      [fb_top_nut_x, fb_top_nut_y],
      [fb_top_end_x, fb_top_end_y],
    ),
    'drawing',
  )

  return [fb_top_end_x, fb_top_end_y]
}

// ============================================================================
// drawStringAndReferences
// ============================================================================

/**
 * Draw string and references. Returns [reference_line_end_x, string_line].
 */
export function drawStringAndReferences(
  exporter: ExportSVG,
  nut_top_x: number,
  nut_top_y: number,
  bridge_top_x: number,
  bridge_top_y: number,
): [number, Edge] {
  const reference_line_end_x = nut_top_x - 20
  const reference_line = Edge.make_line([0, 0], [reference_line_end_x, 0])
  exporter.add_shape(reference_line, 'extensions')

  const string_line = Edge.make_line(
    [nut_top_x, nut_top_y],
    [bridge_top_x, bridge_top_y],
  )
  exporter.add_shape(string_line, 'drawing')

  return [reference_line_end_x, string_line]
}

// ============================================================================
// addDocumentText
// ============================================================================

/**
 * Add document metadata text.
 */
export function addDocumentText(
  exporter: ExportSVG,
  instrument_name: string,
  generator_url: string,
  body_length: number,
  rib_height: number,
  belly_edge_thickness: number,
  arching_height: number,
  bridge_height: number,
  neck_end_x: number,
): void {
  let title_text = new Text(instrument_name, TITLE_FONT_SIZE, FONT_NAME)
  const title_y = arching_height + bridge_height + 25
  const title_x = body_length / 2
  title_text = title_text.move(new Location([title_x, title_y]))
  exporter.add_shape(title_text, 'text')

  let footer_text = new Text(generator_url, FOOTER_FONT_SIZE, FONT_NAME)
  const footer_y = belly_edge_thickness - rib_height - 35
  const footer_x = neck_end_x
  footer_text = footer_text.move(new Location([footer_x, footer_y]))
  exporter.add_shape(footer_text, 'text')
}

// ============================================================================
// addFbThicknessDimensions
// ============================================================================

/**
 * Draw fingerboard thickness callout annotations at fret 1 and the reference fret.
 */
export function addFbThicknessDimensions(
  exporter: ExportSVG,
  show_measurements: boolean,
  neck_end_x: number,
  neck_end_y: number,
  fb_direction_angle: number,
  fb_thickness_at_nut: number,
  fb_thickness_at_join: number,
  neck_stop: number,
  fret_1_distance: number,
  ref_fret_distance: number,
): void {
  if (!show_measurements) return

  const perp_angle = fb_direction_angle + Math.PI / 2

  for (const [distance, offset] of [
    [fret_1_distance, 40],
    [ref_fret_distance, 60],
  ] as Array<[number, number]>) {
    const fb_x = neck_end_x + distance * Math.cos(fb_direction_angle)
    const fb_y = neck_end_y + distance * Math.sin(fb_direction_angle)
    const thickness =
      fb_thickness_at_nut +
      (distance / neck_stop) * (fb_thickness_at_join - fb_thickness_at_nut)
    const top_x = fb_x + thickness * Math.cos(perp_angle)
    const top_y = fb_y + thickness * Math.sin(perp_angle)
    const ext_x = top_x + offset * Math.cos(perp_angle)
    const ext_y = top_y + offset * Math.sin(perp_angle)

    const ext_line = Edge.make_line([top_x, top_y], [ext_x, ext_y])
    exporter.add_shape(ext_line, 'dimension_leader')

    const arrow_size = 3.0
    const dx = ext_x - top_x
    const dy = ext_y - top_y
    const length = Math.sqrt(dx * dx + dy * dy)
    const bx = dx / length
    const by = dy / length
    const wx = -by
    const wy = bx

    const wing1 = Edge.make_line(
      [top_x, top_y],
      [
        top_x + bx * arrow_size + wx * arrow_size,
        top_y + by * arrow_size + wy * arrow_size,
      ],
    )
    const wing2 = Edge.make_line(
      [top_x, top_y],
      [
        top_x + bx * arrow_size - wx * arrow_size,
        top_y + by * arrow_size - wy * arrow_size,
      ],
    )
    exporter.add_shape(wing1, 'arrows')
    exporter.add_shape(wing2, 'arrows')

    const label = `${thickness.toFixed(2)}mm at ${distance.toFixed(1)}mm`
    let text = new Text(label, DIMENSION_FONT_SIZE, FONT_NAME)
    text = text.move(new Location([ext_x + 2, ext_y]))
    exporter.add_shape(text, 'extensions')
  }
}

// ============================================================================
// SideViewDimensionOpts + addDimensions (split into sub-functions)
// ============================================================================

/**
 * Options for side-view dimension annotations.
 */
export interface SideViewDimensionOpts {
  show_measurements: boolean
  reference_line_end_x: number
  nut_top_x: number
  nut_top_y: number
  bridge_top_x: number
  bridge_top_y: number
  string_line: Edge
  string_length: number
  neck_end_x: number
  neck_end_y: number
  overstand: number
  body_stop: number
  arching_height: number
  bridge_height: number
  body_length: number
  rib_height: number
  belly_edge_thickness: number
  fb_surface_point_x: number
  fb_surface_point_y: number
  string_x_at_fb_end: number
  string_y_at_fb_end: number
  string_height_at_fb_end: number
  intersect_x: number
  intersect_y: number
  nut_to_perp_distance: number
  tailpiece_height: number
  string_break_angle: number
  downward_force_percent: number
}

/**
 * Nut-to-rib height, overstand, and nut x-distance dimensions.
 */
function addNutAndOverstandDimensions(exporter: ExportSVG, opts: SideViewDimensionOpts): void {
  if (opts.show_measurements) {
    const rib_to_nut_feature_line = Edge.make_line(
      [opts.reference_line_end_x, 0],
      [opts.reference_line_end_x, opts.nut_top_y],
    )
    addDimensionShapes(exporter, createVerticalDimension(
      rib_to_nut_feature_line,
      `${opts.nut_top_y.toFixed(1)}`,
      -8,
      3,
      DIMENSION_FONT_SIZE,
    ))
  }

  const nut_x_distance = Math.abs(opts.neck_end_x)
  const nut_feature_line = Edge.make_line(
    [opts.neck_end_x, opts.neck_end_y],
    [0, opts.neck_end_y],
  )
  addDimensionShapes(exporter, createHorizontalDimension(
    nut_feature_line,
    `${nut_x_distance.toFixed(1)}`,
    -10,
    3,
    DIMENSION_FONT_SIZE,
  ))

  if (opts.overstand > 0) {
    const overstand_feature_line = Edge.make_line([0, 0], [0, opts.overstand])
    addDimensionShapes(exporter, createVerticalDimension(
      overstand_feature_line,
      `${opts.overstand.toFixed(1)}`,
      8,
      3,
      DIMENSION_FONT_SIZE,
    ))
  }
}

/**
 * String length diagonal, nut-to-perpendicular diagonal, and string height at fingerboard end.
 */
function addStringDimensions(exporter: ExportSVG, opts: SideViewDimensionOpts): void {
  addDimensionShapes(exporter, createDiagonalDimension(
    opts.string_line,
    `${opts.string_length.toFixed(1)}`,
    10,
    3,
    DIMENSION_FONT_SIZE,
  ))

  if (opts.nut_to_perp_distance > 0) {
    const nut_to_perp_line = Edge.make_line(
      [opts.nut_top_x, opts.nut_top_y],
      [opts.intersect_x, opts.intersect_y],
    )
    addDimensionShapes(exporter, createDiagonalDimension(
      nut_to_perp_line,
      `${opts.nut_to_perp_distance.toFixed(1)}`,
      20,
      3,
      DIMENSION_FONT_SIZE,
    ))
  }

  const string_height_feature_line = Edge.make_line(
    [opts.fb_surface_point_x, opts.fb_surface_point_y],
    [opts.string_x_at_fb_end, opts.string_y_at_fb_end],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    string_height_feature_line,
    `${opts.string_height_at_fb_end.toFixed(1)}`,
    8,
    3,
    DIMENSION_FONT_SIZE,
  ))
}

/**
 * Arching height, bridge height, body stop, body length, and rib height dimensions.
 */
function addBodyDimensions(exporter: ExportSVG, opts: SideViewDimensionOpts): void {
  const arch_feature_line = Edge.make_line(
    [opts.body_stop, 0],
    [opts.body_stop, opts.arching_height],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    arch_feature_line,
    `${opts.arching_height.toFixed(1)}`,
    8,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const bridge_feature_line = Edge.make_line(
    [opts.body_stop, opts.arching_height],
    [opts.body_stop, opts.arching_height + opts.bridge_height],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    bridge_feature_line,
    `${opts.bridge_height.toFixed(1)}`,
    8,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const bottom_y = opts.belly_edge_thickness - opts.rib_height
  const body_stop_feature_line = Edge.make_line(
    [0, bottom_y],
    [opts.body_stop, bottom_y],
  )
  addDimensionShapes(exporter, createHorizontalDimension(
    body_stop_feature_line,
    `${opts.body_stop.toFixed(1)}`,
    -15,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const body_length_feature_line = Edge.make_line(
    [0, bottom_y],
    [opts.body_length, bottom_y],
  )
  addDimensionShapes(exporter, createHorizontalDimension(
    body_length_feature_line,
    `${opts.body_length.toFixed(1)}`,
    -30,
    3,
    DIMENSION_FONT_SIZE,
  ))

  const rib_dim_x = opts.body_length + 10
  const dim_p1: [number, number] = [rib_dim_x, opts.belly_edge_thickness]
  const dim_p2: [number, number] = [rib_dim_x, opts.belly_edge_thickness - opts.rib_height]
  const rib_dim_line = Edge.make_line(dim_p1, dim_p2)
  exporter.add_shape(rib_dim_line, 'dimensions')
  for (const arrow of createDimensionArrows(dim_p1, dim_p2, 3.0)) {
    exporter.add_shape(arrow, 'arrows')
  }
  let rib_text = new Text(`${opts.rib_height.toFixed(1)}`, DIMENSION_FONT_SIZE, FONT_NAME)
  rib_text = rib_text.move(
    new Location([rib_dim_x + DIMENSION_FONT_SIZE, opts.belly_edge_thickness - opts.rib_height / 2]),
  )
  exporter.add_shape(rib_text, 'text')
}

/**
 * Tailpiece line, break angle, tailpiece height, and downforce arrow dimensions.
 */
function addTailpieceAndForceDimensions(exporter: ExportSVG, opts: SideViewDimensionOpts): void {
  // Tailpiece to bridge dashed line (string heading to tailpiece is schematic)
  const tailpiece_top_y = opts.belly_edge_thickness + opts.tailpiece_height
  const tailpiece_to_bridge_line = Edge.make_line(
    [opts.body_length, tailpiece_top_y],
    [opts.bridge_top_x, opts.bridge_top_y],
  )
  exporter.add_shape(tailpiece_to_bridge_line, 'schematic')

  if (opts.string_break_angle > 0) {
    addDimensionShapes(exporter, createAngleDimension(
      opts.string_line,
      tailpiece_to_bridge_line,
      `${opts.string_break_angle.toFixed(1)}°`,
      14,
      DIMENSION_FONT_SIZE,
      0,
      true,
    ))
  }

  if (opts.tailpiece_height > 0) {
    const tailpiece_base_y = opts.belly_edge_thickness
    const tailpiece_ref_line = Edge.make_line(
      [opts.body_length, tailpiece_base_y],
      [opts.body_length, tailpiece_top_y],
    )
    exporter.add_shape(tailpiece_ref_line, 'schematic_dotted')

    const tailpiece_dim_x = opts.body_length + 20
    const tp_dim_p1: [number, number] = [tailpiece_dim_x, tailpiece_base_y]
    const tp_dim_p2: [number, number] = [tailpiece_dim_x, tailpiece_top_y]
    const tailpiece_dim_line = Edge.make_line(tp_dim_p1, tp_dim_p2)
    exporter.add_shape(tailpiece_dim_line, 'dimensions')
    for (const arrow of createDimensionArrows(tp_dim_p1, tp_dim_p2, 3.0)) {
      exporter.add_shape(arrow, 'arrows')
    }
    let tailpiece_text = new Text(
      `${opts.tailpiece_height.toFixed(1)}`,
      DIMENSION_FONT_SIZE,
      FONT_NAME,
    )
    tailpiece_text = tailpiece_text.move(
      new Location([
        tailpiece_dim_x + DIMENSION_FONT_SIZE,
        tailpiece_base_y + opts.tailpiece_height / 2,
      ]),
    )
    exporter.add_shape(tailpiece_text, 'text')
  }

  if (opts.downward_force_percent > 0) {
    const arrow_x = opts.body_stop - 15
    const arrow_mid_y = opts.arching_height + opts.bridge_height / 2
    const arrow_half_length = opts.bridge_height / 4
    const arrow_top_y = arrow_mid_y + arrow_half_length
    const arrow_bottom_y = arrow_mid_y - arrow_half_length

    const arrow_shaft = Edge.make_line([arrow_x, arrow_top_y], [arrow_x, arrow_bottom_y])
    exporter.add_shape(arrow_shaft, 'arrows')

    const arrow_head_size = 2.0
    const arrow_head = new Polygon(
      [
        [arrow_x, arrow_bottom_y],
        [arrow_x - arrow_head_size, arrow_bottom_y + arrow_head_size * 1.5],
        [arrow_x + arrow_head_size, arrow_bottom_y + arrow_head_size * 1.5],
      ],
      true,
    )
    exporter.add_shape(arrow_head, 'arrows')

    const line_height = DIMENSION_FONT_SIZE * 1.2
    const right_edge = arrow_x - 3

    const percent_str = `${opts.downward_force_percent.toFixed(0)}%`
    const percent_char_width = DIMENSION_FONT_SIZE * 0.6
    const percent_width = percent_str.length * percent_char_width
    let percent_text = new Text(percent_str, DIMENSION_FONT_SIZE, FONT_NAME)
    percent_text = percent_text.move(
      new Location([right_edge - percent_width, arrow_mid_y + line_height / 2]),
    )
    exporter.add_shape(percent_text, 'dimensions')

    const downforce_char_width = DIMENSION_FONT_SIZE * 0.5
    const downforce_width = 7 * downforce_char_width
    let downforce_text = new Text('downforce', DIMENSION_FONT_SIZE, FONT_NAME)
    downforce_text = downforce_text.move(
      new Location([right_edge - downforce_width, arrow_mid_y - line_height / 2]),
    )
    exporter.add_shape(downforce_text, 'dimensions')
  }
}

/**
 * Add dimension annotations. Delegates to focused sub-functions.
 */
export function addDimensions(exporter: ExportSVG, opts: SideViewDimensionOpts): void {
  addNutAndOverstandDimensions(exporter, opts)
  addStringDimensions(exporter, opts)
  addBodyDimensions(exporter, opts)
  addTailpieceAndForceDimensions(exporter, opts)
}

// ============================================================================
// drawNeckCrossSection
// ============================================================================

/**
 * Draw the neck cross-section at the body join.
 */
export function drawNeckCrossSection(
  exporter: ExportSVG,
  y_button: number,
  y_top_of_block: number,
  y_fb_bottom: number,
  y_fb_top: number,
  half_button_width: number,
  half_neck_width_at_ribs: number,
  half_fb_width: number,
  fingerboard_radius: number,
  sagitta_at_join: number,
  fb_blend_percent: number = 0.0,
  curve_end_y: number | null = null,
  blend_p0: [number, number] | null = null,
  blend_cp1: [number, number] | null = null,
  blend_cp2: [number, number] | null = null,
  blend_p3: [number, number] | null = null,
  belly_edge_thickness: number = 3.5,
): void {
  // Button line
  const button_line = Edge.make_line(
    [-half_button_width, y_button],
    [half_button_width, y_button],
  )
  exporter.add_shape(button_line, 'drawing')

  // Straight angled sides
  const left_straight = Edge.make_line(
    [-half_button_width, y_button],
    [-half_neck_width_at_ribs, y_top_of_block],
  )
  exporter.add_shape(left_straight, 'drawing')

  const right_straight = Edge.make_line(
    [half_button_width, y_button],
    [half_neck_width_at_ribs, y_top_of_block],
  )
  exporter.add_shape(right_straight, 'drawing')

  const fb_visible_height = y_fb_top - sagitta_at_join
  const effective_curve_end_y = curve_end_y ?? y_fb_bottom

  let fb_side_start_y: number

  if (half_fb_width <= half_neck_width_at_ribs) {
    // Invalid geometry - straight vertical lines
    const left_fillet = Edge.make_line(
      [-half_neck_width_at_ribs, y_top_of_block],
      [-half_fb_width, y_fb_bottom],
    )
    const right_fillet = Edge.make_line(
      [half_neck_width_at_ribs, y_top_of_block],
      [half_fb_width, y_fb_bottom],
    )
    exporter.add_shape(left_fillet, 'drawing')
    exporter.add_shape(right_fillet, 'drawing')
    fb_side_start_y = y_fb_bottom
  } else if (blend_p0 != null && blend_p3 != null && blend_cp1 != null && blend_cp2 != null) {
    // Use pre-calculated cubic bezier
    const left_fillet = Spline.cubic_bezier(
      [-blend_p0[0], blend_p0[1]],
      [-blend_cp1[0], blend_cp1[1]],
      [-blend_cp2[0], blend_cp2[1]],
      [-blend_p3[0], blend_p3[1]],
    )
    exporter.add_shape(left_fillet, 'drawing')

    const right_fillet = Spline.cubic_bezier(
      blend_p0,
      blend_cp1,
      blend_cp2,
      blend_p3,
    )
    exporter.add_shape(right_fillet, 'drawing')
    fb_side_start_y = effective_curve_end_y
  } else {
    // Fallback quadratic approach
    const dx_straight = half_neck_width_at_ribs - half_button_width
    const dy_straight = y_top_of_block - y_button
    let control_y: number
    if (dx_straight > 0) {
      const slope = dy_straight / dx_straight
      const dx_to_fb = half_fb_width - half_neck_width_at_ribs
      control_y = y_top_of_block + slope * dx_to_fb
    } else {
      control_y = (y_top_of_block + y_fb_bottom) / 2
    }

    const left_fillet = Spline.interpolate_three_points(
      [-half_neck_width_at_ribs, y_top_of_block],
      [-half_fb_width, Math.min(control_y, y_fb_bottom - 1)],
      [-half_fb_width, y_fb_bottom],
    )
    exporter.add_shape(left_fillet, 'drawing')

    const right_fillet = Spline.interpolate_three_points(
      [half_neck_width_at_ribs, y_top_of_block],
      [half_fb_width, Math.min(control_y, y_fb_bottom - 1)],
      [half_fb_width, y_fb_bottom],
    )
    exporter.add_shape(right_fillet, 'drawing')
    fb_side_start_y = y_fb_bottom
  }

  // Fingerboard sides
  if (fb_side_start_y < fb_visible_height - 0.01) {
    exporter.add_shape(
      Edge.make_line([-half_fb_width, fb_side_start_y], [-half_fb_width, fb_visible_height]),
      'drawing',
    )
    exporter.add_shape(
      Edge.make_line([half_fb_width, fb_side_start_y], [half_fb_width, fb_visible_height]),
      'drawing',
    )
  }

  // Fingerboard radiused top
  if (fingerboard_radius > 0 && half_fb_width < fingerboard_radius) {
    const vertical_dist = Math.sqrt(
      fingerboard_radius * fingerboard_radius - half_fb_width * half_fb_width,
    )
    const arc_center_y = fb_visible_height - vertical_dist
    const start_angle = Math.atan2(vertical_dist, half_fb_width)
    const end_angle = Math.atan2(vertical_dist, -half_fb_width)

    const fb_top_arc = Arc.make_arc(
      [0, arc_center_y],
      fingerboard_radius,
      start_angle,
      end_angle,
    )
    exporter.add_shape(fb_top_arc, 'drawing')
  } else {
    const fb_top_line = Edge.make_line(
      [-half_fb_width, fb_visible_height],
      [half_fb_width, fb_visible_height],
    )
    exporter.add_shape(fb_top_line, 'drawing')
  }

  // Fingerboard bottom line (only if not fully blended)
  if (fb_blend_percent < 99.9) {
    const fb_bottom_line = Edge.make_line(
      [-half_fb_width, y_fb_bottom],
      [half_fb_width, y_fb_bottom],
    )
    exporter.add_shape(fb_bottom_line, 'drawing')
  }

  const y_belly_top = y_top_of_block + belly_edge_thickness

  // Rib top reference line
  exporter.add_shape(
    Edge.make_line(
      [-half_fb_width - 15, y_top_of_block],
      [half_fb_width + 15, y_top_of_block],
    ),
    'schematic',
  )

  // Belly top line
  exporter.add_shape(
    Edge.make_line(
      [-half_fb_width - 5, y_belly_top],
      [half_fb_width + 5, y_belly_top],
    ),
    'drawing',
  )

  // Fingerboard bottom reference line
  exporter.add_shape(
    Edge.make_line(
      [-half_fb_width - 15, y_fb_bottom],
      [half_fb_width + 15, y_fb_bottom],
    ),
    'schematic',
  )

  // Layer labels
  const label_x = -half_fb_width - 20
  const label_font_size = 3.0

  const neck_root_y = (y_button + y_top_of_block) / 2
  let neck_root_label = new Text('Neck Root', label_font_size, FONT_NAME)
  neck_root_label = neck_root_label.move(new Location([label_x - 15, neck_root_y]))
  exporter.add_shape(neck_root_label, 'dimensions')

  const belly_label_y = (y_top_of_block + y_belly_top) / 2
  let belly_label = new Text('Belly', label_font_size, FONT_NAME)
  belly_label = belly_label.move(new Location([label_x - 15, belly_label_y]))
  exporter.add_shape(belly_label, 'dimensions')

  const overstand_y = (y_belly_top + y_fb_bottom) / 2
  let overstand_label = new Text('Overstand', label_font_size, FONT_NAME)
  overstand_label = overstand_label.move(new Location([label_x - 15, overstand_y]))
  exporter.add_shape(overstand_label, 'dimensions')

  const fb_visible_top = y_fb_top - sagitta_at_join
  const fb_label_y = (y_fb_bottom + fb_visible_top) / 2
  let fb_label = new Text('Fingerboard', label_font_size, FONT_NAME)
  fb_label = fb_label.move(new Location([label_x - 15, fb_label_y]))
  exporter.add_shape(fb_label, 'dimensions')
}

// ============================================================================
// addCrossSectionDimensions
// ============================================================================

/**
 * Add dimension annotations to the cross-section view.
 */
export function addCrossSectionDimensions(
  exporter: ExportSVG,
  show_measurements: boolean,
  y_button: number,
  y_top_of_block: number,
  y_fb_bottom: number,
  y_fb_top: number,
  half_button_width: number,
  half_neck_width_at_ribs: number,
  half_fb_width: number,
  sagitta_at_join: number,
  fb_blend_percent: number = 0.0,
  neck_block_max_width: number | null = null,
): void {
  if (!show_measurements) return

  const dim_offset_y = -8

  // 1. Button width
  const button_line = Edge.make_line(
    [-half_button_width, y_button],
    [half_button_width, y_button],
  )
  const button_width = half_button_width * 2
  addDimensionShapes(exporter, createHorizontalDimension(
    button_line,
    `${button_width.toFixed(1)}`,
    dim_offset_y,
    0,
    DIMENSION_FONT_SIZE,
  ))

  // 2. Neck width at top of ribs
  const neck_line = Edge.make_line(
    [-half_neck_width_at_ribs, y_top_of_block],
    [half_neck_width_at_ribs, y_top_of_block],
  )
  const neck_width = half_neck_width_at_ribs * 2
  addDimensionShapes(exporter, createHorizontalDimension(
    neck_line,
    `${neck_width.toFixed(1)}`,
    dim_offset_y - 8,
    0,
    DIMENSION_FONT_SIZE,
  ))

  // 3. Fingerboard width
  const fb_line = Edge.make_line([-half_fb_width, y_fb_top], [half_fb_width, y_fb_top])
  const fb_width = half_fb_width * 2
  addDimensionShapes(exporter, createHorizontalDimension(
    fb_line,
    `${fb_width.toFixed(1)}`,
    8,
    0,
    DIMENSION_FONT_SIZE,
  ))

  // 4. Neck block max width (when blend > 0 and different from fb_width)
  if (fb_blend_percent > 0.1 && neck_block_max_width != null) {
    const half_block_width = neck_block_max_width / 2.0
    if (Math.abs(half_block_width - half_fb_width) > 0.1) {
      const block_width_line = Edge.make_line(
        [-half_block_width, y_fb_bottom],
        [half_block_width, y_fb_bottom],
      )
      addDimensionShapes(exporter, createHorizontalDimension(
        block_width_line,
        `${neck_block_max_width.toFixed(1)}`,
        dim_offset_y,
        0,
        DIMENSION_FONT_SIZE,
      ))
    }
  }

  // 5. Block height
  const dim_offset_x = half_fb_width + 10
  const block_height = y_top_of_block - y_button
  const block_line = Edge.make_line(
    [dim_offset_x, y_button],
    [dim_offset_x, y_top_of_block],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    block_line,
    `${block_height.toFixed(1)}`,
    5,
    3,
    DIMENSION_FONT_SIZE,
  ))

  // 6. Overstand
  const overstand = y_fb_bottom - y_top_of_block
  const overstand_line = Edge.make_line(
    [dim_offset_x + 15, y_top_of_block],
    [dim_offset_x + 15, y_fb_bottom],
  )
  addDimensionShapes(exporter, createVerticalDimension(
    overstand_line,
    `${overstand.toFixed(1)}`,
    5,
    3,
    DIMENSION_FONT_SIZE,
  ))
}

// ============================================================================
// renderSideView
// ============================================================================

/**
 * Render side view SVG using params and derived values.
 *
 * This is the primary integration point between instrument_geometry.ts
 * and the SVG rendering layer.
 */
export function renderSideView(
  params: Params,
  derived: DerivedValues,
): string {
  const show_measurements = getBoolParam(params, 'show_measurements', true)

  const exporter = setupExporter(show_measurements)

  const instrument_family =
    getStringParam(params, 'instrument_family', 'VIOLIN')

  const body_length = getNumParam(params, 'body_length')
  const belly_edge_thickness = getNumParam(params, 'belly_edge_thickness')
  const rib_height = getNumParam(params, 'rib_height')
  const arching_height = getNumParam(params, 'arching_height')
  const overstand = getNumParam(params, 'overstand')
  const bridge_height = getNumParam(params, 'bridge_height')

  // Draw body
  if (instrument_family === 'VIOL') {
    drawBody(
      exporter,
      body_length,
      belly_edge_thickness,
      rib_height,
      derived['body_stop'] ?? 0,
      arching_height,
      derived['break_end_x'],
      derived['break_end_y'],
    )
    drawViolBack(
      exporter,
      body_length,
      belly_edge_thickness,
      rib_height,
      getNumParam(params, 'top_block_height', 40),
      derived['break_start_x'] ?? 0,
      derived['break_start_y'] ?? 0,
      derived['break_end_x'] ?? 0,
      derived['break_end_y'] ?? 0,
    )
  } else {
    drawBody(
      exporter,
      body_length,
      belly_edge_thickness,
      rib_height,
      derived['body_stop'] ?? 0,
      arching_height,
    )
  }

  // Draw neck
  drawNeck(
    exporter,
    overstand,
    derived['neck_end_x'] ?? 0,
    derived['neck_end_y'] ?? 0,
    bridge_height,
    derived['body_stop'] ?? 0,
    arching_height,
    derived['nut_draw_radius'] ?? 25,
    derived['neck_line_angle'] ?? 0,
    derived['neck_angle'] ?? 0,
  )

  // Draw fingerboard
  const fb_visible_height_at_nut =
    getNumParam(params, 'fb_visible_height_at_nut', 4.5)
  const fb_visible_height_at_join =
    getNumParam(params, 'fb_visible_height_at_join', 4.5)

  drawFingerboard(
    exporter,
    derived['neck_end_x'] ?? 0,
    derived['neck_end_y'] ?? 0,
    derived['fb_bottom_end_x'] ?? 0,
    derived['fb_bottom_end_y'] ?? 0,
    derived['fb_thickness_at_nut'] ?? 0,
    derived['fb_thickness_at_end'] ?? 0,
    derived['fb_direction_angle'] ?? 0,
    fb_visible_height_at_nut,
    fb_visible_height_at_join,
  )

  // Draw string and references
  const [reference_line_end_x, string_line] = drawStringAndReferences(
    exporter,
    derived['nut_top_x'] ?? 0,
    derived['nut_top_y'] ?? 0,
    derived['bridge_top_x'] ?? 0,
    derived['bridge_top_y'] ?? 0,
  )

  // Add document text
  const instrument_name =
    getStringParam(params, 'instrument_name', 'Instrument')
  addDocumentText(
    exporter,
    instrument_name,
    'https://overstand.tools',
    body_length,
    rib_height,
    belly_edge_thickness,
    arching_height,
    bridge_height,
    derived['neck_end_x'] ?? 0,
  )

  // Add dimensions
  addDimensions(exporter, {
    show_measurements,
    reference_line_end_x,
    nut_top_x: derived['nut_top_x'] ?? 0,
    nut_top_y: derived['nut_top_y'] ?? 0,
    bridge_top_x: derived['bridge_top_x'] ?? 0,
    bridge_top_y: derived['bridge_top_y'] ?? 0,
    string_line,
    string_length: derived['string_length'] ?? 0,
    neck_end_x: derived['neck_end_x'] ?? 0,
    neck_end_y: derived['neck_end_y'] ?? 0,
    overstand,
    body_stop: derived['body_stop'] ?? 0,
    arching_height,
    bridge_height,
    body_length,
    rib_height,
    belly_edge_thickness,
    fb_surface_point_x: derived['fb_surface_point_x'] ?? 0,
    fb_surface_point_y: derived['fb_surface_point_y'] ?? 0,
    string_x_at_fb_end: derived['string_x_at_fb_end'] ?? 0,
    string_y_at_fb_end: derived['string_y_at_fb_end'] ?? 0,
    string_height_at_fb_end: derived['string_height_at_fb_end'] ?? 0,
    intersect_x: derived['nut_perpendicular_intersection_x'] ?? 0,
    intersect_y: derived['nut_perpendicular_intersection_y'] ?? 0,
    nut_to_perp_distance: derived['nut_to_perpendicular_distance'] ?? 0,
    tailpiece_height: getNumParam(params, 'tailpiece_height'),
    string_break_angle: derived['string_break_angle'] ?? 0,
    downward_force_percent: derived['downward_force_percent'] ?? 0,
  })

  // Add FB thickness dimensions
  addFbThicknessDimensions(
    exporter,
    show_measurements,
    derived['neck_end_x'] ?? 0,
    derived['neck_end_y'] ?? 0,
    derived['fb_direction_angle'] ?? 0,
    derived['fb_thickness_at_nut'] ?? 0,
    derived['fb_thickness_at_join'] ?? 0,
    derived['neck_stop'] ?? 1,
    derived['fb_fret_1_distance'] ?? 0,
    derived['fb_ref_fret_distance'] ?? 0,
  )

  // Viol-specific back break dimensions
  if (instrument_family === 'VIOL') {
    addViolBackDimensions(
      exporter,
      show_measurements,
      body_length,
      belly_edge_thickness,
      rib_height,
      getNumParam(params, 'top_block_height', 40),
      ((derived['break_angle_rad'] as number) ?? 0) * (180 / Math.PI),
      derived['back_break_length'] ?? 0,
      derived['break_start_x'] ?? 0,
      derived['break_start_y'] ?? 0,
      derived['break_end_x'] ?? 0,
      derived['break_end_y'] ?? 0,
    )
  }

  return exporter.write()
}

// ============================================================================
// renderCrossSectionView
// ============================================================================

/**
 * Render cross-section view SVG.
 */
export function renderCrossSectionView(
  params: Params,
  csGeom: Record<string, number | null | undefined | [number, number]>,
): string {
  const show_measurements = getBoolParam(params, 'show_measurements', true)

  const exporter = setupExporter(show_measurements)

  drawNeckCrossSection(
    exporter,
    (csGeom['y_button'] as number) ?? 0,
    (csGeom['y_top_of_block'] as number) ?? 0,
    (csGeom['y_fb_bottom'] as number) ?? 0,
    (csGeom['y_fb_top'] as number) ?? 0,
    (csGeom['half_button_width'] as number) ?? 0,
    (csGeom['half_neck_width_at_ribs'] as number) ?? 0,
    (csGeom['half_fb_width'] as number) ?? 0,
    (csGeom['fingerboard_radius'] as number) ?? 41,
    (csGeom['sagitta_at_join'] as number) ?? 0,
    (csGeom['fb_blend_percent'] as number) ?? 0,
    (csGeom['curve_end_y'] as number | null) ?? null,
    (csGeom['blend_p0'] as [number, number] | null) ?? null,
    (csGeom['blend_cp1'] as [number, number] | null) ?? null,
    (csGeom['blend_cp2'] as [number, number] | null) ?? null,
    (csGeom['blend_p3'] as [number, number] | null) ?? null,
    (csGeom['belly_edge_thickness'] as number) ?? 3.5,
  )

  addCrossSectionDimensions(
    exporter,
    show_measurements,
    (csGeom['y_button'] as number) ?? 0,
    (csGeom['y_top_of_block'] as number) ?? 0,
    (csGeom['y_fb_bottom'] as number) ?? 0,
    (csGeom['y_fb_top'] as number) ?? 0,
    (csGeom['half_button_width'] as number) ?? 0,
    (csGeom['half_neck_width_at_ribs'] as number) ?? 0,
    (csGeom['half_fb_width'] as number) ?? 0,
    (csGeom['sagitta_at_join'] as number) ?? 0,
    (csGeom['fb_blend_percent'] as number) ?? 0,
    (csGeom['neck_block_max_width'] as number | null) ?? null,
  )

  const instrument_name = getStringParam(params, 'instrument_name', 'Instrument')
  let title_text = new Text(
    `${instrument_name} - Neck Cross-Section`,
    TITLE_FONT_SIZE,
    FONT_NAME,
  )
  const title_y = ((csGeom['y_fb_top'] as number) ?? 0) + 10
  const half_fb_width_val = (csGeom['half_fb_width'] as number) ?? 0
  title_text = title_text.move(
    new Location([-half_fb_width_val, title_y]),
  )
  exporter.add_shape(title_text, 'text')

  return exporter.write()
}
