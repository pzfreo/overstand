/**
 * TypeScript type definitions for the Overstand instrument geometry engine.
 *
 * Ported from src/parameter_registry.py - Python enums and dataclasses
 * are represented as TypeScript enums and interfaces.
 */

// ============================================================
// ENUMS (ported from parameter_registry.py)
// ============================================================

/** Defines how a parameter is used in the system */
export enum ParameterRole {
  INPUT_ONLY = "input_only",    // Always a user input (e.g., vsl, body_length)
  OUTPUT_ONLY = "output_only",  // Always calculated (e.g., neck_angle)
  CONDITIONAL = "conditional",  // Input OR output depending on instrument family
}

/** Data type of the parameter */
export enum ParameterType {
  NUMERIC = "numeric",   // Float/int values with min/max
  ENUM = "enum",         // Dropdown selection from predefined options
  BOOLEAN = "boolean",   // True/False checkbox
  STRING = "string",     // Text input
}

/** Instrument family - determines calculation approach */
export enum InstrumentFamily {
  VIOLIN = "Violin Family (Body Stop Driven)",
  VIOL = "Viol Family (Body Stop Driven)",
  GUITAR_MANDOLIN = "Guitar/Mandolin Family (Fret Join Driven)",
}

/** Number of strings */
export enum StringCount {
  FOUR = "4 (Violin/Viola/Cello)",
  FIVE = "5 (Five-string Violin/Viola/Cello)",
  SIX = "6 (6 String Viol)",
  SEVEN = "7 (7 String Viol)",
}

/** Type of bowed instrument */
export enum InstrumentType {
  VIOLIN = "Violin",
  VIOLA = "Viola",
  CELLO = "Cello",
  PARDESSUS = "Pardessus",
  TREBLE = "Treble Viol",
  TENOR = "Tenor Viol",
  BASS = "Bass Viol",
  OTHER = "Other",
}

// ============================================================
// SHARED TYPE ALIASES
// ============================================================

/** A 2-D point as [x, y]. */
export type Point2D = [number, number]

/** Loosely-typed parameter bag passed to all geometry functions. */
export type Params = Record<string, number | boolean | string | null | undefined>

/** Derived values produced by the geometry engine. */
export type DerivedValues = Record<string, number | null | undefined>

// ============================================================
// INTERFACES (ported from Python dataclasses in parameter_registry.py)
// ============================================================

/**
 * Configuration for when a parameter is used as an input.
 * Defines validation rules, defaults, and conditional visibility.
 * Ported from Python dataclass InputConfig.
 */
export interface InputConfig {
  min_val: number
  max_val: number
  default: number | boolean | string | null
  step: number  // default 0.1 in Python
  visible_when: Record<string, string | string[]> | null  // Conditional visibility
  category: string  // default "Basic Dimensions"
}

/**
 * Configuration for when a parameter is used as an output.
 * Defines display formatting and organization.
 * Ported from Python dataclass OutputConfig.
 */
export interface OutputConfig {
  decimals: number   // default 1
  visible: boolean   // default true
  category: string   // default "Geometry"
  order: number      // default 0
}

/**
 * Unified parameter definition combining input and output metadata.
 * This is the single source of truth for all parameters in the system.
 * Ported from Python dataclass UnifiedParameter.
 */
export interface ParameterDef {
  // Identity
  key: string          // Canonical key (lowercase_snake_case)
  display_name: string // Human-readable name for UI

  // Type and basic metadata
  param_type: ParameterType
  unit: string         // Unit string (e.g., 'mm', '°', '')
  description: string  // Help text / tooltip
  help_text?: string   // Extended help (optional)

  // Role and behavior
  role: ParameterRole
  is_output_for?: Record<string, boolean>  // e.g. {'VIOLIN': false, 'GUITAR_MANDOLIN': true}

  // Type-specific configuration
  input_config?: InputConfig
  output_config?: OutputConfig
  enum_values?: Array<{ value: string; label: string }>  // For ENUM types
  max_length?: number  // For STRING types
}

/**
 * The params object passed to all geometry functions.
 * Must have instrument_family plus any number of named parameters.
 */
export interface InstrumentParams {
  instrument_family: InstrumentFamily

  // Common numeric parameters (non-exhaustive - there are 53+ in total)
  vsl?: number              // Vibrating string length (mm)
  body_stop?: number        // Body stop length (mm)
  body_length?: number      // Body length (mm)
  neck_angle?: number       // Neck angle (degrees)
  string_count?: number     // Number of strings
  overstand?: number        // Overstand (mm)
  projection?: number       // Projection (mm)
  fb_thickness_at_nut?: number  // Fingerboard thickness at nut (mm)
  fb_thickness_at_end?: number  // Fingerboard thickness at end (mm)
  fb_width_at_nut?: number      // Fingerboard width at nut (mm)
  fb_width_at_end?: number      // Fingerboard width at end (mm)
  fingerboard_radius?: number   // Fingerboard radius (mm)
  nut_to_first_fret?: number    // Nut to first fret (mm)
  num_frets?: number            // Number of frets

  // Index signature to allow any additional params from the full registry
  [key: string]: number | boolean | string | null | undefined | InstrumentFamily
}
