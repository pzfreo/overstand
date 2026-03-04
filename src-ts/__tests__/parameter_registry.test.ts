/**
 * TypeScript port of tests/test_parameter_registry.py
 *
 * All 28 Python tests ported to Vitest.
 */

import {
  PARAMETER_REGISTRY,
  validateRegistry,
} from '../parameter_registry'

import {
  ParameterRole,
  ParameterType,
  InstrumentFamily,
} from '../types'

// ---------------------------------------------------------------------------
// test_registry_validates_on_import
// ---------------------------------------------------------------------------

describe('registry validates on import', () => {
  it('registry has entries', () => {
    expect(Object.keys(PARAMETER_REGISTRY).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// test_registry_has_expected_count
// ---------------------------------------------------------------------------

describe('registry has expected count', () => {
  it('should have between 55 and 80 parameters', () => {
    const count = Object.keys(PARAMETER_REGISTRY).length
    expect(count).toBeGreaterThanOrEqual(55)
    expect(count).toBeLessThanOrEqual(80)
  })
})

// ---------------------------------------------------------------------------
// test_all_keys_are_snake_case
// ---------------------------------------------------------------------------

describe('all keys are snake_case', () => {
  it('keys must be lowercase, no spaces, no leading/trailing underscores', () => {
    for (const key of Object.keys(PARAMETER_REGISTRY)) {
      expect(key).toBe(key.toLowerCase())
      expect(key).not.toContain(' ')
      expect(key.startsWith('_')).toBe(false)
      expect(key.endsWith('_')).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// test_no_title_case_keys
// ---------------------------------------------------------------------------

describe('no title case keys', () => {
  it('keys must not have capital letters', () => {
    for (const key of Object.keys(PARAMETER_REGISTRY)) {
      const hasCapitals = /[A-Z]/.test(key)
      expect(hasCapitals).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// test_conditional_parameters_have_both_configs
// ---------------------------------------------------------------------------

describe('conditional parameters have both configs', () => {
  it('CONDITIONAL parameters have input_config, output_config, and is_output_for', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.role === ParameterRole.CONDITIONAL) {
        expect(param.input_config).not.toBeNull()
        expect(param.input_config).not.toBeUndefined()
        expect(param.output_config).not.toBeNull()
        expect(param.output_config).not.toBeUndefined()
        expect(param.is_output_for).not.toBeNull()
        expect(param.is_output_for).not.toBeUndefined()
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_input_only_parameters_have_input_config
// ---------------------------------------------------------------------------

describe('input only parameters have input_config', () => {
  it('INPUT_ONLY parameters have input_config and no output_config', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.role === ParameterRole.INPUT_ONLY) {
        expect(param.input_config).not.toBeUndefined()
        expect(param.input_config).not.toBeNull()
        expect(param.output_config == null).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_output_only_parameters_have_output_config
// ---------------------------------------------------------------------------

describe('output only parameters have output_config', () => {
  it('OUTPUT_ONLY parameters have output_config and no input_config', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.role === ParameterRole.OUTPUT_ONLY) {
        expect(param.output_config).not.toBeUndefined()
        expect(param.output_config).not.toBeNull()
        expect(param.input_config == null).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_body_stop_is_conditional
// ---------------------------------------------------------------------------

describe('body_stop is conditional', () => {
  it('body_stop is CONDITIONAL with correct is_output_for', () => {
    expect('body_stop' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['body_stop']!
    expect(param.role).toBe(ParameterRole.CONDITIONAL)
    expect(param.input_config).not.toBeNull()
    expect(param.output_config).not.toBeNull()
    expect(param.is_output_for).not.toBeNull()
    expect(param.is_output_for!['VIOLIN']).toBe(false)
    expect(param.is_output_for!['VIOL']).toBe(false)
    expect(param.is_output_for!['GUITAR_MANDOLIN']).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// test_neck_stop_is_output_only
// ---------------------------------------------------------------------------

describe('neck_stop is output only', () => {
  it('neck_stop is OUTPUT_ONLY with output_config and no input_config', () => {
    expect('neck_stop' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['neck_stop']!
    expect(param.role).toBe(ParameterRole.OUTPUT_ONLY)
    expect(param.input_config == null).toBe(true)
    expect(param.output_config).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// test_enum_parameters_have_enum_class
// ---------------------------------------------------------------------------

describe('enum parameters have enum_class', () => {
  it('ENUM parameters have enum_values defined', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.param_type === ParameterType.ENUM) {
        // In TS, we use enum_values array instead of enum_class
        expect(param.enum_values).not.toBeUndefined()
        expect(param.enum_values!.length).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_string_parameters_have_max_length
// ---------------------------------------------------------------------------

describe('string parameters have max_length', () => {
  it('STRING parameters have positive max_length', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.param_type === ParameterType.STRING) {
        expect(param.max_length).not.toBeUndefined()
        expect(param.max_length).not.toBeNull()
        expect(param.max_length!).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_no_duplicate_display_names
// ---------------------------------------------------------------------------

describe('no duplicate display names', () => {
  it('all display names are unique', () => {
    const displayNames = Object.values(PARAMETER_REGISTRY).map(p => p.display_name)
    const nameSet = new Set(displayNames)
    const duplicates = displayNames.filter(name =>
      displayNames.indexOf(name) !== displayNames.lastIndexOf(name)
    )
    expect(duplicates.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// test_all_parameters_have_descriptions
// ---------------------------------------------------------------------------

describe('all parameters have descriptions', () => {
  it('all parameters have non-empty descriptions of length > 10', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      expect(param.description).toBeTruthy()
      expect(param.description.length).toBeGreaterThan(10)
    }
  })
})

// ---------------------------------------------------------------------------
// test_numeric_parameters_have_valid_ranges
// ---------------------------------------------------------------------------

describe('numeric parameters have valid ranges', () => {
  it('NUMERIC params with input_config have valid min/max and default within range', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.param_type === ParameterType.NUMERIC && param.input_config) {
        const config = param.input_config
        expect(config.min_val).toBeLessThan(config.max_val)
        const def = config.default as number
        expect(def).toBeGreaterThanOrEqual(config.min_val)
        expect(def).toBeLessThanOrEqual(config.max_val)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_output_metadata_generation
// ---------------------------------------------------------------------------

describe('output metadata generation', () => {
  it('toOutputMetadata returns correct structure', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.output_config) {
        const metadata = param.toOutputMetadata()
        expect(metadata['key']).toBe(key)
        expect(metadata['display_name']).toBe(param.display_name)
        expect(metadata['unit']).toBe(param.unit)
        expect(metadata['decimals']).toBe(param.output_config.decimals)
        expect(metadata['visible']).toBe(param.output_config.visible)
        expect('description' in metadata).toBe(true)
        expect('category' in metadata).toBe(true)
        expect('order' in metadata).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_input_metadata_generation
// ---------------------------------------------------------------------------

describe('input metadata generation', () => {
  it('toInputMetadata returns correct structure', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.input_config) {
        const metadata = param.toInputMetadata()
        expect(metadata['name']).toBe(key)
        expect(metadata['label']).toBe(param.display_name)
        expect(metadata['description']).toBe(param.description)
        expect('category' in metadata).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_input_metadata_js_compatible_types
// ---------------------------------------------------------------------------

describe('input metadata js compatible types', () => {
  it('input metadata type must be one of: number, enum, boolean, string', () => {
    const validJsTypes = new Set(['number', 'enum', 'boolean', 'string'])
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.input_config) {
        const metadata = param.toInputMetadata()
        expect(validJsTypes.has(metadata['type'] as string)).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_numeric_params_use_min_max_not_min_val_max_val
// ---------------------------------------------------------------------------

describe('numeric params use min/max keys', () => {
  it('numeric params have min/max not min_val/max_val in metadata', () => {
    for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
      if (param.input_config && param.param_type === ParameterType.NUMERIC) {
        const metadata = param.toInputMetadata()
        expect('min' in metadata).toBe(true)
        expect('max' in metadata).toBe(true)
        expect('min_val' in metadata).toBe(false)
        expect('max_val' in metadata).toBe(false)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// test_format_value_methods
// ---------------------------------------------------------------------------

describe('format value methods', () => {
  it('formatValue and formatWithUnit work correctly', () => {
    // vsl is INPUT_ONLY, no output_config, so formatValue falls back to String(value)
    const vsl = PARAMETER_REGISTRY['vsl']!
    expect(vsl.formatValue(325.5)).toBe('325.5')
    expect(vsl.formatWithUnit(325.5)).toBe('325.5 mm')

    // neck_angle has output_config.decimals=1
    const neckAngle = PARAMETER_REGISTRY['neck_angle']!
    const formatted = neckAngle.formatValue(5.12345)
    expect(formatted).toContain('5.1')
  })
})

// ---------------------------------------------------------------------------
// test_is_input_in_mode_method
// ---------------------------------------------------------------------------

describe('isInputInMode method', () => {
  it('INPUT_ONLY param is always input', () => {
    const vsl = PARAMETER_REGISTRY['vsl']!
    expect(vsl.isInputInMode('VIOLIN')).toBe(true)
    expect(vsl.isInputInMode('GUITAR_MANDOLIN')).toBe(true)
  })

  it('OUTPUT_ONLY param is never input', () => {
    const neckAngle = PARAMETER_REGISTRY['neck_angle']!
    expect(neckAngle.isInputInMode('VIOLIN')).toBe(false)
  })

  it('CONDITIONAL param varies by family', () => {
    const bodyStop = PARAMETER_REGISTRY['body_stop']!
    expect(bodyStop.isInputInMode('VIOLIN')).toBe(true)
    expect(bodyStop.isInputInMode('GUITAR_MANDOLIN')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// test_is_output_in_mode_method
// ---------------------------------------------------------------------------

describe('isOutputInMode method', () => {
  it('OUTPUT_ONLY param is always output', () => {
    const neckAngle = PARAMETER_REGISTRY['neck_angle']!
    expect(neckAngle.isOutputInMode('VIOLIN')).toBe(true)
  })

  it('INPUT_ONLY param is never output', () => {
    const vsl = PARAMETER_REGISTRY['vsl']!
    expect(vsl.isOutputInMode('VIOLIN')).toBe(false)
  })

  it('CONDITIONAL param varies by family', () => {
    const bodyStop = PARAMETER_REGISTRY['body_stop']!
    expect(bodyStop.isOutputInMode('VIOLIN')).toBe(false)
    expect(bodyStop.isOutputInMode('GUITAR_MANDOLIN')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// test_parameter_counts_by_role
// ---------------------------------------------------------------------------

describe('parameter counts by role', () => {
  it('has at least 15 INPUT_ONLY, 25 OUTPUT_ONLY, and 1 CONDITIONAL', () => {
    let inputCount = 0
    let outputCount = 0
    let conditionalCount = 0
    for (const param of Object.values(PARAMETER_REGISTRY)) {
      if (param.role === ParameterRole.INPUT_ONLY) inputCount++
      else if (param.role === ParameterRole.OUTPUT_ONLY) outputCount++
      else if (param.role === ParameterRole.CONDITIONAL) conditionalCount++
    }
    expect(inputCount).toBeGreaterThanOrEqual(15)
    expect(outputCount).toBeGreaterThanOrEqual(25)
    expect(conditionalCount).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// test_instrument_family_enum_available
// ---------------------------------------------------------------------------

describe('InstrumentFamily enum available', () => {
  it('InstrumentFamily has VIOLIN, VIOL, and GUITAR_MANDOLIN', () => {
    expect(InstrumentFamily.VIOLIN).toBeDefined()
    expect(InstrumentFamily.VIOL).toBeDefined()
    expect(InstrumentFamily.GUITAR_MANDOLIN).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// test_validate_registry_function
// ---------------------------------------------------------------------------

describe('validateRegistry function', () => {
  it('validateRegistry does not throw', () => {
    expect(() => validateRegistry()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// test_tailpiece_height_parameter
// ---------------------------------------------------------------------------

describe('tailpiece_height parameter', () => {
  it('tailpiece_height has correct properties', () => {
    expect('tailpiece_height' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['tailpiece_height']!
    expect(param.role).toBe(ParameterRole.INPUT_ONLY)
    expect(param.param_type).toBe(ParameterType.NUMERIC)
    expect(param.unit).toBe('mm')
    expect(param.input_config).not.toBeNull()
    expect(param.input_config!.default).toBe(0.0)
    expect(param.input_config!.min_val).toBe(0.0)
    expect(param.input_config!.category).toBe('Advanced Geometry')
  })
})

// ---------------------------------------------------------------------------
// test_string_break_angle_parameter
// ---------------------------------------------------------------------------

describe('string_break_angle parameter', () => {
  it('string_break_angle has correct properties', () => {
    expect('string_break_angle' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['string_break_angle']!
    expect(param.role).toBe(ParameterRole.OUTPUT_ONLY)
    expect(param.param_type).toBe(ParameterType.NUMERIC)
    expect(param.unit).toBe('°')
    expect(param.output_config).not.toBeNull()
    expect(param.output_config!.visible).toBe(true)
    expect(param.output_config!.category).toBe('Geometry')
  })
})

// ---------------------------------------------------------------------------
// test_viol_break_angle_display_name
// ---------------------------------------------------------------------------

describe('viol break_angle display name', () => {
  it('break_angle has correct display_name and role', () => {
    expect('break_angle' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['break_angle']!
    expect(param.display_name).toBe('Viol Back Break Angle')
    expect(param.role).toBe(ParameterRole.INPUT_ONLY)
  })
})

// ---------------------------------------------------------------------------
// test_afterlength_angle_parameter
// ---------------------------------------------------------------------------

describe('afterlength_angle parameter', () => {
  it('afterlength_angle has correct properties', () => {
    expect('afterlength_angle' in PARAMETER_REGISTRY).toBe(true)
    const param = PARAMETER_REGISTRY['afterlength_angle']!
    expect(param.role).toBe(ParameterRole.OUTPUT_ONLY)
    expect(param.param_type).toBe(ParameterType.NUMERIC)
    expect(param.unit).toBe('°')
    expect(param.output_config).not.toBeNull()
    expect(param.output_config!.visible).toBe(true)
    expect(param.output_config!.category).toBe('Geometry')
  })
})
