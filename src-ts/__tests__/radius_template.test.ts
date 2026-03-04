/**
 * TypeScript port of tests/test_radius_template.py
 *
 * 15 Python tests ported to Vitest.
 *
 * The Python tests mock _text_to_svg_path_with_textpath to test the
 * compound-path branch. Here we pass a fake font object to textToSvgPath
 * via the second argument to generateRadiusTemplateSvg.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import {
  generateRadiusTemplateSvg,
  loadStencilFont,
  textToSvgPath,
  mirrorPathDataX,
  FONT_URL,
} from '../radius_template'
import {
  TEMPLATE_WIDTH_MARGIN,
  MIN_FLAT_AREA_HEIGHT,
  SVG_MARGIN,
} from '../constants'

// ============================================================================
// Helpers
// ============================================================================

function defaultParams(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    fingerboard_radius: 41.0,
    fingerboard_width_at_end: 42.0,
    ...overrides,
  }
}

function extractViewboxHeight(svg: string): number {
  const m = svg.match(/viewBox="([^"]*)"/)
  if (!m) throw new Error('No viewBox found in SVG')
  const parts = m[1]!.split(/\s+/)
  return parseFloat(parts[3]!)
}

// A minimal fake font that returns a fixed path string
function fakeFontWith(pathData: string) {
  return {
    getPath: (_text: string, _x: number, _y: number, _size: number) => ({
      toPathData: (_decimals?: number) => pathData,
    }),
  }
}

// ============================================================================
// TestGenerateRadiusTemplateSvg
// ============================================================================

describe('generateRadiusTemplateSvg', () => {
  it('returns a non-empty string', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('SVG starts with <svg tag', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result.trim().startsWith('<svg')).toBe(true)
  })

  it('SVG has closing </svg> tag', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('</svg>')
  })

  it('SVG has viewBox attribute', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('viewBox')
  })

  it('SVG has a path element', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('<path')
  })

  it('width and height dimensions are in mm', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('mm')
  })

  it('small radius raises an error', () => {
    // template_width = 42 + 10 = 52, half = 26; radius 10 < 26
    expect(() => {
      generateRadiusTemplateSvg(defaultParams({ fingerboard_radius: 10.0 }))
    }).toThrow(/[Ff]ingerboard radius/)
  })

  it('different radii give different SVGs', () => {
    const result_41 = generateRadiusTemplateSvg(defaultParams())
    const result_100 = generateRadiusTemplateSvg(
      defaultParams({ fingerboard_radius: 100.0 }),
    )
    expect(result_41).not.toEqual(result_100)
  })

  it('larger radius gives smaller template height (shallower arc)', () => {
    const result_41 = generateRadiusTemplateSvg(defaultParams())
    const result_200 = generateRadiusTemplateSvg(
      defaultParams({ fingerboard_radius: 200.0 }),
    )
    const h_41 = extractViewboxHeight(result_41)
    const h_200 = extractViewboxHeight(result_200)
    expect(h_41).toBeGreaterThan(h_200)
  })

  it('empty params dict uses defaults without crashing', () => {
    const result = generateRadiusTemplateSvg({})
    expect(result).toContain('<svg')
  })

  it('very small radius also raises ValueError (both branches covered)', () => {
    expect(() => {
      generateRadiusTemplateSvg(
        defaultParams({ fingerboard_radius: 5.0, fingerboard_width_at_end: 42.0 }),
      )
    }).toThrow()
  })
})

// ============================================================================
// TestGenerateRadiusTemplateSvgWithText
// ============================================================================

describe('generateRadiusTemplateSvg compound-path branch', () => {
  it('uses evenodd fill-rule when text path is available', () => {
    const fakeFont = fakeFontWith('M 0 0 L 10 0 L 10 10 Z')
    const result = generateRadiusTemplateSvg(defaultParams(), fakeFont)
    expect(result).toContain('evenodd')
  })

  it('includes a rotate transform when text path is available', () => {
    const fakeFont = fakeFontWith('M 0 0 L 5 0 Z')
    const result = generateRadiusTemplateSvg(defaultParams(), fakeFont)
    expect(result).toContain('rotate(')
  })

  it('fallback SVG when text path is null (no font)', () => {
    // No font → textToSvgPath returns null → fallback path
    const result = generateRadiusTemplateSvg(defaultParams(), null)
    expect(result).not.toContain('evenodd')
    expect(result).toContain('stroke')
  })
})

// ============================================================================
// loadStencilFont integration test (uses real font file)
// ============================================================================

describe('loadStencilFont', () => {
  beforeAll(async () => {
    // Load the real font so _font module cache is populated
    await loadStencilFont('./web/fonts/AllertaStencil-Regular.ttf')
  })

  afterAll(async () => {
    // Reset font cache so other tests are unaffected
    await loadStencilFont('/nonexistent-font-to-reset-cache.ttf')
  })

  it('generates compound path with evenodd fill-rule when font is loaded', () => {
    // After loadStencilFont, generateRadiusTemplateSvg uses cached font by default
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('evenodd')
  })

  it('includes rotate transform when font is loaded', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    expect(result).toContain('rotate(')
  })

  it('text path contains bezier curve commands', () => {
    const result = generateRadiusTemplateSvg(defaultParams())
    // opentype.js generates cubic bezier (C) and line (L) commands for text
    expect(result).toMatch(/[CLQ] /)
  })
})

// ============================================================================
// TestTextToSvgPath
// ============================================================================

describe('textToSvgPath', () => {
  it('returns null when no font is provided', () => {
    const result = textToSvgPath('41mm', 0.0, 0.0, 5.0, null)
    expect(result).toBeNull()
  })

  it('returns string when a valid fake font is provided', () => {
    const fakeFont = fakeFontWith('M 0 0 L 10 0 Z')
    const result = textToSvgPath('41mm', 0.0, 0.0, 5.0, fakeFont)
    expect(typeof result).toBe('string')
    expect(result!.length).toBeGreaterThan(0)
  })

  it('returns null when font throws an error', () => {
    const badFont = {
      getPath: () => { throw new Error('font error') },
    }
    const result = textToSvgPath('41mm', 0.0, 0.0, 5.0, badFont)
    expect(result).toBeNull()
  })
})

// ============================================================================
// mirrorPathDataX
// ============================================================================

describe('mirrorPathDataX', () => {
  it('negates X in M command', () => {
    expect(mirrorPathDataX('M 10 20')).toBe('M -10 20')
  })

  it('negates X in L command', () => {
    expect(mirrorPathDataX('L 5.5 3.2')).toBe('L -5.5 3.2')
  })

  it('negates X in C command (3 pairs)', () => {
    expect(mirrorPathDataX('C 1 2 3 4 5 6')).toBe('C -1 2 -3 4 -5 6')
  })

  it('negates X in Q command (2 pairs)', () => {
    expect(mirrorPathDataX('Q 1 2 3 4')).toBe('Q -1 2 -3 4')
  })

  it('passes Z unchanged', () => {
    expect(mirrorPathDataX('Z')).toBe('Z')
  })

  it('handles a compound path', () => {
    const d = 'M 5 0 L 10 0 Z M -5 3 L 5 3 Z'
    const mirrored = mirrorPathDataX(d)
    expect(mirrored).toBe('M -5 0 L -10 0 Z M 5 3 L -5 3 Z')
  })

  it('double mirror restores original path', () => {
    const d = 'M 5 10 L -3 4 Z'
    const mirrored = mirrorPathDataX(d)
    expect(mirrored).toBe('M -5 10 L 3 4 Z')
    const restored = mirrorPathDataX(mirrored)
    expect(restored).toBe('M 5 10 L -3 4 Z')
  })
})
