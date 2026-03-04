/**
 * Overstand - Build Primitives (TypeScript port)
 *
 * Minimal SVG generation shim providing the drawing primitives needed for
 * generating SVG diagrams without requiring a full CAD library.
 *
 * Ported from src/buildprimitives.py
 */

import { toRgbString } from './utils'

// ============================================================================
// Font Configuration
// ============================================================================

/** Points to millimeters conversion factor */
export const PTS_MM = 0.352778

/** Font name - browser will use Roboto if available, fallback to Arial/sans-serif */
export const FONT_NAME = 'Roboto'

/** Standard font sizes (in millimeters) */
export const DIMENSION_FONT_SIZE = 8 * PTS_MM   // ~2.82 mm for dimension annotations
export const TITLE_FONT_SIZE = 14 * PTS_MM      // ~4.94 mm for instrument name
export const FOOTER_FONT_SIZE = 6 * PTS_MM      // ~2.12 mm for generator URL

// ============================================================================
// Point
// ============================================================================

export class Point {
  X: number
  Y: number

  constructor(x: number, y: number) {
    this.X = x
    this.Y = y
  }
}

// ============================================================================
// Enums
// ============================================================================

export enum LineType {
  CONTINUOUS = 'continuous',
  DASHED = 'dashed',
  DOTTED = 'dotted',
  HIDDEN = 'hidden',
}

export enum Unit {
  MM = 'mm',
}

// ============================================================================
// Axis
// ============================================================================

export class Axis {
  position: [number, number, number]
  direction: [number, number, number]

  constructor(
    position: [number, number, number],
    direction: [number, number, number],
  ) {
    this.position = position
    this.direction = direction
  }
}

// ============================================================================
// Location
// ============================================================================

export class Location {
  x: number
  y: number

  constructor(position: [number, number]) {
    this.x = position[0]
    this.y = position[1]
  }
}

// ============================================================================
// Edge
// ============================================================================

export class Edge {
  p1: [number, number]
  p2: [number, number]

  constructor(p1: [number, number], p2: [number, number]) {
    this.p1 = p1
    this.p2 = p2
  }

  static make_line(p1: [number, number], p2: [number, number]): Edge {
    return new Edge(p1, p2)
  }

  position_at(t: number): Point {
    if (t === 0) {
      return new Point(this.p1[0], this.p1[1])
    } else {
      return new Point(this.p2[0], this.p2[1])
    }
  }

  to_svg_path(): string {
    return `M ${this.p1[0]},${this.p1[1]} L ${this.p2[0]},${this.p2[1]}`
  }
}

// ============================================================================
// Arc
// ============================================================================

export class Arc {
  center: [number, number]
  radius: number
  start_angle: number
  end_angle: number

  constructor(
    center: [number, number],
    radius: number,
    start_angle: number,
    end_angle: number,
  ) {
    this.center = center
    this.radius = radius
    this.start_angle = start_angle
    this.end_angle = end_angle
  }

  static make_arc(
    center: [number, number],
    radius: number,
    start_angle: number,
    end_angle: number,
  ): Arc {
    return new Arc(center, radius, start_angle, end_angle)
  }

  position_at(t: number): Point {
    const angle = this.start_angle + t * (this.end_angle - this.start_angle)
    const x = this.center[0] + this.radius * Math.cos(angle)
    const y = this.center[1] + this.radius * Math.sin(angle)
    return new Point(x, y)
  }

  to_svg_path(): string {
    const start_x = this.center[0] + this.radius * Math.cos(this.start_angle)
    const start_y = this.center[1] + this.radius * Math.sin(this.start_angle)
    const end_x = this.center[0] + this.radius * Math.cos(this.end_angle)
    const end_y = this.center[1] + this.radius * Math.sin(this.end_angle)

    let angle_diff = this.end_angle - this.start_angle
    // Normalize to 0..2π range
    while (angle_diff < 0) angle_diff += 2 * Math.PI
    while (angle_diff > 2 * Math.PI) angle_diff -= 2 * Math.PI

    const large_arc_flag = angle_diff > Math.PI ? 1 : 0
    const sweep_flag = 1  // Always sweep in positive angle direction

    return (
      `M ${start_x},${start_y} A ${this.radius},${this.radius} 0 ` +
      `${large_arc_flag} ${sweep_flag} ${end_x},${end_y}`
    )
  }
}

// ============================================================================
// Rectangle
// ============================================================================

export class Rectangle {
  width: number
  height: number
  x: number
  y: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.x = 0
    this.y = 0
  }

  move(location: Location): Rectangle {
    const rect = new Rectangle(this.width, this.height)
    rect.x = location.x
    rect.y = location.y
    return rect
  }

  to_svg_path(): string {
    const x1 = this.x - this.width / 2
    const y1 = this.y - this.height / 2
    const x2 = this.x + this.width / 2
    const y2 = this.y + this.height / 2
    return `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`
  }
}

// ============================================================================
// Spline
// ============================================================================

export class Spline {
  points: Array<[number, number]>
  _is_cubic: boolean

  constructor(...points: Array<[number, number]>) {
    this.points = points
    this._is_cubic = false
  }

  static interpolate_three_points(
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
  ): Spline {
    // Calculate control point: Q1 = 2*P1 - 0.5*P0 - 0.5*P2
    const control_x = 2 * p1[0] - 0.5 * p0[0] - 0.5 * p2[0]
    const control_y = 2 * p1[1] - 0.5 * p0[1] - 0.5 * p2[1]
    return new Spline(p0, [control_x, control_y], p2)
  }

  static cubic_bezier(
    p0: [number, number],
    cp1: [number, number],
    cp2: [number, number],
    p3: [number, number],
  ): Spline {
    const spline = new Spline(p0, cp1, cp2, p3)
    spline._is_cubic = true
    return spline
  }

  to_svg_path(): string {
    if (this.points.length < 2) return ''

    const p0 = this.points[0]!
    let path = `M ${p0[0]},${p0[1]}`

    if (this.points.length === 2) {
      const p1 = this.points[1]!
      path += ` L ${p1[0]},${p1[1]}`
    } else if (this.points.length === 3) {
      const p1 = this.points[1]!
      const p2 = this.points[2]!
      path += ` Q ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
    } else if (this.points.length === 4 && this._is_cubic) {
      const p1 = this.points[1]!
      const p2 = this.points[2]!
      const p3 = this.points[3]!
      path += ` C ${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`
    } else {
      for (let i = 1; i < this.points.length - 1; i++) {
        const pi = this.points[i]!
        const pNext = this.points[i + 1]!
        path += ` Q ${pi[0]},${pi[1]} ${pNext[0]},${pNext[1]}`
      }
    }

    return path
  }
}

// ============================================================================
// Polygon
// ============================================================================

export class Polygon {
  vertices: Array<[number, number]>
  x: number
  y: number
  filled: boolean
  fill_pattern: string | null

  constructor(
    points: Array<[number, number]>,
    filled: boolean = false,
    fill_pattern: string | null = null,
  ) {
    this.vertices = points
    this.x = 0
    this.y = 0
    this.filled = filled
    this.fill_pattern = fill_pattern
  }

  move(location: Location): Polygon {
    const poly = new Polygon(this.vertices, this.filled, this.fill_pattern)
    poly.x = location.x
    poly.y = location.y
    return poly
  }

  to_svg_path(): string {
    if (this.vertices.length < 3) return ''

    const v0 = this.vertices[0]!
    let path = `M ${v0[0] + this.x},${v0[1] + this.y}`
    for (let i = 1; i < this.vertices.length; i++) {
      const v = this.vertices[i]!
      path += ` L ${v[0] + this.x},${v[1] + this.y}`
    }
    path += ' Z'
    return path
  }
}

// ============================================================================
// make_face
// ============================================================================

export function make_face(shape: Polygon): Polygon {
  const newShape = new Polygon(shape.vertices, true, shape.fill_pattern)
  newShape.x = shape.x
  newShape.y = shape.y
  return newShape
}

// ============================================================================
// Text
// ============================================================================

export class Text {
  text: string
  font_size: number
  font: string
  x: number
  y: number
  rotation: number
  rotation_center: [number, number]

  constructor(text: string, font_size: number, font: string = FONT_NAME) {
    this.text = text
    this.font_size = font_size
    this.font = font
    this.x = 0
    this.y = 0
    this.rotation = 0
    this.rotation_center = [0, 0]
  }

  move(location: Location): Text {
    const t = new Text(this.text, this.font_size, this.font)
    t.x = location.x
    t.y = location.y
    t.rotation = this.rotation
    t.rotation_center = this.rotation_center
    return t
  }

  rotate(axis: Axis, angle: number): Text {
    const t = new Text(this.text, this.font_size, this.font)
    t.x = this.x
    t.y = this.y
    t.rotation = angle
    t.rotation_center = [axis.position[0], axis.position[1]]
    return t
  }

  to_svg(
    fill_color?: [number, number, number] | null,
    y_flipped: boolean = false,
  ): string {
    const color = fill_color
      ? toRgbString(fill_color)
      : 'black'

    if (y_flipped) {
      const transforms: string[] = []
      transforms.push(`translate(${this.x} ${this.y})`)
      transforms.push('scale(1 -1)')
      if (this.rotation !== 0) {
        transforms.push(`rotate(${this.rotation})`)
      }
      const transform_str = ` transform="${transforms.join(' ')}"`
      return (
        `<text x="0" y="0" ` +
        `font-family="${this.font}, Arial, sans-serif" font-size="${this.font_size}" ` +
        `fill="${color}" text-anchor="middle" dominant-baseline="middle"` +
        `${transform_str}>${this.text}</text>`
      )
    } else {
      let transform = ''
      if (this.rotation !== 0) {
        transform = ` transform="rotate(${this.rotation} ${this.rotation_center[0]} ${this.rotation_center[1]})"`
      }
      return (
        `<text x="${this.x}" y="${this.y}" ` +
        `font-family="${this.font}, Arial, sans-serif" font-size="${this.font_size}" ` +
        `fill="${color}" text-anchor="middle" dominant-baseline="middle"` +
        `${transform}>${this.text}</text>`
      )
    }
  }
}

// ============================================================================
// ExportSVG
// ============================================================================

interface LayerConfig {
  fill_color: [number, number, number] | null
  line_color: [number, number, number] | null
  line_type: LineType
}

type Shape = Edge | Arc | Rectangle | Spline | Polygon | Text

export class ExportSVG {
  scale: number
  unit: Unit
  line_weight: number
  layers: Map<string, LayerConfig>
  shapes: Array<[Shape, string]>
  margin: number

  constructor(
    scale: number = 1.0,
    unit: Unit = Unit.MM,
    line_weight: number = 0.5,
  ) {
    this.scale = scale
    this.unit = unit
    this.line_weight = line_weight
    this.layers = new Map()
    this.shapes = []
    this.margin = 20  // mm
  }

  add_layer(
    name: string,
    fill_color: [number, number, number] | null = null,
    line_color: [number, number, number] | null = null,
    line_type: LineType = LineType.CONTINUOUS,
  ): void {
    this.layers.set(name, { fill_color, line_color, line_type })
  }

  add_shape(shape: Shape, layer: string = 'default'): void {
    this.shapes.push([shape, layer])
  }

  private _get_stroke_style(layer_name: string): string {
    const layer = this.layers.get(layer_name)
    if (!layer) {
      return `stroke="black" stroke-width="${this.line_weight}" fill="none"`
    }

    const { line_color } = layer
    if (line_color === null) {
      return 'stroke="none" fill="none"'
    }

    const color = toRgbString(line_color)

    let stroke_dasharray = ''
    if (layer.line_type === LineType.DASHED) {
      stroke_dasharray = ' stroke-dasharray="5,3"'
    } else if (layer.line_type === LineType.DOTTED) {
      stroke_dasharray = ' stroke-dasharray="1,2"'
    } else if (layer.line_type === LineType.HIDDEN) {
      stroke_dasharray = ' stroke-dasharray="2,2"'
    }

    return `stroke="${color}" stroke-width="${this.line_weight}" fill="none"${stroke_dasharray}`
  }

  private _calculate_bounds(): [number, number, number, number] {
    let min_x = Infinity
    let min_y = Infinity
    let max_x = -Infinity
    let max_y = -Infinity

    for (const [shape] of this.shapes) {
      if (shape instanceof Edge) {
        min_x = Math.min(min_x, shape.p1[0], shape.p2[0])
        max_x = Math.max(max_x, shape.p1[0], shape.p2[0])
        min_y = Math.min(min_y, shape.p1[1], shape.p2[1])
        max_y = Math.max(max_y, shape.p1[1], shape.p2[1])
      } else if (shape instanceof Rectangle) {
        const x1 = shape.x - shape.width / 2
        const x2 = shape.x + shape.width / 2
        const y1 = shape.y - shape.height / 2
        const y2 = shape.y + shape.height / 2
        min_x = Math.min(min_x, x1, x2)
        max_x = Math.max(max_x, x1, x2)
        min_y = Math.min(min_y, y1, y2)
        max_y = Math.max(max_y, y1, y2)
      } else if (shape instanceof Spline) {
        const pts = shape.points
        if (pts.length === 4 && shape._is_cubic) {
          // Sample cubic bezier for bounds
          for (let ti = 0; ti <= 10; ti++) {
            const t = ti / 10
            const mt = 1 - t
            const mt2 = mt * mt
            const mt3 = mt2 * mt
            const t2 = t * t
            const t3 = t2 * t
            const px =
              mt3 * pts[0]![0] +
              3 * mt2 * t * pts[1]![0] +
              3 * mt * t2 * pts[2]![0] +
              t3 * pts[3]![0]
            const py =
              mt3 * pts[0]![1] +
              3 * mt2 * t * pts[1]![1] +
              3 * mt * t2 * pts[2]![1] +
              t3 * pts[3]![1]
            min_x = Math.min(min_x, px)
            max_x = Math.max(max_x, px)
            min_y = Math.min(min_y, py)
            max_y = Math.max(max_y, py)
          }
        } else {
          for (const p of pts) {
            min_x = Math.min(min_x, p[0])
            max_x = Math.max(max_x, p[0])
            min_y = Math.min(min_y, p[1])
            max_y = Math.max(max_y, p[1])
          }
        }
      } else if (shape instanceof Polygon) {
        for (const p of shape.vertices) {
          const px = p[0] + shape.x
          const py = p[1] + shape.y
          min_x = Math.min(min_x, px)
          max_x = Math.max(max_x, px)
          min_y = Math.min(min_y, py)
          max_y = Math.max(max_y, py)
        }
      } else if (shape instanceof Arc) {
        // Start and end points
        const points: Array<[number, number]> = [
          [
            shape.center[0] + shape.radius * Math.cos(shape.start_angle),
            shape.center[1] + shape.radius * Math.sin(shape.start_angle),
          ],
          [
            shape.center[0] + shape.radius * Math.cos(shape.end_angle),
            shape.center[1] + shape.radius * Math.sin(shape.end_angle),
          ],
        ]
        // Check arc extrema
        for (const crit_angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
          const start = ((shape.start_angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
          const end = ((shape.end_angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
          const crit = ((crit_angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
          if (start <= end) {
            if (start <= crit && crit <= end) {
              points.push([
                shape.center[0] + shape.radius * Math.cos(crit_angle),
                shape.center[1] + shape.radius * Math.sin(crit_angle),
              ])
            }
          } else {
            if (crit >= start || crit <= end) {
              points.push([
                shape.center[0] + shape.radius * Math.cos(crit_angle),
                shape.center[1] + shape.radius * Math.sin(crit_angle),
              ])
            }
          }
        }
        for (const [px, py] of points) {
          min_x = Math.min(min_x, px)
          max_x = Math.max(max_x, px)
          min_y = Math.min(min_y, py)
          max_y = Math.max(max_y, py)
        }
      } else if (shape instanceof Text) {
        const text_width = shape.text.length * shape.font_size * 0.6
        const text_height = shape.font_size
        min_x = Math.min(min_x, shape.x - text_width / 2)
        max_x = Math.max(max_x, shape.x + text_width / 2)
        min_y = Math.min(min_y, shape.y - text_height / 2)
        max_y = Math.max(max_y, shape.y + text_height / 2)
      }
    }

    // Add margin
    min_x -= this.margin
    min_y -= this.margin
    max_x += this.margin
    max_y += this.margin

    return [min_x, min_y, max_x, max_y]
  }

  private _get_pattern_defs(): string {
    return `<defs>
    <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="2" height="2">
        <path d="M0,2 L2,0" stroke="black" stroke-width="0.3" />
    </pattern>
</defs>`
  }

  write(filename?: string): string {
    const [min_x, min_y, max_x, max_y] = this._calculate_bounds()
    const width = max_x - min_x
    const height = max_y - min_y

    const svg_parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="${min_x} ${-max_y} ${width} ${height}" ` +
        `width="${width}${this.unit}" height="${height}${this.unit}">`,
      this._get_pattern_defs(),
      `<g transform="scale(1,-1)">`,
    ]

    for (const [shape, layer_name] of this.shapes) {
      // Check if layer is invisible (skip all shapes on invisible layers)
      const layer = this.layers.get(layer_name)
      if (layer) {
        const { fill_color, line_color } = layer
        if (fill_color === null && line_color === null) {
          continue
        }
      }

      if (
        shape instanceof Edge ||
        shape instanceof Arc ||
        shape instanceof Rectangle ||
        shape instanceof Spline ||
        shape instanceof Polygon
      ) {
        let style = this._get_stroke_style(layer_name)

        if (shape instanceof Polygon && shape.filled) {
          let fill: string
          if (shape.fill_pattern) {
            fill = `url(#${shape.fill_pattern})`
          } else {
            const layerCfg = this.layers.get(layer_name)
            if (layerCfg?.fill_color) {
              const fc = layerCfg.fill_color
              fill = toRgbString(fc)
            } else {
              fill = 'black'
            }
          }
          style = style.replace('fill="none"', `fill="${fill}"`)
        }

        svg_parts.push(`<path d="${shape.to_svg_path()}" ${style}/>`)
      } else if (shape instanceof Text) {
        const layerCfg = this.layers.get(layer_name)
        if (layerCfg) {
          const text_color = layerCfg.fill_color ?? layerCfg.line_color ?? null
          svg_parts.push(shape.to_svg(text_color, true))
        } else {
          svg_parts.push(shape.to_svg(null, true))
        }
      }
    }

    svg_parts.push('</g>')
    svg_parts.push('</svg>')

    const svg_content = svg_parts.join('\n')

    if (filename) {
      // In browser context, cannot write to files directly.
      // In Node/test context this could be added, but mirrors Python behavior.
      // eslint-disable-next-line no-console
      console.warn('ExportSVG.write: filename parameter is ignored in TypeScript port')
    }

    return svg_content
  }
}
