/**
 * Overstand - Instrument Generator (TypeScript port)
 *
 * Main generator orchestrator - coordinates between parameters, validation,
 * and geometry generation.
 *
 * Ported from src/instrument_generator.py
 *
 * NOTE ON API SURFACE:
 *
 * The JSON-based functions (generateViolinNeck, getDerivedValues, etc.) accept
 * and return JSON strings to match the Python API surface exactly - this keeps
 * JavaScript call sites unchanged when switching from Pyodide to TypeScript.
 *
 * The object-based generateViolin function is provided for direct TypeScript
 * use (e.g. parity tests) and accepts/returns plain objects.
 */

import {
  validateParameters,
  getParametersAsJson,
  getDerivedMetadataAsDict,
  getAllOutputParameters,
} from './parameter_registry'

import {
  calculateDerivedValues,
  generateMultiViewSvg,
} from './instrument_geometry'

import { getUiMetadataBundle } from './ui_metadata'

import { calculateFretPositions } from './geometry_engine'

export { loadStencilFont } from './radius_template'

import type { Params } from './geometry_engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateViolinResult {
  success: boolean
  views: Record<string, string> | null
  fret_positions: FretPositionsResult | null
  derived_values: Record<string, number | null> | null
  derived_formatted: Record<string, string> | null
  derived_metadata: Record<string, unknown> | null
  errors: string[]
}

export interface FretPositionsResult {
  available: boolean
  html?: string
  vsl?: number
  no_frets?: number
  message?: string
}

export interface DerivedValuesResult {
  success: boolean
  values?: Record<string, number | null>
  formatted?: Record<string, string>
  metadata?: Record<string, unknown>
  errors?: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate fret positions view (HTML table + metadata).
 * Mirrors view_generator.py generate_fret_positions_view().
 */
function generateFretPositionsView(params: Params): FretPositionsResult {
  const vsl = (params['vsl'] as number) || 0
  const instrumentFamily = (params['instrument_family'] as string) || 'VIOLIN'
  let noFrets: number

  if (params['no_frets'] != null) {
    noFrets = params['no_frets'] as number
  } else if (instrumentFamily === 'VIOL') {
    noFrets = 7
  } else if (instrumentFamily === 'GUITAR_MANDOLIN') {
    noFrets = 20
  } else {
    noFrets = 0
  }

  if (noFrets === 0) {
    return { available: false, message: 'Fret positions not applicable for violin family' }
  }

  const fretPositions = calculateFretPositions(vsl, noFrets)

  let html = '<div class="fret-table-container">'
  html += '<table class="fret-table">'
  html +=
    '<thead><tr><th>Fret</th><th>Distance from Nut (mm)</th><th>Distance from Previous Fret (mm)</th></tr></thead>'
  html += '<tbody>'

  let prevPos = 0
  for (let i = 0; i < fretPositions.length; i++) {
    const pos = fretPositions[i]!
    const fretNum = i + 1
    const fromNut = pos
    const fromPrev = pos - prevPos
    html += `<tr><td>${fretNum}</td><td>${fromNut.toFixed(1)}</td><td>${fromPrev.toFixed(1)}</td></tr>`
    prevPos = pos
  }

  html += '</tbody></table></div>'

  return {
    available: true,
    html,
    vsl,
    no_frets: noFrets,
  }
}

/**
 * Build formatted derived values and metadata dict.
 */
function buildFormattedAndMetadata(
  derivedValues: Record<string, number | null>
): {
  formattedValues: Record<string, string>
  metadataDict: Record<string, unknown>
} {
  const outputParams = getAllOutputParameters()
  const formattedValues: Record<string, string> = {}
  const metadataDict: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(derivedValues)) {
    if (value === null) continue
    const param = outputParams[key]
    if (!param || !param.output_config) continue

    const decimals = param.output_config.decimals
    const formatted = value.toFixed(decimals)
    if (param.unit) {
      formattedValues[key] = `${formatted} ${param.unit}`
    } else {
      formattedValues[key] = formatted
    }
    metadataDict[key] = param.toOutputMetadata()
  }

  return { formattedValues, metadataDict }
}

// ---------------------------------------------------------------------------
// generateViolin (object-based, for TypeScript direct use / parity tests)
// ---------------------------------------------------------------------------

/**
 * Generate all views and derived values for an instrument.
 *
 * Accepts and returns plain objects (not JSON strings).
 * This is the main TypeScript entry point, e.g. for parity tests.
 */
export function generateViolin(params: Params): GenerateViolinResult {
  try {
    const [isValid, errors] = validateParameters(params)

    if (!isValid) {
      return {
        success: false,
        views: null,
        fret_positions: null,
        derived_values: null,
        derived_formatted: null,
        derived_metadata: null,
        errors,
      }
    }

    try {
      const views = generateMultiViewSvg(params)
      const fretPositions = generateFretPositionsView(params)
      const derivedValues = calculateDerivedValues(params)

      const { formattedValues, metadataDict } = buildFormattedAndMetadata(derivedValues)

      return {
        success: true,
        views,
        fret_positions: fretPositions,
        derived_values: derivedValues,
        derived_formatted: formattedValues,
        derived_metadata: metadataDict,
        errors: [],
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isGeometryError =
        msg.includes('math domain error') ||
        msg.includes('Invalid geometric constraints')
      const errorMsg = isGeometryError
        ? 'Invalid geometric constraints - check that neck dimensions, angles, and measurements are compatible. Common issues: bridge height too low, neck angle too steep, or fingerboard radius too small for the width.'
        : `Geometry generation failed: ${msg}`

      return {
        success: false,
        views: null,
        fret_positions: null,
        derived_values: null,
        derived_formatted: null,
        derived_metadata: null,
        errors: [errorMsg],
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      success: false,
      views: null,
      fret_positions: null,
      derived_values: null,
      derived_formatted: null,
      derived_metadata: null,
      errors: [`Unexpected error: ${msg}`],
    }
  }
}

// ---------------------------------------------------------------------------
// JSON-based API (mirrors Python instrument_generator.py exactly)
// ---------------------------------------------------------------------------

/**
 * Main generation entry point - called by generation.js generateNeck().
 *
 * Accepts and returns JSON strings, matching the Python generate_violin_neck() API.
 * Strips _generator_url before processing (it's added by generation.js but is
 * not a real instrument parameter).
 */
export function generateViolinNeck(paramsJson: string): string {
  try {
    const params = JSON.parse(paramsJson) as Params

    // Strip internal metadata keys not part of the instrument parameter set
    if ('_generator_url' in params) {
      delete (params as Record<string, unknown>)['_generator_url']
    }

    const result = generateViolin(params)

    return JSON.stringify(result)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return JSON.stringify({
        success: false,
        views: null,
        errors: [`Invalid parameter JSON: ${e.message}`],
      })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return JSON.stringify({
      success: false,
      views: null,
      errors: [`Unexpected error: ${msg}`],
    })
  }
}

/**
 * Calculate derived values only (no SVG rendering).
 *
 * Returns JSON: { success, values, formatted, metadata }
 * Mirrors Python get_derived_values().
 */
export function getDerivedValues(paramsJson: string): string {
  try {
    const params = JSON.parse(paramsJson) as Params
    const derivedRaw = calculateDerivedValues(params)

    const { formattedValues, metadataDict } = buildFormattedAndMetadata(derivedRaw)

    return JSON.stringify({
      success: true,
      values: derivedRaw,
      metadata: metadataDict,
      formatted: formattedValues,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return JSON.stringify({
      success: false,
      errors: [msg],
    })
  }
}

/**
 * Get metadata definitions for all derived/output values.
 *
 * Returns JSON: { success, metadata }
 * Mirrors Python get_derived_value_metadata().
 */
export function getDerivedValueMetadata(): string {
  try {
    return JSON.stringify({
      success: true,
      metadata: getDerivedMetadataAsDict(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return JSON.stringify({
      success: false,
      errors: [msg],
    })
  }
}

/**
 * Get parameter definitions for UI generation.
 *
 * Returns JSON of parameter definitions.
 * Mirrors Python get_parameter_definitions().
 */
export function getParameterDefinitions(): string {
  try {
    return getParametersAsJson()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return JSON.stringify({
      success: false,
      errors: [`Failed to load parameters: ${msg}`],
    })
  }
}

/**
 * Get complete UI metadata bundle.
 *
 * Returns JSON: { success, metadata: { sections, presets, parameters, derived_values } }
 * Mirrors Python get_ui_metadata().
 */
export function getUiMetadata(): string {
  try {
    return JSON.stringify({
      success: true,
      metadata: getUiMetadataBundle(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return JSON.stringify({
      success: false,
      errors: [msg],
    })
  }
}
