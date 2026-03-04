/**
 * TypeScript port of tests/test_instrument_generator.py
 *
 * All 36 Python tests ported to Vitest.
 */

import { describe, it, expect } from 'vitest'
import {
  generateViolin,
  generateViolinNeck,
  getDerivedValues,
  getDerivedValueMetadata,
  getParameterDefinitions,
  getUiMetadata,
} from '../instrument_generator'
import { getDefaultValues } from '../parameter_registry'
import type { Params } from '../geometry_engine'

// ---------------------------------------------------------------------------
// Shared fixtures (mirrors conftest.py)
// ---------------------------------------------------------------------------

function defaultViolinParams(): Params {
  const params = getDefaultValues() as Params
  params['instrument_family'] = 'VIOLIN'
  return params
}

function defaultViolParams(): Params {
  const params = getDefaultValues() as Params
  params['instrument_family'] = 'VIOL'
  params['no_frets'] = 7
  return params
}

function defaultGuitarParams(): Params {
  const params = getDefaultValues() as Params
  params['instrument_family'] = 'GUITAR_MANDOLIN'
  params['fret_join'] = 12
  params['no_frets'] = 19
  params['string_height_12th_fret'] = 2.5
  return params
}

// ---------------------------------------------------------------------------
// TestGenerateViolinNeck (using object-based generateViolin)
// ---------------------------------------------------------------------------

describe('generateViolin - success with valid params', () => {
  it('succeeds with default violin params', () => {
    const result = generateViolin(defaultViolinParams())
    expect(result.success).toBe(true)
    expect(result.views).not.toBeNull()
    expect('side' in (result.views ?? {})).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('generateViolin - returns all views', () => {
  it('returns side, top, and cross_section views', () => {
    const result = generateViolin(defaultViolinParams())
    const views = result.views!
    expect('side' in views).toBe(true)
    expect('top' in views).toBe(true)
    expect('cross_section' in views).toBe(true)
  })
})

describe('generateViolin - returns derived values', () => {
  it('includes neck_angle in derived_values', () => {
    const result = generateViolin(defaultViolinParams())
    expect(result.derived_values).not.toBeNull()
    expect('neck_angle' in (result.derived_values ?? {})).toBe(true)
  })
})

describe('generateViolin - returns formatted values', () => {
  it('includes derived_formatted', () => {
    const result = generateViolin(defaultViolinParams())
    expect(result.derived_formatted).not.toBeNull()
  })
})

describe('generateViolin - returns fret positions for viols', () => {
  it('fret_positions is available for viols', () => {
    const result = generateViolin(defaultViolParams())
    expect(result.fret_positions).not.toBeNull()
    expect(result.fret_positions!.available).toBe(true)
    expect('html' in result.fret_positions!).toBe(true)
  })
})

describe('generateViolin - fret positions not available for unfretted violin', () => {
  it('fret_positions.available is false when no_frets is 0', () => {
    const params = defaultViolinParams()
    params['no_frets'] = 0
    const result = generateViolin(params)
    expect(result.fret_positions!.available).toBe(false)
  })
})

describe('generateViolin - works with viol params', () => {
  it('succeeds with viol params', () => {
    const result = generateViolin(defaultViolParams())
    expect(result.success).toBe(true)
    expect(result.views).not.toBeNull()
  })
})

describe('generateViolin - works with guitar params', () => {
  it('succeeds with guitar params', () => {
    const result = generateViolin(defaultGuitarParams())
    expect(result.success).toBe(true)
    expect(result.views).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// JSON-based generateViolinNeck
// ---------------------------------------------------------------------------

describe('generateViolinNeck - invalid JSON returns error', () => {
  it('returns success=false and error message for invalid JSON', () => {
    const result = JSON.parse(generateViolinNeck('not valid json'))
    expect(result.success).toBe(false)
    expect(result.views).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
    const errMsg: string = result.errors[0]
    expect(errMsg.includes('Invalid') || errMsg.includes('JSON')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getDerivedValues
// ---------------------------------------------------------------------------

describe('getDerivedValues - returns success', () => {
  it('returns success=true', () => {
    const result = JSON.parse(getDerivedValues(JSON.stringify(defaultViolinParams())))
    expect(result.success).toBe(true)
  })
})

describe('getDerivedValues - returns raw values', () => {
  it('includes numeric neck_angle in values', () => {
    const result = JSON.parse(getDerivedValues(JSON.stringify(defaultViolinParams())))
    expect('values' in result).toBe(true)
    const values = result.values
    expect('neck_angle' in values).toBe(true)
    expect(typeof values.neck_angle).toBe('number')
  })
})

describe('getDerivedValues - returns formatted values', () => {
  it('formatted values are strings', () => {
    const result = JSON.parse(getDerivedValues(JSON.stringify(defaultViolinParams())))
    expect('formatted' in result).toBe(true)
    for (const value of Object.values(result.formatted)) {
      expect(typeof value).toBe('string')
    }
  })
})

describe('getDerivedValues - returns metadata', () => {
  it('includes metadata field', () => {
    const result = JSON.parse(getDerivedValues(JSON.stringify(defaultViolinParams())))
    expect('metadata' in result).toBe(true)
  })
})

describe('getDerivedValues - violin specific values', () => {
  it('includes string angles and neck line angle', () => {
    const result = JSON.parse(getDerivedValues(JSON.stringify(defaultViolinParams())))
    const values = result.values
    expect('string_angle_to_ribs' in values).toBe(true)
    expect('string_angle_to_fingerboard' in values).toBe(true)
    expect('neck_line_angle' in values).toBe(true)
  })
})

describe('getDerivedValues - invalid JSON returns error', () => {
  it('returns success=false for invalid JSON', () => {
    const result = JSON.parse(getDerivedValues('not valid json'))
    expect(result.success).toBe(false)
    expect('errors' in result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getDerivedValueMetadata
// ---------------------------------------------------------------------------

describe('getDerivedValueMetadata - returns success', () => {
  it('returns success=true', () => {
    const result = JSON.parse(getDerivedValueMetadata())
    expect(result.success).toBe(true)
  })
})

describe('getDerivedValueMetadata - returns metadata dict', () => {
  it('metadata is a dictionary', () => {
    const result = JSON.parse(getDerivedValueMetadata())
    expect('metadata' in result).toBe(true)
    expect(typeof result.metadata).toBe('object')
  })
})

describe('getDerivedValueMetadata - has expected keys', () => {
  it('contains neck_angle and neck_stop', () => {
    const result = JSON.parse(getDerivedValueMetadata())
    const metadata = result.metadata
    expect('neck_angle' in metadata).toBe(true)
    expect('neck_stop' in metadata).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getParameterDefinitions
// ---------------------------------------------------------------------------

describe('getParameterDefinitions - returns valid JSON', () => {
  it('returns a valid JSON object', () => {
    const result = JSON.parse(getParameterDefinitions())
    expect(typeof result).toBe('object')
  })
})

describe('getParameterDefinitions - contains parameters', () => {
  it('has parameters field', () => {
    const result = JSON.parse(getParameterDefinitions())
    expect('parameters' in result).toBe(true)
  })
})

describe('getParameterDefinitions - contains input parameters', () => {
  it('includes vsl, body_stop, and body_length', () => {
    const result = JSON.parse(getParameterDefinitions())
    const params = result.parameters
    expect('vsl' in params).toBe(true)
    expect('body_stop' in params).toBe(true)
    expect('body_length' in params).toBe(true)
  })
})

describe('getParameterDefinitions - only input parameters', () => {
  it('does not contain output-only neck_angle but does contain vsl and body_stop', () => {
    const result = JSON.parse(getParameterDefinitions())
    const params = result.parameters
    expect('neck_angle' in params).toBe(false)
    expect('vsl' in params).toBe(true)
    expect('body_stop' in params).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getUiMetadata
// ---------------------------------------------------------------------------

describe('getUiMetadata - returns success', () => {
  it('returns success=true', () => {
    const result = JSON.parse(getUiMetadata())
    expect(result.success).toBe(true)
  })
})

describe('getUiMetadata - returns metadata bundle', () => {
  it('has metadata field', () => {
    const result = JSON.parse(getUiMetadata())
    expect('metadata' in result).toBe(true)
  })
})

describe('getUiMetadata - metadata has sections', () => {
  it('includes sections in metadata', () => {
    const result = JSON.parse(getUiMetadata())
    expect('sections' in result.metadata).toBe(true)
  })
})

describe('getUiMetadata - metadata has presets', () => {
  it('includes presets in metadata', () => {
    const result = JSON.parse(getUiMetadata())
    expect('presets' in result.metadata).toBe(true)
  })
})

describe('getUiMetadata - parameters use input format', () => {
  it('all parameters have type field in input format', () => {
    const result = JSON.parse(getUiMetadata())
    const parameters = result.metadata.parameters

    for (const [name, param] of Object.entries(parameters) as Array<[string, Record<string, unknown>]>) {
      expect(param['type'], `Parameter '${name}' missing 'type' - likely using output format`).toBeTruthy()
      expect(
        ['number', 'enum', 'boolean', 'string'].includes(param['type'] as string),
        `Parameter '${name}' has invalid type '${param['type']}'`
      ).toBe(true)

      if (param['type'] === 'number') {
        expect(param['min'], `Numeric parameter '${name}' missing 'min'`).toBeDefined()
        expect(param['max'], `Numeric parameter '${name}' missing 'max'`).toBeDefined()
      }
    }
  })
})

describe('getUiMetadata - all section parameters exist in metadata', () => {
  it('every parameter referenced in sections exists in parameters dict', () => {
    const result = JSON.parse(getUiMetadata())
    const metadata = result.metadata
    const sections = metadata.sections
    const parameters = metadata.parameters

    for (const [sectionId, section] of Object.entries(sections) as Array<[string, Record<string, unknown>]>) {
      if ((section['type'] as string).startsWith('input_')) {
        for (const paramName of section['parameter_names'] as string[]) {
          expect(
            paramName in parameters,
            `Section '${sectionId}' references '${paramName}' but it's not in parameters`
          ).toBe(true)
        }
      }
    }
  })
})

describe('getUiMetadata - has key_measurements', () => {
  it('key_measurements is a non-empty list', () => {
    const result = JSON.parse(getUiMetadata())
    const metadata = result.metadata

    expect('key_measurements' in metadata).toBe(true)
    expect(Array.isArray(metadata.key_measurements)).toBe(true)
    expect(metadata.key_measurements.length).toBeGreaterThan(0)

    const keys = metadata.key_measurements.map((m: Record<string, unknown>) => m['key'])
    expect(keys).toContain('neck_angle')
    expect(keys).toContain('string_break_angle')

    expect(metadata.key_measurements[0].primary).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Preset metadata (TypeScript equivalent of Python TestGetPresets)
//
// Note: Python get_presets() loads full parameter JSON from disk.
// TypeScript has no filesystem access in browser context, so presets are
// exposed through getUiMetadata() as PresetMetadata[] (name, id, filepath).
// ---------------------------------------------------------------------------

describe('getUiMetadata presets - returns valid presets list', () => {
  it('presets is an array with at least one entry', () => {
    const result = JSON.parse(getUiMetadata())
    const presets = result.metadata.presets
    expect(Array.isArray(presets)).toBe(true)
    expect(presets.length).toBeGreaterThan(0)
  })
})

describe('getUiMetadata presets - each preset has an id', () => {
  it('every preset has a non-empty id', () => {
    const result = JSON.parse(getUiMetadata())
    for (const preset of result.metadata.presets) {
      expect(typeof preset.id).toBe('string')
      expect(preset.id.length).toBeGreaterThan(0)
    }
  })
})

describe('getUiMetadata presets - each preset has a display_name', () => {
  it('every preset has a non-empty display_name', () => {
    const result = JSON.parse(getUiMetadata())
    for (const preset of result.metadata.presets) {
      expect(typeof preset.display_name).toBe('string')
      expect(preset.display_name.length).toBeGreaterThan(0)
    }
  })
})

describe('getUiMetadata presets - each preset has a filepath', () => {
  it('every preset has a filepath', () => {
    const result = JSON.parse(getUiMetadata())
    for (const preset of result.metadata.presets) {
      expect(typeof preset.filepath).toBe('string')
      expect(preset.filepath.length).toBeGreaterThan(0)
    }
  })
})

describe('getUiMetadata presets - violin preset exists', () => {
  it('at least one preset id contains violin', () => {
    const result = JSON.parse(getUiMetadata())
    const presets: Array<{ id: string }> = result.metadata.presets
    const violinPresets = presets.filter(p => p.id.toLowerCase().includes('violin'))
    expect(violinPresets.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('generateViolin - empty params handled', () => {
  it('handles empty params gracefully', () => {
    const result = generateViolin({})
    expect('success' in result).toBe(true)
  })
})

describe('generateViolin - null-like params', () => {
  it('handles null JSON in generateViolinNeck', () => {
    const result = JSON.parse(generateViolinNeck('null'))
    expect('success' in result).toBe(true)
  })
})
