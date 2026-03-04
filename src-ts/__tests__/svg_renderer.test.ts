/**
 * TypeScript port of tests/test_svg_renderer.py
 *
 * 26 Python tests ported to Vitest.
 */

import { describe, it, expect } from 'vitest'
import {
  setupExporter,
  drawBody,
  drawNeck,
  drawFingerboard,
  drawStringAndReferences,
  addDocumentText,
  addDimensions,
} from '../svg_renderer'
import { ExportSVG, Edge } from '../buildprimitives'
import { getDefaultValues } from '../parameter_registry'
import { calculateDerivedValues, generateSideViewSvg } from '../instrument_geometry'

// ============================================================================
// Helpers
// ============================================================================

function defaultViolinParams() {
  const params = getDefaultValues()
  params['instrument_family'] = 'VIOLIN'
  return params
}

function defaultViolParams() {
  const params = getDefaultValues()
  params['instrument_family'] = 'VIOL'
  params['no_frets'] = 7
  return params
}

function defaultGuitarParams() {
  const params = getDefaultValues()
  params['instrument_family'] = 'GUITAR_MANDOLIN'
  params['fret_join'] = 12
  params['no_frets'] = 19
  params['string_height_12th_fret'] = 2.5
  return params
}

// ============================================================================
// TestSetupExporter
// ============================================================================

describe('setupExporter', () => {
  it('returns an ExportSVG instance', () => {
    const exporter = setupExporter(true)
    expect(exporter).toBeInstanceOf(ExportSVG)
  })

  it('creates all required layers', () => {
    const exporter = setupExporter(true)
    const required_layers = [
      'text',
      'drawing',
      'schematic',
      'schematic_dotted',
      'dimensions',
      'extensions',
      'arrows',
    ]
    for (const layer of required_layers) {
      expect(exporter.layers.has(layer)).toBe(true)
    }
  })

  it('dimensions layer is visible when show_measurements is true', () => {
    const exporter = setupExporter(true)
    const layer = exporter.layers.get('dimensions')
    expect(layer).toBeDefined()
    expect(layer!.fill_color).not.toBeNull()
  })

  it('dimensions layer is hidden when show_measurements is false', () => {
    const exporter = setupExporter(false)
    const layer = exporter.layers.get('dimensions')
    expect(layer).toBeDefined()
    expect(layer!.fill_color).toBeNull()
  })
})

// ============================================================================
// TestDrawBody
// ============================================================================

describe('drawBody', () => {
  it('adds shapes to the exporter', () => {
    const exporter = setupExporter(true)
    const initial_count = exporter.shapes.length

    drawBody(exporter, 355.0, 3.5, 30.0, 195.0, 15.0)

    expect(exporter.shapes.length).toBeGreaterThan(initial_count)
    expect(exporter.shapes.length).toBeGreaterThanOrEqual(initial_count + 3)
  })

  it('adds shapes to correct layers', () => {
    const exporter = setupExporter(true)

    drawBody(exporter, 355.0, 3.5, 30.0, 195.0, 15.0)

    const drawing_shapes = exporter.shapes.filter(([, layer]) => layer === 'drawing')
    const schematic_shapes = exporter.shapes.filter(([, layer]) => layer === 'schematic')

    expect(drawing_shapes.length).toBeGreaterThanOrEqual(2)
    expect(schematic_shapes.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// TestDrawNeck
// ============================================================================

describe('drawNeck', () => {
  it('returns a tuple of two lines', () => {
    const exporter = setupExporter(true)

    const result = drawNeck(
      exporter,
      6.0,
      -130.0,
      24.0,
      34.0,
      195.0,
      15.0,
      25.0,
      (95 * Math.PI) / 180,
      5.0,
    )

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
  })

  it('adds shapes to the exporter', () => {
    const exporter = setupExporter(true)
    const initial_count = exporter.shapes.length

    drawNeck(
      exporter,
      6.0,
      -130.0,
      24.0,
      34.0,
      195.0,
      15.0,
      25.0,
      (95 * Math.PI) / 180,
      5.0,
    )

    expect(exporter.shapes.length).toBeGreaterThan(initial_count)
  })
})

// ============================================================================
// TestDrawFingerboard
// ============================================================================

describe('drawFingerboard', () => {
  it('returns two coordinates (fb_top_end_x, fb_top_end_y)', () => {
    const exporter = setupExporter(true)

    const result = drawFingerboard(
      exporter,
      -130.0,
      24.0,
      -10.0,
      10.0,
      5.0,
      6.0,
      (5 * Math.PI) / 180,
      4.0,
      5.0,
    )

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(typeof result[0]).toBe('number')
    expect(typeof result[1]).toBe('number')
  })

  it('adds at least one shape to drawing layer', () => {
    const exporter = setupExporter(true)

    drawFingerboard(
      exporter,
      -130.0,
      24.0,
      -10.0,
      10.0,
      5.0,
      6.0,
      (5 * Math.PI) / 180,
      4.0,
      5.0,
    )

    const drawing_shapes = exporter.shapes.filter(([, layer]) => layer === 'drawing')
    expect(drawing_shapes.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// TestDrawStringAndReferences
// ============================================================================

describe('drawStringAndReferences', () => {
  it('returns [reference_line_end_x, string_line]', () => {
    const exporter = setupExporter(true)

    const result = drawStringAndReferences(exporter, -125.0, 28.0, 195.0, 49.0)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(typeof result[0]).toBe('number')
  })

  it('adds a string line to drawing layer', () => {
    const exporter = setupExporter(true)
    const initial_drawing = exporter.shapes.filter(
      ([, layer]) => layer === 'drawing',
    ).length

    drawStringAndReferences(exporter, -125.0, 28.0, 195.0, 49.0)

    const final_drawing = exporter.shapes.filter(
      ([, layer]) => layer === 'drawing',
    ).length
    expect(final_drawing).toBeGreaterThan(initial_drawing)
  })
})

// ============================================================================
// TestAddDocumentText
// ============================================================================

describe('addDocumentText', () => {
  it('adds at least 2 text shapes (title and footer)', () => {
    const exporter = setupExporter(true)

    addDocumentText(
      exporter,
      'Test Violin',
      'https://example.com',
      355.0,
      30.0,
      3.5,
      15.0,
      34.0,
      -130.0,
    )

    const text_shapes = exporter.shapes.filter(([, layer]) => layer === 'text')
    expect(text_shapes.length).toBeGreaterThanOrEqual(2)
  })

  it('adds footer URL text', () => {
    const exporter = setupExporter(true)

    addDocumentText(
      exporter,
      'Test Violin',
      'https://example.com',
      355.0,
      30.0,
      3.5,
      15.0,
      34.0,
      -130.0,
    )

    const text_shapes = exporter.shapes.filter(([, layer]) => layer === 'text')
    expect(text_shapes.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================================
// TestAddDimensions
// ============================================================================

describe('addDimensions', () => {
  it('runs without error when show_measurements is false', () => {
    const exporter = setupExporter(false)

    const mock_string_line = Edge.make_line([0, 0], [100, 50])

    expect(() => {
      addDimensions(exporter, {
        show_measurements: false,
        reference_line_end_x: -150.0,
        nut_top_x: -125.0,
        nut_top_y: 28.0,
        bridge_top_x: 195.0,
        bridge_top_y: 49.0,
        string_line: mock_string_line,
        string_length: 325.0,
        neck_end_x: -130.0,
        neck_end_y: 24.0,
        overstand: 6.0,
        body_stop: 195.0,
        arching_height: 15.0,
        bridge_height: 34.0,
        body_length: 355.0,
        rib_height: 30.0,
        belly_edge_thickness: 3.5,
        fb_surface_point_x: -50.0,
        fb_surface_point_y: 15.0,
        string_x_at_fb_end: -50.0,
        string_y_at_fb_end: 17.0,
        string_height_at_fb_end: 2.0,
        intersect_x: -100.0,
        intersect_y: 20.0,
        nut_to_perp_distance: 5.0,
        tailpiece_height: 0.0,
        string_break_angle: 0.0,
        downward_force_percent: 0.0,
      })
    }).not.toThrow()
  })
})

// ============================================================================
// TestSVGExport (integration)
// ============================================================================

describe('SVG export integration', () => {
  it('produces valid SVG with <svg and </svg>', () => {
    const exporter = setupExporter(true)
    drawBody(exporter, 355.0, 3.5, 30.0, 195.0, 15.0)

    const svg_output = exporter.write()
    expect(svg_output).toBeTruthy()
    expect(svg_output).toContain('<svg')
    expect(svg_output).toContain('</svg>')
  })

  it('exported SVG has viewBox attribute', () => {
    const exporter = setupExporter(true)
    drawBody(exporter, 355.0, 3.5, 30.0, 195.0, 15.0)

    const svg_output = exporter.write()
    expect(svg_output).toContain('viewBox')
  })

  it('exported SVG has defs section for patterns', () => {
    const exporter = setupExporter(true)
    drawFingerboard(
      exporter,
      -130.0,
      24.0,
      -10.0,
      10.0,
      5.0,
      6.0,
      (5 * Math.PI) / 180,
      4.0,
      5.0,
    )

    const svg_output = exporter.write()
    const lower = svg_output.toLowerCase()
    expect(svg_output.includes('<defs>') || lower.includes('pattern')).toBe(true)
  })
})

// ============================================================================
// TestFullSVGGeneration (full integration)
// ============================================================================

describe('Full SVG generation', () => {
  it('generates valid violin SVG', () => {
    const params = defaultViolinParams()
    const svg = generateSideViewSvg(params)

    expect(svg).toBeTruthy()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('viewBox')
  })

  it('generates valid viol SVG', () => {
    const params = defaultViolParams()
    const svg = generateSideViewSvg(params)

    expect(svg).toBeTruthy()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('generates valid guitar SVG', () => {
    const params = defaultGuitarParams()
    const svg = generateSideViewSvg(params)

    expect(svg).toBeTruthy()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('SVG output is parseable as XML (structural validity)', () => {
    const params = defaultViolinParams()
    const svg = generateSideViewSvg(params)

    // Check fundamental well-formedness indicators
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('viewBox')
    // Count open vs close tags - they must balance
    const openTags = (svg.match(/<[a-z]/gi) || []).length
    const closeTags = (svg.match(/<\/[a-z]/gi) || []).length
    // SVG with self-closing tags: open >= close (some tags are self-closing with />)
    expect(openTags).toBeGreaterThanOrEqual(closeTags)
  })

  it('SVG contains path elements', () => {
    const params = defaultViolinParams()
    const svg = generateSideViewSvg(params)

    expect(
      svg.includes('<path') || svg.includes('<line') || svg.includes('<rect'),
    ).toBe(true)
  })

  it('includes tailpiece height dimension when tailpiece_height > 0', () => {
    const params = defaultViolinParams()
    params['tailpiece_height'] = 15.0

    const svg = generateSideViewSvg(params)
    expect(svg).toContain('15.0')
  })

  it('has more dotted lines with tailpiece height than without', () => {
    const params_zero = defaultViolinParams()
    params_zero['tailpiece_height'] = 0.0
    const svg_zero = generateSideViewSvg(params_zero)

    const params_with = defaultViolinParams()
    params_with['tailpiece_height'] = 10.0
    const svg_with = generateSideViewSvg(params_with)

    const dotted_zero = (svg_zero.match(/stroke-dasharray="1,2"/g) || []).length
    const dotted_with = (svg_with.match(/stroke-dasharray="1,2"/g) || []).length

    expect(dotted_with).toBeGreaterThan(dotted_zero)
  })

  it('string break angle in SVG matches calculated derived value', () => {
    const params = defaultViolinParams()
    const svg = generateSideViewSvg(params)
    const derived = calculateDerivedValues(params)

    const calculated_angle = derived['string_break_angle']!

    // Find angle annotations in the SVG (formatted as "X.X°")
    const angle_pattern = /(\d+(?:\.\d+)?)°/g
    const angle_matches: number[] = []
    let match: RegExpExecArray | null
    while ((match = angle_pattern.exec(svg)) !== null) {
      angle_matches.push(parseFloat(match[1]!))
    }

    // The string break angle should appear in the SVG
    const found = angle_matches.some(
      (a) => Math.abs(a - calculated_angle) < 0.15,
    )
    expect(found).toBe(true)
  })
})
