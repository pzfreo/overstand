/**
 * Overstand - Dimension Helpers (TypeScript port)
 *
 * Dimension annotation helpers for technical drawings.
 * Provides functions to create dimension lines, arrows, and text annotations
 * for horizontal, vertical, diagonal, and angular measurements.
 *
 * Ported from src/dimension_helpers.py
 */

import {
  Edge,
  Arc,
  Text,
  Location,
  Axis,
  FONT_NAME,
  DIMENSION_FONT_SIZE,
} from './buildprimitives'

export { DIMENSION_FONT_SIZE }

type ShapeLayerPair = [Edge | Arc | Text, string]

// ============================================================================
// createDimensionArrows
// ============================================================================

/**
 * Create arrowheads at both ends of a dimension line using edge-based arrows.
 */
export function createDimensionArrows(
  p1: [number, number],
  p2: [number, number],
  arrow_size: number = 3.0,
): Edge[] {
  const [x1, y1] = p1
  const [x2, y2] = p2

  const dx = x2 - x1
  const dy = y2 - y1
  const angle = Math.atan2(dy, dx)

  const arrows: Edge[] = []

  // Arrow at start point
  const arrow1_left: [number, number] = [
    x1 + arrow_size * Math.cos(angle + 2.8),
    y1 + arrow_size * Math.sin(angle + 2.8),
  ]
  const arrow1_right: [number, number] = [
    x1 + arrow_size * Math.cos(angle - 2.8),
    y1 + arrow_size * Math.sin(angle - 2.8),
  ]
  arrows.push(Edge.make_line([x1, y1], arrow1_left))
  arrows.push(Edge.make_line([x1, y1], arrow1_right))

  // Arrow at end point
  const arrow2_left: [number, number] = [
    x2 - arrow_size * Math.cos(angle + 2.8),
    y2 - arrow_size * Math.sin(angle + 2.8),
  ]
  const arrow2_right: [number, number] = [
    x2 - arrow_size * Math.cos(angle - 2.8),
    y2 - arrow_size * Math.sin(angle - 2.8),
  ]
  arrows.push(Edge.make_line([x2, y2], arrow2_left))
  arrows.push(Edge.make_line([x2, y2], arrow2_right))

  return arrows
}

// ============================================================================
// createVerticalDimension
// ============================================================================

/**
 * Create vertical dimension shapes from a vertical feature line.
 */
export function createVerticalDimension(
  feature_line: Edge,
  label: string,
  offset_x: number = 8,
  extension_length: number = 3,
  font_size: number = DIMENSION_FONT_SIZE,
  arrow_size: number = 3.0,
): ShapeLayerPair[] {
  const x = feature_line.position_at(0).X
  const y_start = feature_line.position_at(0).Y
  const y_end = feature_line.position_at(1).Y

  const shapes: ShapeLayerPair[] = []

  const ext_x = x + offset_x
  const ext1 = Edge.make_line([x, y_start], [ext_x + extension_length, y_start])
  shapes.push([ext1, 'extensions'])
  const ext2 = Edge.make_line([x, y_end], [ext_x + extension_length, y_end])
  shapes.push([ext2, 'extensions'])

  const dim_p1: [number, number] = [ext_x, y_start]
  const dim_p2: [number, number] = [ext_x, y_end]
  const dim_line = Edge.make_line(dim_p1, dim_p2)
  shapes.push([dim_line, 'dimensions'])

  const arrows = createDimensionArrows(dim_p1, dim_p2, arrow_size)
  for (const arrow of arrows) {
    shapes.push([arrow, 'arrows'])
  }

  let text = new Text(label, font_size, FONT_NAME)
  const text_offset = font_size
  text = text.move(new Location([ext_x + text_offset, (y_start + y_end) / 2]))
  shapes.push([text, 'extensions'])

  return shapes
}

// ============================================================================
// createDiagonalDimension
// ============================================================================

/**
 * Create diagonal dimension shapes from a diagonal feature line.
 */
export function createDiagonalDimension(
  feature_line: Edge,
  label: string,
  offset_distance: number = 8,
  extension_length: number = 3,
  font_size: number = DIMENSION_FONT_SIZE,
  arrow_size: number = 3.0,
): ShapeLayerPair[] {
  const p1 = feature_line.position_at(0)
  const p2 = feature_line.position_at(1)
  const x1 = p1.X
  const y1 = p1.Y
  const x2 = p2.X
  const y2 = p2.Y

  const shapes: ShapeLayerPair[] = []

  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)

  const perp_x = -dy / length
  const perp_y = dx / length

  const offset_x1 = x1 + perp_x * offset_distance
  const offset_y1 = y1 + perp_y * offset_distance
  const offset_x2 = x2 + perp_x * offset_distance
  const offset_y2 = y2 + perp_y * offset_distance

  const ext1_end_x = offset_x1 + perp_x * extension_length
  const ext1_end_y = offset_y1 + perp_y * extension_length
  shapes.push([Edge.make_line([x1, y1], [ext1_end_x, ext1_end_y]), 'extensions'])

  const ext2_end_x = offset_x2 + perp_x * extension_length
  const ext2_end_y = offset_y2 + perp_y * extension_length
  shapes.push([Edge.make_line([x2, y2], [ext2_end_x, ext2_end_y]), 'extensions'])

  const dim_p1: [number, number] = [offset_x1, offset_y1]
  const dim_p2: [number, number] = [offset_x2, offset_y2]
  shapes.push([Edge.make_line(dim_p1, dim_p2), 'dimensions'])

  const arrows = createDimensionArrows(dim_p1, dim_p2, arrow_size)
  for (const arrow of arrows) {
    shapes.push([arrow, 'arrows'])
  }

  const center_x = (offset_x1 + offset_x2) / 2
  const center_y = (offset_y1 + offset_y2) / 2
  const text_offset = font_size * 0.5
  const text_x = center_x + perp_x * text_offset
  const text_y = center_y + perp_y * text_offset

  let angle_rad = Math.atan2(-dy, dx)
  let angle_deg = (angle_rad * 180) / Math.PI
  if (angle_deg > 90) angle_deg -= 180
  else if (angle_deg < -90) angle_deg += 180

  let text = new Text(label, font_size, FONT_NAME)
  text = text.move(new Location([text_x, text_y]))
  text = text.rotate(new Axis([text_x, text_y, 0], [0, 0, 1]), angle_deg)
  shapes.push([text, 'extensions'])

  return shapes
}

// ============================================================================
// createHorizontalDimension
// ============================================================================

/**
 * Create horizontal dimension shapes from a horizontal feature line.
 */
export function createHorizontalDimension(
  feature_line: Edge,
  label: string,
  offset_y: number = -10,
  extension_length: number = 0,
  font_size: number = DIMENSION_FONT_SIZE,
  arrow_size: number = 3.0,
): ShapeLayerPair[] {
  const x_start = feature_line.position_at(0).X
  const x_end = feature_line.position_at(1).X
  const y = feature_line.position_at(0).Y

  const shapes: ShapeLayerPair[] = []

  if (extension_length > 0) {
    shapes.push([
      Edge.make_line([x_start, y], [x_start, y + offset_y + extension_length]),
      'extensions',
    ])
    shapes.push([
      Edge.make_line([x_end, y], [x_end, y + offset_y + extension_length]),
      'extensions',
    ])
  }

  const dim_y = extension_length > 0 ? y + offset_y : y
  const dim_p1: [number, number] = [x_start, dim_y]
  const dim_p2: [number, number] = [x_end, dim_y]
  shapes.push([Edge.make_line(dim_p1, dim_p2), 'dimensions'])

  const arrows = createDimensionArrows(dim_p1, dim_p2, arrow_size)
  for (const arrow of arrows) {
    shapes.push([arrow, 'arrows'])
  }

  let text = new Text(label, font_size, FONT_NAME)
  const text_offset = font_size
  text = text.move(
    new Location([(x_start + x_end) / 2 - 10, dim_y - text_offset]),
  )
  shapes.push([text, 'extensions'])

  return shapes
}

// ============================================================================
// createAngleDimension
// ============================================================================

/**
 * Create angle dimension shapes from two lines that meet at a junction point.
 */
export function createAngleDimension(
  line1: Edge,
  line2: Edge,
  label: string | null = null,
  arc_radius: number = 15,
  font_size: number = DIMENSION_FONT_SIZE,
  line_extension: number = 5,
  text_inside: boolean = false,
  arc_reference_lines: boolean = false,
): ShapeLayerPair[] {
  const shapes: ShapeLayerPair[] = []

  const line1_p1: [number, number] = [line1.position_at(0).X, line1.position_at(0).Y]
  const line1_p2: [number, number] = [line1.position_at(1).X, line1.position_at(1).Y]
  const line2_p1: [number, number] = [line2.position_at(0).X, line2.position_at(0).Y]
  const line2_p2: [number, number] = [line2.position_at(1).X, line2.position_at(1).Y]

  const dist = (a: [number, number], b: [number, number]): number =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

  const tolerance = 0.01

  let junction: [number, number]
  let dir1_point: [number, number]
  let dir2_point: [number, number]

  if (dist(line1_p1, line2_p1) < tolerance) {
    junction = line1_p1; dir1_point = line1_p2; dir2_point = line2_p2
  } else if (dist(line1_p1, line2_p2) < tolerance) {
    junction = line1_p1; dir1_point = line1_p2; dir2_point = line2_p1
  } else if (dist(line1_p2, line2_p1) < tolerance) {
    junction = line1_p2; dir1_point = line1_p1; dir2_point = line2_p2
  } else if (dist(line1_p2, line2_p2) < tolerance) {
    junction = line1_p2; dir1_point = line1_p1; dir2_point = line2_p1
  } else {
    junction = line1_p2; dir1_point = line1_p1; dir2_point = line2_p1
  }

  const [jx, jy] = junction

  const angle1 = Math.atan2(dir1_point[1] - jy, dir1_point[0] - jx)
  const angle2 = Math.atan2(dir2_point[1] - jy, dir2_point[0] - jx)

  const angle_diff = angle2 - angle1
  let angle_deg = ((angle_diff * 180) / Math.PI) % 360
  if (angle_deg > 180) angle_deg = 360 - angle_deg

  const effective_label = label !== null ? label : `${angle_deg.toFixed(1)}°`

  if (line_extension > 0) {
    const dx1 = dir1_point[0] - jx
    const dy1 = dir1_point[1] - jy
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    if (len1 > 0) {
      const ext1_point: [number, number] = [
        dir1_point[0] + (dx1 / len1) * line_extension,
        dir1_point[1] + (dy1 / len1) * line_extension,
      ]
      shapes.push([Edge.make_line(junction, ext1_point), 'extensions'])
    }

    const dx2 = dir2_point[0] - jx
    const dy2 = dir2_point[1] - jy
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
    if (len2 > 0) {
      const ext2_point: [number, number] = [
        dir2_point[0] + (dx2 / len2) * line_extension,
        dir2_point[1] + (dy2 / len2) * line_extension,
      ]
      shapes.push([Edge.make_line(junction, ext2_point), 'extensions'])
    }
  }

  let start_angle = Math.min(angle1, angle2)
  let end_angle = Math.max(angle1, angle2)
  if (end_angle - start_angle > Math.PI) {
    ;[start_angle, end_angle] = [end_angle, start_angle + 2 * Math.PI]
  }

  const angle_arc = Arc.make_arc(
    [jx, jy],
    arc_radius,
    start_angle,
    end_angle,
  )
  shapes.push([angle_arc, 'dimensions'])

  if (arc_reference_lines) {
    const arc_start_x = jx + arc_radius * Math.cos(start_angle)
    const arc_start_y = jy + arc_radius * Math.sin(start_angle)
    shapes.push([Edge.make_line(junction, [arc_start_x, arc_start_y]), 'dimensions'])

    const arc_end_x = jx + arc_radius * Math.cos(end_angle)
    const arc_end_y = jy + arc_radius * Math.sin(end_angle)
    shapes.push([Edge.make_line(junction, [arc_end_x, arc_end_y]), 'dimensions'])
  }

  const mid_angle = (start_angle + end_angle) / 2
  const text_radius = text_inside ? arc_radius * 0.3 : arc_radius + font_size * 1.5
  const text_x = jx + text_radius * Math.cos(mid_angle)
  const text_y = jy + text_radius * Math.sin(mid_angle)

  let text = new Text(effective_label, font_size, FONT_NAME)
  const text_width_approx = effective_label.length * font_size * 0.6
  text = text.move(
    new Location([text_x - text_width_approx / 2, text_y - font_size / 2]),
  )
  shapes.push([text, 'extensions'])

  return shapes
}
