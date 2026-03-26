/**
 * Overstand - UI Metadata Definitions (TypeScript port)
 *
 * Defines the organization of the user interface including:
 * - Section definitions (collapsible groups of parameters)
 * - Instrument presets (quick-start templates)
 * - UI structure and hierarchy
 *
 * Ported from src/ui_metadata.py
 */

import {
  getAllInputParameters,
  getAllOutputParameters,
  PARAMETER_REGISTRY,
} from './parameter_registry'

// ---------------------------------------------------------------------------
// SectionType enum
// ---------------------------------------------------------------------------

export enum SectionType {
  INPUT_BASIC = 'input_basic',
  INPUT_ADVANCED = 'input_advanced',
  OUTPUT_CORE = 'output_core',
  OUTPUT_DETAILED = 'output_detailed',
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SectionDefinition {
  id: string
  title: string
  type: SectionType
  icon: string
  default_expanded: boolean
  order: number
  parameter_names: string[]
  description: string
}

export interface PresetMetadata {
  id: string
  display_name: string
  family: string
  icon: string
  description: string
  filepath: string
}

export interface KeyMeasurement {
  key: string
  primary?: boolean
  key_conditional?: Record<string, string>
}

export interface UiMetadataBundle {
  sections: Record<string, SectionDefinition>
  parameters: Record<string, unknown>
  derived_values: Record<string, unknown>
  presets: Record<string, PresetMetadata>
  key_measurements: KeyMeasurement[]
}

// ---------------------------------------------------------------------------
// SECTIONS
// ---------------------------------------------------------------------------

export const SECTIONS: Record<string, SectionDefinition> = {
  // Stage 1: Instrument Identity
  identity: {
    id: 'identity',
    title: 'Instrument Identity',
    type: SectionType.INPUT_BASIC,
    icon: '🎻',
    default_expanded: true,
    order: 1,
    parameter_names: [
      'instrument_name',
      'instrument_family',
      'vsl',
    ],
    description: "What you're building and at what scale - these define the foundation",
  },

  // Stage 2: Body & Bridge
  body_and_bridge: {
    id: 'body_and_bridge',
    title: 'Body & Bridge',
    type: SectionType.INPUT_BASIC,
    icon: '📐',
    default_expanded: true,
    order: 2,
    parameter_names: [
      'body_length',
      'overstand',
      'bridge_height',
      'arching_height',
      'body_stop',
      'fret_join',
    ],
    description: "Core side-view geometry: the \"triangle\" that defines your instrument's profile. For guitars, fret_join defines where the neck meets the body (like body_stop for violins)",
  },

  // Stage 3: String Action
  string_action: {
    id: 'string_action',
    title: 'String Action',
    type: SectionType.INPUT_BASIC,
    icon: '🎼',
    default_expanded: true,
    order: 3,
    parameter_names: [
      'string_height_nut',
      'string_height_eof',
      'string_height_12th_fret',
    ],
    description: 'String height at key points - REQUIRED for side view generation. The neck angle is calculated from these values',
  },

  // Stage 4: Viol Specific
  viol_specific: {
    id: 'viol_specific',
    title: 'Viol Geometry',
    type: SectionType.INPUT_ADVANCED,
    icon: '🎻',
    default_expanded: false,
    order: 4,
    parameter_names: [
      'back_break_length',
      'top_block_height',
    ],
    description: 'Viol-specific side view geometry: back break length and top block height',
  },

  // Stage 5: Fingerboard
  fingerboard: {
    id: 'fingerboard',
    title: 'Fingerboard',
    type: SectionType.INPUT_ADVANCED,
    icon: '🎯',
    default_expanded: false,
    order: 5,
    parameter_names: [
      'fingerboard_length',
      'fingerboard_radius',
      'fingerboard_width_at_nut',
      'fingerboard_width_at_end',
      'fb_visible_height_at_nut',
      'fb_visible_height_at_join',
    ],
    description: 'Fingerboard dimensions - length (side view), curvature and width (cross-section), visible heights (both views)',
  },

  // Stage 6: Cross-Section Neck
  neck_cross_section: {
    id: 'neck_cross_section',
    title: 'Cross-Section: Neck',
    type: SectionType.INPUT_ADVANCED,
    icon: '📏',
    default_expanded: false,
    order: 6,
    parameter_names: [
      'button_width_at_join',
      'neck_width_at_top_of_ribs',
      'fb_blend_percent',
    ],
    description: 'Neck dimensions at the body join - defines the neck cross-section view',
  },

  // Stage 7: Frets
  frets: {
    id: 'frets',
    title: 'Frets',
    type: SectionType.INPUT_ADVANCED,
    icon: '📊',
    default_expanded: false,
    order: 7,
    parameter_names: [
      'no_frets',
    ],
    description: 'Number of frets to calculate (fret_join is in Body & Bridge section)',
  },

  // Stage 8: Advanced Geometry
  advanced_geometry: {
    id: 'advanced_geometry',
    title: 'Advanced Geometry',
    type: SectionType.INPUT_ADVANCED,
    icon: '⚙️',
    default_expanded: false,
    order: 8,
    parameter_names: [
      'rib_height',
      'belly_edge_thickness',
      'tailpiece_height',
    ],
    description: 'Advanced geometric parameters for fine-tuning. Note: neck_angle is always calculated, never manually input',
  },

  // Stage 9: Display Options
  display: {
    id: 'display',
    title: 'Display Options',
    type: SectionType.INPUT_ADVANCED,
    icon: '👁️',
    default_expanded: false,
    order: 9,
    parameter_names: [
      'show_measurements',
    ],
    description: 'Visualization and annotation settings',
  },

  // Core Outputs
  core_outputs: {
    id: 'core_outputs',
    title: 'Core Measurements',
    type: SectionType.OUTPUT_CORE,
    icon: '📊',
    default_expanded: true,
    order: 10,
    parameter_names: [
      'neck_angle',
      'neck_stop',
      'fret_join_position',
      'body_stop',
      'nut_relative_to_ribs',
      'string_break_angle',
      'downward_force_percent',
      'total_downforce',
      'fb_thickness_at_nut',
      'fb_thickness_at_join',
      'neck_block_max_width',
      'break_angle',
    ],
    description: 'Primary calculated values',
  },

  // Detailed Outputs
  detailed_outputs: {
    id: 'detailed_outputs',
    title: 'Detailed Calculations',
    type: SectionType.OUTPUT_DETAILED,
    icon: '🔬',
    default_expanded: false,
    order: 11,
    parameter_names: [
      'fb_fret_1_distance',
      'fb_thickness_at_fret_1',
      'fb_ref_fret_distance',
      'fb_thickness_at_ref_fret',
      'sagitta_at_nut',
      'sagitta_at_join',
      'string_angle_to_ribs',
      'string_angle_to_fingerboard',
      'afterlength_angle',
      'neck_line_angle_deg',
      'fb_direction_angle_deg',
      'neck_end_x',
      'neck_end_y',
      'nut_draw_radius',
      'nut_top_x',
      'nut_top_y',
      'bridge_top_x',
      'bridge_top_y',
      'fb_bottom_end_x',
      'fb_bottom_end_y',
      'fb_thickness_at_end',
      'nut_perpendicular_intersection_x',
      'nut_perpendicular_intersection_y',
      'nut_to_perpendicular_distance',
      'string_x_at_fb_end',
      'string_y_at_fb_end',
      'fb_surface_point_x',
      'fb_surface_point_y',
      'string_height_at_fb_end',
    ],
    description: 'Internal geometry and detailed calculations for advanced users',
  },
}

// ---------------------------------------------------------------------------
// KEY_MEASUREMENTS
// ---------------------------------------------------------------------------

export const KEY_MEASUREMENTS: KeyMeasurement[] = [
  { key: 'neck_angle', primary: true },
  { key: 'neck_stop', key_conditional: { GUITAR_MANDOLIN: 'body_stop' } },
  { key: 'nut_relative_to_ribs' },
  { key: 'string_break_angle' },
]

// ---------------------------------------------------------------------------
// PRESET_METADATA
// Hardcoded from scanning presets/ directory (manifest: presets/presets.json)
// Fields sourced from each preset JSON file's "metadata" section.
// ---------------------------------------------------------------------------

const PRESET_METADATA: PresetMetadata[] = [
  {
    id: 'archtop_guitar',
    display_name: 'Archtop Guitar',
    family: 'GUITAR_MANDOLIN',
    icon: '',
    description: 'Archtop jazz guitar dimensions (fret-join driven)',
    filepath: 'presets/archtop_guitar.json',
  },
  {
    id: 'bass_viol',
    display_name: 'Bass Viol',
    family: 'VIOL',
    icon: '',
    description: 'Bass viol dimensions (Viola da Gamba)',
    filepath: 'presets/bass_viol.json',
  },
  {
    id: 'cello',
    display_name: 'Cello',
    family: 'VIOLIN',
    icon: '',
    description: 'Standard cello dimensions',
    filepath: 'presets/cello.json',
  },
  {
    id: 'custom',
    display_name: 'Other / Custom',
    family: 'VIOLIN',
    icon: '',
    description: 'Start with default values for a custom instrument',
    filepath: 'presets/custom.json',
  },
  {
    id: 'mandola',
    display_name: 'Mandola',
    family: 'GUITAR_MANDOLIN',
    icon: '',
    description: 'Alto mandola dimensions (fret-join driven)',
    filepath: 'presets/mandola.json',
  },
  {
    id: 'mandolin',
    display_name: 'Mandolin',
    family: 'GUITAR_MANDOLIN',
    icon: '',
    description: 'Standard mandolin dimensions (fret-join driven)',
    filepath: 'presets/mandolin.json',
  },
  {
    id: 'octave_mandolin',
    display_name: 'Octave Mandolin',
    family: 'GUITAR_MANDOLIN',
    icon: '',
    description: 'Octave mandolin / bouzouki dimensions (fret-join driven)',
    filepath: 'presets/octave_mandolin.json',
  },
  {
    id: 'tenor_viol',
    display_name: 'Tenor Viol',
    family: 'VIOL',
    icon: '',
    description: 'Tenor viol dimensions',
    filepath: 'presets/tenor_viol.json',
  },
  {
    id: 'treble_viol',
    display_name: 'Treble Viol',
    family: 'VIOL',
    icon: '',
    description: 'Treble viol / Pardessus de viole',
    filepath: 'presets/treble_viol.json',
  },
  {
    id: 'viola',
    display_name: 'Viola',
    family: 'VIOLIN',
    icon: '',
    description: 'Standard viola dimensions',
    filepath: 'presets/viola.json',
  },
  {
    id: 'violin',
    display_name: 'Violin',
    family: 'VIOLIN',
    icon: '',
    description: 'Standard violin dimensions based on Stradivari models',
    filepath: 'presets/violin.json',
  },
]

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

/**
 * Get preset metadata array (hardcoded from presets/ directory scan).
 * In the web context, preset full parameters are still loaded via fetch.
 */
export function getPresetMetadata(): PresetMetadata[] {
  return PRESET_METADATA
}

/**
 * Export complete UI metadata bundle.
 *
 * This is the single source of truth for UI organization.
 * JavaScript loads this and renders the interface accordingly.
 *
 * Ported from ui_metadata.py get_ui_metadata_bundle()
 */
export function getUiMetadataBundle(): UiMetadataBundle {
  const inputParams = getAllInputParameters()
  const outputParams = getAllOutputParameters()

  const parameters: Record<string, unknown> = {}
  for (const [key, param] of Object.entries(inputParams)) {
    parameters[key] = param.toInputMetadata()
  }

  const derivedValues: Record<string, unknown> = {}
  for (const [key, param] of Object.entries(outputParams)) {
    derivedValues[key] = param.toOutputMetadata()
  }

  const presets: Record<string, PresetMetadata> = {}
  for (const p of PRESET_METADATA) {
    presets[p.id] = p
  }

  return {
    sections: SECTIONS,
    parameters,
    derived_values: derivedValues,
    presets,
    key_measurements: KEY_MEASUREMENTS,
  }
}

// ---------------------------------------------------------------------------
// Validate sections at module load
// ---------------------------------------------------------------------------

function validateSections(): void {
  const errors: string[] = []

  for (const [sectionId, section] of Object.entries(SECTIONS)) {
    for (const paramName of section.parameter_names) {
      if (!(paramName in PARAMETER_REGISTRY)) {
        errors.push(
          `Section '${sectionId}' references unknown parameter '${paramName}'`
        )
      }
    }
  }

  if (errors.length > 0) {
    const errorMsg = 'UI Section Validation Failed:\n  ' + errors.join('\n  ')
    throw new Error(errorMsg)
  }
}

validateSections()
