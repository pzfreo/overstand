/**
 * Tests for ui_metadata.ts
 *
 * Smoke tests covering sections, key measurements, preset metadata,
 * and the full UI metadata bundle.
 */

import {
  SECTIONS,
  KEY_MEASUREMENTS,
  SectionType,
  getPresetMetadata,
  getUiMetadataBundle,
} from '../ui_metadata'

// ---------------------------------------------------------------------------
// SECTIONS
// ---------------------------------------------------------------------------

describe('SECTIONS', () => {
  it('has 11 sections', () => {
    expect(Object.keys(SECTIONS).length).toBe(11)
  })

  it('has the required section IDs', () => {
    const expected = [
      'identity',
      'body_and_bridge',
      'string_action',
      'viol_specific',
      'fingerboard',
      'neck_cross_section',
      'frets',
      'advanced_geometry',
      'display',
      'core_outputs',
      'detailed_outputs',
    ]
    for (const id of expected) {
      expect(id in SECTIONS).toBe(true)
    }
  })

  it('each section has required fields', () => {
    for (const [, section] of Object.entries(SECTIONS)) {
      expect(typeof section.id).toBe('string')
      expect(typeof section.title).toBe('string')
      expect(typeof section.type).toBe('string')
      expect(typeof section.icon).toBe('string')
      expect(typeof section.default_expanded).toBe('boolean')
      expect(typeof section.order).toBe('number')
      expect(Array.isArray(section.parameter_names)).toBe(true)
      expect(typeof section.description).toBe('string')
    }
  })

  it('sections are ordered 1 through 11', () => {
    const orders = Object.values(SECTIONS).map((s) => s.order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('sections have correct types', () => {
    // Input sections
    expect(SECTIONS['identity']!.type).toBe(SectionType.INPUT_BASIC)
    expect(SECTIONS['body_and_bridge']!.type).toBe(SectionType.INPUT_BASIC)
    expect(SECTIONS['string_action']!.type).toBe(SectionType.INPUT_BASIC)
    expect(SECTIONS['fingerboard']!.type).toBe(SectionType.INPUT_ADVANCED)
    // Output sections
    expect(SECTIONS['core_outputs']!.type).toBe(SectionType.OUTPUT_CORE)
    expect(SECTIONS['detailed_outputs']!.type).toBe(SectionType.OUTPUT_DETAILED)
  })

  it('identity section has required parameters', () => {
    const identity = SECTIONS['identity']!
    expect(identity.parameter_names).toContain('instrument_family')
    expect(identity.parameter_names).toContain('vsl')
  })

  it('core_outputs section has neck_angle and neck_stop', () => {
    const coreOutputs = SECTIONS['core_outputs']!
    expect(coreOutputs.parameter_names).toContain('neck_angle')
    expect(coreOutputs.parameter_names).toContain('neck_stop')
  })
})

// ---------------------------------------------------------------------------
// KEY_MEASUREMENTS
// ---------------------------------------------------------------------------

describe('KEY_MEASUREMENTS', () => {
  it('has 4 key measurements', () => {
    expect(KEY_MEASUREMENTS.length).toBe(4)
  })

  it('first measurement is neck_angle and marked primary', () => {
    expect(KEY_MEASUREMENTS[0]!.key).toBe('neck_angle')
    expect(KEY_MEASUREMENTS[0]!.primary).toBe(true)
  })

  it('second measurement is neck_stop with guitar conditional', () => {
    const second = KEY_MEASUREMENTS[1]!
    expect(second.key).toBe('neck_stop')
    expect(second.key_conditional).toBeDefined()
    expect(second.key_conditional!['GUITAR_MANDOLIN']).toBe('body_stop')
  })

  it('includes nut_relative_to_ribs and string_break_angle', () => {
    const keys = KEY_MEASUREMENTS.map((m) => m.key)
    expect(keys).toContain('nut_relative_to_ribs')
    expect(keys).toContain('string_break_angle')
  })
})

// ---------------------------------------------------------------------------
// getPresetMetadata
// ---------------------------------------------------------------------------

describe('getPresetMetadata', () => {
  it('returns 11 presets', () => {
    expect(getPresetMetadata().length).toBe(11)
  })

  it('each preset has required fields', () => {
    for (const preset of getPresetMetadata()) {
      expect(typeof preset.id).toBe('string')
      expect(preset.id.length).toBeGreaterThan(0)
      expect(typeof preset.display_name).toBe('string')
      expect(preset.display_name.length).toBeGreaterThan(0)
      expect(['VIOLIN', 'VIOL', 'GUITAR_MANDOLIN']).toContain(preset.family)
      expect(typeof preset.filepath).toBe('string')
      expect(preset.filepath.startsWith('presets/')).toBe(true)
    }
  })

  it('includes violin, cello, bass_viol, mandolin', () => {
    const ids = getPresetMetadata().map((p) => p.id)
    expect(ids).toContain('violin')
    expect(ids).toContain('cello')
    expect(ids).toContain('bass_viol')
    expect(ids).toContain('mandolin')
  })

  it('presets have correct families', () => {
    const presets = Object.fromEntries(getPresetMetadata().map((p) => [p.id, p]))
    expect(presets['violin']!.family).toBe('VIOLIN')
    expect(presets['bass_viol']!.family).toBe('VIOL')
    expect(presets['mandolin']!.family).toBe('GUITAR_MANDOLIN')
  })
})

// ---------------------------------------------------------------------------
// getUiMetadataBundle
// ---------------------------------------------------------------------------

describe('getUiMetadataBundle', () => {
  it('returns a bundle with all required keys', () => {
    const bundle = getUiMetadataBundle()
    expect('sections' in bundle).toBe(true)
    expect('parameters' in bundle).toBe(true)
    expect('derived_values' in bundle).toBe(true)
    expect('presets' in bundle).toBe(true)
    expect('key_measurements' in bundle).toBe(true)
  })

  it('bundle has 11 sections', () => {
    const bundle = getUiMetadataBundle()
    expect(Object.keys(bundle.sections).length).toBe(11)
  })

  it('bundle has input parameters', () => {
    const bundle = getUiMetadataBundle()
    expect(Object.keys(bundle.parameters).length).toBeGreaterThan(0)
    // instrument_family and vsl should always be present
    expect('instrument_family' in bundle.parameters).toBe(true)
    expect('vsl' in bundle.parameters).toBe(true)
  })

  it('bundle has derived values', () => {
    const bundle = getUiMetadataBundle()
    expect(Object.keys(bundle.derived_values).length).toBeGreaterThan(0)
    // neck_angle should always be in output
    expect('neck_angle' in bundle.derived_values).toBe(true)
  })

  it('bundle has 11 presets', () => {
    const bundle = getUiMetadataBundle()
    expect(Object.keys(bundle.presets).length).toBe(11)
  })

  it('bundle has 4 key measurements', () => {
    const bundle = getUiMetadataBundle()
    expect(bundle.key_measurements.length).toBe(4)
  })
})
