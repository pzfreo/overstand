/**
 * Unified Parameter Registry - Single Source of Truth for All Parameters
 *
 * TypeScript port of src/parameter_registry.py
 *
 * This module defines all parameters (input and output) in one centralized location.
 * Each parameter is defined once with all its metadata, and can serve as:
 * - INPUT_ONLY: Always a user input
 * - OUTPUT_ONLY: Always a calculated output
 * - CONDITIONAL: Input or output depending on instrument family
 */

import {
  ParameterRole,
  ParameterType,
  InstrumentFamily,
  StringCount,
  InstrumentType,
} from './types'

// ============================================================
// INTERFACES
// ============================================================

export interface InputConfig {
  min_val: number
  max_val: number
  default: number | boolean | string
  step: number
  visible_when: Record<string, string | string[]> | null
  category: string
}

export interface OutputConfig {
  decimals: number
  visible: boolean
  category: string
  order: number
}

// ============================================================
// UNIFIED PARAMETER CLASS
// ============================================================

export class UnifiedParameter {
  key: string
  display_name: string
  param_type: ParameterType
  unit: string
  description: string
  help_text?: string
  role: ParameterRole
  is_output_for?: Record<string, boolean>
  input_config?: InputConfig
  output_config?: OutputConfig
  // For ENUM types: array of {value: enumName, label: enumValue}
  enum_values?: Array<{ value: string; label: string }>
  max_length?: number

  constructor(opts: {
    key: string
    display_name: string
    param_type: ParameterType
    unit: string
    description: string
    help_text?: string
    role?: ParameterRole
    is_output_for?: Record<string, boolean>
    input_config?: InputConfig
    output_config?: OutputConfig
    enum_values?: Array<{ value: string; label: string }>
    max_length?: number
  }) {
    this.key = opts.key
    this.display_name = opts.display_name
    this.param_type = opts.param_type
    this.unit = opts.unit
    this.description = opts.description
    this.help_text = opts.help_text
    this.role = opts.role ?? ParameterRole.INPUT_ONLY
    this.is_output_for = opts.is_output_for
    this.input_config = opts.input_config
    this.output_config = opts.output_config
    this.enum_values = opts.enum_values
    this.max_length = opts.max_length
  }

  isInputInMode(instrumentFamily: string): boolean {
    if (this.role === ParameterRole.INPUT_ONLY) return true
    if (this.role === ParameterRole.OUTPUT_ONLY) return false
    // CONDITIONAL
    if (!this.is_output_for) return true
    return !(this.is_output_for[instrumentFamily] ?? false)
  }

  isOutputInMode(instrumentFamily: string): boolean {
    if (this.role === ParameterRole.OUTPUT_ONLY) return true
    if (this.role === ParameterRole.INPUT_ONLY) return false
    // CONDITIONAL
    if (!this.is_output_for) return false
    return this.is_output_for[instrumentFamily] ?? false
  }

  isVisibleInContext(currentParams: Record<string, unknown>): boolean {
    if (!this.input_config || !this.input_config.visible_when) return true

    const condition = this.input_config.visible_when
    for (const [key, expected] of Object.entries(condition)) {
      const currentVal = currentParams[key]
      if (Array.isArray(expected)) {
        if (!expected.includes(currentVal as string)) return false
      } else {
        if (currentVal !== expected) return false
      }
    }
    return true
  }

  toInputMetadata(): Record<string, unknown> {
    if (!this.input_config) {
      throw new Error(`Parameter ${this.key} has no input configuration`)
    }

    // Map ParameterType to JavaScript-expected type strings
    const typeMap: Record<ParameterType, string> = {
      [ParameterType.NUMERIC]: 'number',
      [ParameterType.ENUM]: 'enum',
      [ParameterType.BOOLEAN]: 'boolean',
      [ParameterType.STRING]: 'string',
    }

    const result: Record<string, unknown> = {
      type: typeMap[this.param_type] ?? this.param_type,
      name: this.key,
      label: this.display_name,
      description: this.description,
      category: this.input_config.category,
    }

    if (this.param_type === ParameterType.NUMERIC) {
      result['unit'] = this.unit
      result['default'] = this.input_config.default
      result['min'] = this.input_config.min_val
      result['max'] = this.input_config.max_val
      result['step'] = this.input_config.step
    } else if (this.param_type === ParameterType.ENUM) {
      if (!this.enum_values) {
        throw new Error(`ENUM parameter ${this.key} must have enum_values`)
      }
      // Default: use the enum name (value field) as the default string
      let defaultVal = this.input_config.default
      result['options'] = this.enum_values
      result['default'] = defaultVal
    } else if (this.param_type === ParameterType.BOOLEAN) {
      result['default'] = this.input_config.default
    } else if (this.param_type === ParameterType.STRING) {
      result['default'] = this.input_config.default
      result['max_length'] = this.max_length ?? 100
    }

    // Add conditional metadata
    if (this.input_config.visible_when) {
      result['visible_when'] = this.input_config.visible_when
    }
    if (this.is_output_for) {
      result['is_output'] = this.is_output_for
    }

    return result
  }

  toOutputMetadata(): Record<string, unknown> {
    if (!this.output_config) {
      throw new Error(`Parameter ${this.key} has no output configuration`)
    }

    return {
      key: this.key,
      display_name: this.display_name,
      unit: this.unit,
      decimals: this.output_config.decimals,
      visible: this.output_config.visible,
      category: this.output_config.category,
      description: this.description,
      order: this.output_config.order,
    }
  }

  formatValue(value: number): string {
    if (!this.output_config) {
      // Mirrors Python: str(value) - avoid trailing zeros like Python
      return String(value)
    }
    return value.toFixed(this.output_config.decimals)
  }

  formatWithUnit(value: number): string {
    const formatted = this.formatValue(value)
    if (this.unit) {
      return `${formatted} ${this.unit}`
    }
    return formatted
  }
}

// ============================================================
// ENUM VALUE HELPERS
// ============================================================

const INSTRUMENT_FAMILY_VALUES: Array<{ value: string; label: string }> = [
  { value: 'VIOLIN', label: InstrumentFamily.VIOLIN },
  { value: 'VIOL', label: InstrumentFamily.VIOL },
  { value: 'GUITAR_MANDOLIN', label: InstrumentFamily.GUITAR_MANDOLIN },
]

const STRING_COUNT_VALUES: Array<{ value: string; label: string }> = [
  { value: 'FOUR', label: StringCount.FOUR },
  { value: 'FIVE', label: StringCount.FIVE },
  { value: 'SIX', label: StringCount.SIX },
  { value: 'SEVEN', label: StringCount.SEVEN },
]

const INSTRUMENT_TYPE_VALUES: Array<{ value: string; label: string }> = [
  { value: 'VIOLIN', label: InstrumentType.VIOLIN },
  { value: 'VIOLA', label: InstrumentType.VIOLA },
  { value: 'CELLO', label: InstrumentType.CELLO },
  { value: 'PARDESSUS', label: InstrumentType.PARDESSUS },
  { value: 'TREBLE', label: InstrumentType.TREBLE },
  { value: 'TENOR', label: InstrumentType.TENOR },
  { value: 'BASS', label: InstrumentType.BASS },
  { value: 'OTHER', label: InstrumentType.OTHER },
]

// ============================================================
// PARAMETER REGISTRY
// ============================================================

export const PARAMETER_REGISTRY: Record<string, UnifiedParameter> = {
  // ============================================================
  // ENUM PARAMETERS (Input Only)
  // ============================================================

  instrument_family: new UnifiedParameter({
    key: 'instrument_family',
    display_name: 'Instrument Family',
    param_type: ParameterType.ENUM,
    unit: '',
    description: 'Select instrument family - determines calculation approach for neck/body dimensions',
    role: ParameterRole.INPUT_ONLY,
    enum_values: INSTRUMENT_FAMILY_VALUES,
    input_config: {
      min_val: 0,
      max_val: 0,
      default: 'VIOLIN',
      step: 0,
      visible_when: null,
      category: 'General',
    },
  }),

  // ============================================================
  // CORE DIMENSION PARAMETERS (Input Only)
  // ============================================================

  vsl: new UnifiedParameter({
    key: 'vsl',
    display_name: 'Vibrating String Length',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Playing length from nut to bridge along string path',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 1000.0,
      default: 325.0,
      step: 0.5,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  // ============================================================
  // CONDITIONAL PARAMETERS (Input for some families, Output for others)
  // ============================================================

  body_stop: new UnifiedParameter({
    key: 'body_stop',
    display_name: 'Body Stop',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Length from where neck meets body to bridge',
    role: ParameterRole.CONDITIONAL,
    is_output_for: { VIOLIN: false, VIOL: false, GUITAR_MANDOLIN: true },
    input_config: {
      min_val: 10.0,
      max_val: 500.0,
      default: 195.0,
      step: 0.1,
      visible_when: { instrument_family: ['VIOLIN', 'VIOL'] },
      category: 'Basic Dimensions',
    },
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 4,
    },
  }),

  // ============================================================
  // OUTPUT ONLY PARAMETERS (Always Calculated)
  // ============================================================

  neck_stop: new UnifiedParameter({
    key: 'neck_stop',
    display_name: 'Neck Stop',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Horizontal distance from body join to nut',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 3,
    },
  }),

  fret_join_position: new UnifiedParameter({
    key: 'fret_join_position',
    display_name: 'Effective Fret at Join',
    param_type: ParameterType.NUMERIC,
    unit: 'fret',
    description: 'Effective fret position of the body join (violin/viol family only)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: true,
      category: 'Geometry',
      order: 4,
    },
  }),

  neck_angle: new UnifiedParameter({
    key: 'neck_angle',
    display_name: 'Neck Angle',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of the neck relative to the body (measured from horizontal)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 1,
    },
  }),

  string_angle_to_ribs: new UnifiedParameter({
    key: 'string_angle_to_ribs',
    display_name: 'String Angle to Ribs',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of string relative to rib line',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 5,
    },
  }),

  string_angle_to_fingerboard: new UnifiedParameter({
    key: 'string_angle_to_fingerboard',
    display_name: 'String Angle to Fingerboard',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of string relative to fingerboard surface',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Geometry',
      order: 7,
    },
  }),

  string_break_angle: new UnifiedParameter({
    key: 'string_break_angle',
    display_name: 'String Break Angle',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle the string makes as it breaks over the bridge toward the tailpiece',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 8,
    },
  }),

  afterlength_angle: new UnifiedParameter({
    key: 'afterlength_angle',
    display_name: 'Afterlength Angle',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of the string afterlength (bridge to tailpiece) relative to the ribs',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 9,
    },
  }),

  downward_force_percent: new UnifiedParameter({
    key: 'downward_force_percent',
    display_name: 'Downward Force %',
    param_type: ParameterType.NUMERIC,
    unit: '%',
    description: 'Percentage of string tension that pushes downward on the belly',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 10,
    },
  }),

  // ============================================================
  // BASIC DIMENSION PARAMETERS (Input Only)
  // ============================================================

  instrument_name: new UnifiedParameter({
    key: 'instrument_name',
    display_name: 'Instrument Name',
    param_type: ParameterType.STRING,
    unit: '',
    description: 'Name/label for this instrument (used in filenames)',
    role: ParameterRole.INPUT_ONLY,
    max_length: 50,
    input_config: {
      min_val: 0,
      max_val: 0,
      default: 'My Instrument',
      step: 0,
      visible_when: null,
      category: 'General',
    },
  }),

  fret_join: new UnifiedParameter({
    key: 'fret_join',
    display_name: 'Fret at Body Join',
    param_type: ParameterType.NUMERIC,
    unit: 'fret #',
    description: 'Which fret is located at the neck/body junction',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 1,
      max_val: 24,
      default: 12,
      step: 1,
      visible_when: { instrument_family: 'GUITAR_MANDOLIN' },
      category: 'Fret Configuration',
    },
  }),

  no_frets: new UnifiedParameter({
    key: 'no_frets',
    display_name: 'Number of Frets',
    param_type: ParameterType.NUMERIC,
    unit: '',
    description: 'Number of frets to calculate positions for',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0,
      max_val: 30,
      default: 7,
      step: 1,
      visible_when: { instrument_family: ['VIOL', 'GUITAR_MANDOLIN'] },
      category: 'Fret Configuration',
    },
  }),

  body_length: new UnifiedParameter({
    key: 'body_length',
    display_name: 'Body Length',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Length of body from join to saddle',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 1000.0,
      default: 355.0,
      step: 1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  rib_height: new UnifiedParameter({
    key: 'rib_height',
    display_name: 'Rib Height',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: "Rib Height assumed constant (doesn't affect calculation)",
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 500.0,
      default: 30.0,
      step: 0.5,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  fingerboard_length: new UnifiedParameter({
    key: 'fingerboard_length',
    display_name: 'Fingerboard Length',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Length of fingerboard from nut',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 20.0,
      max_val: 1000.0,
      default: 270.0,
      step: 1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  arching_height: new UnifiedParameter({
    key: 'arching_height',
    display_name: 'Arching Height',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of arching from top of ribs to bridge location',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 15.0,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  belly_edge_thickness: new UnifiedParameter({
    key: 'belly_edge_thickness',
    display_name: 'Belly Edge Thickness',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Thickness of belly (top plate) at the edge',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 10.0,
      default: 3.5,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  bridge_height: new UnifiedParameter({
    key: 'bridge_height',
    display_name: 'Bridge Height',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of bridge above arching',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 33.0,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  tailpiece_height: new UnifiedParameter({
    key: 'tailpiece_height',
    display_name: 'Tailpiece Height',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Tailpiece height above the edge of the belly at the bottom end of the instrument',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 0.0,
      step: 0.1,
      visible_when: null,
      category: 'Advanced Geometry',
    },
  }),

  overstand: new UnifiedParameter({
    key: 'overstand',
    display_name: 'Overstand',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of fingerboard above ribs at neck join',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 12.0,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  fingerboard_radius: new UnifiedParameter({
    key: 'fingerboard_radius',
    display_name: 'Fingerboard Radius',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Radius of fingerboard curvature (larger = flatter). Typical: Violin 41mm, Viol 60-80mm, Guitar 300mm',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 20.0,
      max_val: 1000.0,
      default: 41.0,
      step: 1.0,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  fb_visible_height_at_nut: new UnifiedParameter({
    key: 'fb_visible_height_at_nut',
    display_name: 'Fingerboard visible height at nut',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of the flat visible side of fingerboard at nut',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 4.0,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  fb_visible_height_at_join: new UnifiedParameter({
    key: 'fb_visible_height_at_join',
    display_name: 'Fingerboard visible height at body join',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of the flat visible side of fingerboard at body join',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 6.0,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  string_height_nut: new UnifiedParameter({
    key: 'string_height_nut',
    display_name: 'String height at nut',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'String height at nut',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 10.0,
      default: 0.6,
      step: 0.1,
      visible_when: null,
      category: 'Basic Dimensions',
    },
  }),

  string_height_eof: new UnifiedParameter({
    key: 'string_height_eof',
    display_name: 'String height at end of fb',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'String height at the end of the fingerboard',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 10.0,
      default: 4.0,
      step: 0.1,
      visible_when: { instrument_family: ['VIOLIN', 'VIOL'] },
      category: 'Basic Dimensions',
    },
  }),

  string_height_12th_fret: new UnifiedParameter({
    key: 'string_height_12th_fret',
    display_name: 'String height at 12th fret',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'String height at the 12th fret',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 10.0,
      default: 4.0,
      step: 0.1,
      visible_when: { instrument_family: 'GUITAR_MANDOLIN' },
      category: 'Basic Dimensions',
    },
  }),

  fingerboard_width_at_nut: new UnifiedParameter({
    key: 'fingerboard_width_at_nut',
    display_name: 'Width at Nut',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Width of fingerboard at the nut',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 100.0,
      default: 24.0,
      step: 0.1,
      visible_when: null,
      category: 'Fingerboard Dimensions',
    },
  }),

  fingerboard_width_at_end: new UnifiedParameter({
    key: 'fingerboard_width_at_end',
    display_name: 'Fingerboard width at end',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Fingerboard width at bridge end of fingerboard',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 100.0,
      default: 30.0,
      step: 0.1,
      visible_when: null,
      category: 'Fingerboard Dimensions',
    },
  }),

  show_measurements: new UnifiedParameter({
    key: 'show_measurements',
    display_name: 'Show Measurements',
    param_type: ParameterType.BOOLEAN,
    unit: '',
    description: 'Display dimension annotations',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0,
      max_val: 0,
      default: true,
      step: 0,
      visible_when: null,
      category: 'Display Options',
    },
  }),

  // ============================================================
  // VIOL-SPECIFIC PARAMETERS (Input Only)
  // ============================================================

  break_angle: new UnifiedParameter({
    key: 'break_angle',
    display_name: 'Viol Back Break Angle',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle at which the back breaks (viol back construction)',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 45.0,
      default: 15.0,
      step: 0.5,
      visible_when: { instrument_family: 'VIOL' },
      category: 'Viol Construction',
    },
  }),

  top_block_height: new UnifiedParameter({
    key: 'top_block_height',
    display_name: 'Top Block Height',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of the top block where the neck joins the body',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 10.0,
      max_val: 150.0,
      default: 40.0,
      step: 1.0,
      visible_when: { instrument_family: 'VIOL' },
      category: 'Viol Construction',
    },
  }),

  // ============================================================
  // NECK ROOT PARAMETERS (for cross-section view)
  // ============================================================

  button_width_at_join: new UnifiedParameter({
    key: 'button_width_at_join',
    display_name: 'Button Width at Join',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Width of the neck button/heel where it meets the body',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 15.0,
      max_val: 100.0,
      default: 28.0,
      step: 0.5,
      visible_when: null,
      category: 'Neck Root Geometry',
    },
  }),

  neck_width_at_top_of_ribs: new UnifiedParameter({
    key: 'neck_width_at_top_of_ribs',
    display_name: 'Neck Width at Top of Ribs',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Width of the neck at the top of ribs (belly level)',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 15.0,
      max_val: 80.0,
      default: 30.0,
      step: 0.5,
      visible_when: null,
      category: 'Neck Root Geometry',
    },
  }),

  fb_blend_percent: new UnifiedParameter({
    key: 'fb_blend_percent',
    display_name: 'Fingerboard Blend %',
    param_type: ParameterType.NUMERIC,
    unit: '%',
    description: 'Percentage of fingerboard side that blends into the fillet curve (0=traditional square edge, 100=fully blended)',
    role: ParameterRole.INPUT_ONLY,
    input_config: {
      min_val: 0.0,
      max_val: 100.0,
      default: 0.0,
      step: 5.0,
      visible_when: null,
      category: 'Neck Root Geometry',
    },
  }),

  // ============================================================
  // VIOL-SPECIFIC OUTPUT PARAMETERS
  // ============================================================

  back_break_length: new UnifiedParameter({
    key: 'back_break_length',
    display_name: 'Back Break Length',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Length of the back from hookbar to break point',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Viol Geometry',
      order: 50,
    },
  }),

  // ============================================================
  // OUTPUT ONLY PARAMETERS (Geometry Results)
  // ============================================================

  string_length: new UnifiedParameter({
    key: 'string_length',
    display_name: 'String Length',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Playing length from nut to bridge',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: false,
      category: 'Geometry',
      order: 2,
    },
  }),

  nut_relative_to_ribs: new UnifiedParameter({
    key: 'nut_relative_to_ribs',
    display_name: 'Nut Relative to Ribs',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Vertical distance from rib plane to top of nut',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 5,
    },
  }),

  sagitta_at_nut: new UnifiedParameter({
    key: 'sagitta_at_nut',
    display_name: 'Sagitta at Nut',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of fingerboard arc at nut due to radius',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 20,
    },
  }),

  sagitta_at_join: new UnifiedParameter({
    key: 'sagitta_at_join',
    display_name: 'Sagitta at Join',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Height of fingerboard arc at body join due to radius',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 21,
    },
  }),

  neck_block_max_width: new UnifiedParameter({
    key: 'neck_block_max_width',
    display_name: 'Neck Block Max Width',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Maximum width of neck block at fingerboard bottom (equals fb_width when blend=0)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 22,
    },
  }),

  fb_thickness_at_nut: new UnifiedParameter({
    key: 'fb_thickness_at_nut',
    display_name: 'Total FB Thickness at Nut',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Total fingerboard thickness at nut (visible height + sagitta)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 22,
    },
  }),

  fb_thickness_at_join: new UnifiedParameter({
    key: 'fb_thickness_at_join',
    display_name: 'Total FB Thickness at Join',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Total fingerboard thickness at body join (visible height + sagitta)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 23,
    },
  }),

  fb_fret_1_distance: new UnifiedParameter({
    key: 'fb_fret_1_distance',
    display_name: '1st Fret Location',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Distance from nut to 1st fret position',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: { decimals: 1, visible: true, category: 'Geometry', order: 24 },
  }),

  fb_thickness_at_fret_1: new UnifiedParameter({
    key: 'fb_thickness_at_fret_1',
    display_name: 'FB Thickness at Fret 1',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Total fingerboard thickness at the 1st fret position',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: { decimals: 2, visible: true, category: 'Geometry', order: 25 },
  }),

  fb_ref_fret_distance: new UnifiedParameter({
    key: 'fb_ref_fret_distance',
    display_name: 'Reference Point',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Distance from nut to reference measurement point',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: { decimals: 1, visible: true, category: 'Geometry', order: 26 },
  }),

  fb_thickness_at_ref_fret: new UnifiedParameter({
    key: 'fb_thickness_at_ref_fret',
    display_name: 'FB Thickness at Reference',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Total fingerboard thickness at reference point (7th fret position for violin/viol, fret_join-2 for guitar)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: { decimals: 2, visible: true, category: 'Geometry', order: 27 },
  }),

  fb_ref_fret_number: new UnifiedParameter({
    key: 'fb_ref_fret_number',
    display_name: 'Reference Fret Number',
    param_type: ParameterType.NUMERIC,
    unit: 'fret #',
    description: 'The reference fret used for FB thickness measurement (internal)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: { decimals: 0, visible: false, category: 'Geometry', order: 28 },
  }),

  // Internal calculation values (visible=false)
  neck_angle_rad: new UnifiedParameter({
    key: 'neck_angle_rad',
    display_name: 'Neck Angle (rad)',
    param_type: ParameterType.NUMERIC,
    unit: 'rad',
    description: 'Neck angle in radians (for internal calculations)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 4,
      visible: false,
      category: 'Internal',
      order: 100,
    },
  }),

  neck_end_x: new UnifiedParameter({
    key: 'neck_end_x',
    display_name: 'Neck End X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of neck end point (for geometry)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 101,
    },
  }),

  neck_end_y: new UnifiedParameter({
    key: 'neck_end_y',
    display_name: 'Neck End Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of neck end point (for geometry)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 102,
    },
  }),

  nut_draw_radius: new UnifiedParameter({
    key: 'nut_draw_radius',
    display_name: 'Nut Draw Radius',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Radius of nut quarter-circle (for drawing)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 103,
    },
  }),

  neck_line_angle: new UnifiedParameter({
    key: 'neck_line_angle',
    display_name: 'Neck Line Angle',
    param_type: ParameterType.NUMERIC,
    unit: 'rad',
    description: 'Angle of neck center line (for geometry)',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 4,
      visible: false,
      category: 'Internal',
      order: 104,
    },
  }),

  neck_line_angle_deg: new UnifiedParameter({
    key: 'neck_line_angle_deg',
    display_name: 'Neck Line Angle (deg)',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of neck center line',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 10,
    },
  }),

  nut_top_x: new UnifiedParameter({
    key: 'nut_top_x',
    display_name: 'Nut Top X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of nut top where string contacts',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 105,
    },
  }),

  nut_top_y: new UnifiedParameter({
    key: 'nut_top_y',
    display_name: 'Nut Top Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of nut top where string contacts',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 106,
    },
  }),

  bridge_top_x: new UnifiedParameter({
    key: 'bridge_top_x',
    display_name: 'Bridge Top X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of bridge top where string contacts',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 107,
    },
  }),

  bridge_top_y: new UnifiedParameter({
    key: 'bridge_top_y',
    display_name: 'Bridge Top Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of bridge top where string contacts',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 108,
    },
  }),

  fb_bottom_end_x: new UnifiedParameter({
    key: 'fb_bottom_end_x',
    display_name: 'Fingerboard Bottom End X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of fingerboard bottom at end',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 109,
    },
  }),

  fb_bottom_end_y: new UnifiedParameter({
    key: 'fb_bottom_end_y',
    display_name: 'Fingerboard Bottom End Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of fingerboard bottom at end',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 110,
    },
  }),

  fb_direction_angle: new UnifiedParameter({
    key: 'fb_direction_angle',
    display_name: 'Fingerboard Direction Angle',
    param_type: ParameterType.NUMERIC,
    unit: 'rad',
    description: 'Angle of fingerboard direction',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 4,
      visible: false,
      category: 'Internal',
      order: 111,
    },
  }),

  fb_direction_angle_deg: new UnifiedParameter({
    key: 'fb_direction_angle_deg',
    display_name: 'Fingerboard Direction Angle (deg)',
    param_type: ParameterType.NUMERIC,
    unit: '°',
    description: 'Angle of fingerboard direction',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 1,
      visible: true,
      category: 'Geometry',
      order: 11,
    },
  }),

  fb_thickness_at_end: new UnifiedParameter({
    key: 'fb_thickness_at_end',
    display_name: 'Fingerboard Thickness at End',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Fingerboard thickness at end',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 112,
    },
  }),

  fb_surface_point_x: new UnifiedParameter({
    key: 'fb_surface_point_x',
    display_name: 'Fingerboard Surface Point X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of fingerboard surface reference point',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 113,
    },
  }),

  fb_surface_point_y: new UnifiedParameter({
    key: 'fb_surface_point_y',
    display_name: 'Fingerboard Surface Point Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of fingerboard surface reference point',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 114,
    },
  }),

  string_x_at_fb_end: new UnifiedParameter({
    key: 'string_x_at_fb_end',
    display_name: 'String X at Fingerboard End',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate of string at fingerboard end',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 115,
    },
  }),

  string_y_at_fb_end: new UnifiedParameter({
    key: 'string_y_at_fb_end',
    display_name: 'String Y at Fingerboard End',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate of string at fingerboard end',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 116,
    },
  }),

  string_height_at_fb_end: new UnifiedParameter({
    key: 'string_height_at_fb_end',
    display_name: 'String Height at Fingerboard End',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'String height at end of fingerboard',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 117,
    },
  }),

  nut_perpendicular_intersection_x: new UnifiedParameter({
    key: 'nut_perpendicular_intersection_x',
    display_name: 'Nut Perpendicular Intersection X',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'X coordinate where nut perpendicular intersects rib plane',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 118,
    },
  }),

  nut_perpendicular_intersection_y: new UnifiedParameter({
    key: 'nut_perpendicular_intersection_y',
    display_name: 'Nut Perpendicular Intersection Y',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Y coordinate where nut perpendicular intersects rib plane',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 119,
    },
  }),

  nut_to_perpendicular_distance: new UnifiedParameter({
    key: 'nut_to_perpendicular_distance',
    display_name: 'Nut to Perpendicular Distance',
    param_type: ParameterType.NUMERIC,
    unit: 'mm',
    description: 'Distance from nut to perpendicular intersection',
    role: ParameterRole.OUTPUT_ONLY,
    output_config: {
      decimals: 2,
      visible: false,
      category: 'Internal',
      order: 120,
    },
  }),
}

// ============================================================
// VALIDATION
// ============================================================

export function validateRegistry(): void {
  const errors: string[] = []

  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (param.role === ParameterRole.CONDITIONAL) {
      if (!param.input_config) {
        errors.push(`${key}: CONDITIONAL parameter must have input_config`)
      }
      if (!param.output_config) {
        errors.push(`${key}: CONDITIONAL parameter must have output_config`)
      }
      if (!param.is_output_for) {
        errors.push(`${key}: CONDITIONAL parameter must have is_output_for dict`)
      }
    }

    if (param.role === ParameterRole.INPUT_ONLY && !param.input_config) {
      errors.push(`${key}: INPUT_ONLY parameter must have input_config`)
    }

    if (param.role === ParameterRole.OUTPUT_ONLY && !param.output_config) {
      errors.push(`${key}: OUTPUT_ONLY parameter must have output_config`)
    }

    // Check snake_case naming
    if (key !== key.toLowerCase() || key.includes(' ')) {
      errors.push(`${key}: Key must be lowercase_snake_case (no spaces, no capitals)`)
    }

    // Check that ENUM types have enum_values
    if (param.param_type === ParameterType.ENUM && !param.enum_values) {
      errors.push(`${key}: ENUM parameter must have enum_values`)
    }
  }

  if (errors.length > 0) {
    throw new Error('Parameter registry validation failed:\n' + errors.join('\n'))
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getParameter(key: string): UnifiedParameter | undefined {
  return PARAMETER_REGISTRY[key]
}

export function getAllInputParameters(
  instrumentFamily?: string
): Record<string, UnifiedParameter> {
  const result: Record<string, UnifiedParameter> = {}
  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (instrumentFamily) {
      if (param.isInputInMode(instrumentFamily)) {
        result[key] = param
      }
    } else {
      if (param.input_config != null) {
        result[key] = param
      }
    }
  }
  return result
}

export function getAllOutputParameters(
  instrumentFamily?: string
): Record<string, UnifiedParameter> {
  const result: Record<string, UnifiedParameter> = {}
  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (instrumentFamily) {
      if (param.isOutputInMode(instrumentFamily)) {
        result[key] = param
      }
    } else {
      if (param.output_config != null) {
        result[key] = param
      }
    }
  }
  return result
}

export function getDefaultValues(): Record<string, number | boolean | string> {
  const defaults: Record<string, number | boolean | string> = {}

  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    // Skip output-only parameters
    if (param.role === ParameterRole.OUTPUT_ONLY) continue
    if (!param.input_config) continue

    const defaultVal = param.input_config.default
    defaults[key] = defaultVal
  }

  return defaults
}

export function validateParameters(
  params: Record<string, unknown>
): [boolean, string[]] {
  const errors: string[] = []

  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (!(key in params)) continue

    const value = params[key]

    if (param.param_type === ParameterType.NUMERIC && param.input_config) {
      const numVal = value as number
      if (numVal < param.input_config.min_val) {
        errors.push(`${param.display_name} must be at least ${param.input_config.min_val}`)
      }
      if (numVal > param.input_config.max_val) {
        errors.push(`${param.display_name} must be at most ${param.input_config.max_val}`)
      }
    }
  }

  return [errors.length === 0, errors]
}

export function getParameterCategories(): string[] {
  return [
    'General',
    'Basic Dimensions',
    'Fingerboard Dimensions',
    'Neck Root Geometry',
    'Fret Configuration',
    'Advanced Geometry',
    'Viol Construction',
    'Display Options',
  ]
}

export function getParametersAsJson(): string {
  const paramsDict: Record<string, unknown> = {}

  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (param.role === ParameterRole.OUTPUT_ONLY) continue
    if (!param.input_config) continue

    paramsDict[key] = param.toInputMetadata()
  }

  return JSON.stringify({
    parameters: paramsDict,
    categories: getParameterCategories(),
  })
}

export function getDerivedMetadataAsDict(): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}

  for (const [key, param] of Object.entries(PARAMETER_REGISTRY)) {
    if (!param.output_config) continue
    metadata[key] = param.toOutputMetadata()
  }

  return metadata
}

// Run validation when module is loaded
if (Object.keys(PARAMETER_REGISTRY).length > 0) {
  validateRegistry()
}
