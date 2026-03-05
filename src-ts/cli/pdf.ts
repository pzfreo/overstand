/**
 * CLI PDF adapter — thin wrapper around shared pdf_core.
 *
 * Builds table data from parameter_registry (CLI data source),
 * delegates rendering to the shared core, returns Node Buffers.
 */

import {
  svgToPdf,
  dimensionsTableToPdf,
  fretPositionsToPdf,
  parseFretRowsFromHtml,
  parseSvgDimensions,
  selectPaperSize,
} from '../pdf/pdf_core'
import type { SvgPdfResult, TableSection } from '../pdf/pdf_core'

import {
  getParameterCategories,
  getAllInputParameters,
} from '../parameter_registry'
import { ParameterType } from '../types'
import type { Params } from '../types'
import type { FretPositionsResult } from '../instrument_generator'

// Re-export types and utilities that the CLI uses directly
export { parseSvgDimensions, selectPaperSize }
export type { SvgPdfResult }

// ---------------------------------------------------------------------------
// SVG → PDF (Buffer wrapper)
// ---------------------------------------------------------------------------

export interface SvgPdfBufferResult {
  buffer: Buffer
  paperSize: string
}

export async function svgToPdfBuffer(svg: string): Promise<SvgPdfBufferResult> {
  const result = await svgToPdf(svg)
  return { buffer: Buffer.from(result.bytes), paperSize: result.paperSize }
}

// ---------------------------------------------------------------------------
// Dimensions table → PDF (builds sections from parameter_registry)
// ---------------------------------------------------------------------------

export async function dimensionsTableToPdfBuffer(
  params: Params,
  derivedValues: Record<string, number | null>,
  derivedFormatted: Record<string, string>,
  derivedMetadata: Record<string, unknown>,
): Promise<Buffer> {
  const instrumentName = (params['instrument_name'] as string) || 'Instrument'
  const instrumentFamily = (params['instrument_family'] as string) || 'VIOLIN'
  const categories = getParameterCategories()
  const inputParams = getAllInputParameters()

  const sections: TableSection[] = []

  // Input parameters by category
  for (const category of categories) {
    if (category === 'Display Options') continue

    const rows: Array<{ label: string; value: string }> = []
    for (const [key, param] of Object.entries(inputParams)) {
      if (param.input_config?.category !== category) continue
      if (!param.isVisibleInContext(params as Record<string, unknown>)) continue
      if (param.is_output_for?.[instrumentFamily]) continue

      const value = params[key]
      if (value == null) continue

      let displayValue: string
      if (param.param_type === ParameterType.NUMERIC) {
        displayValue = `${value} ${param.unit}`
      } else if (param.param_type === ParameterType.BOOLEAN) {
        displayValue = value ? 'Yes' : 'No'
      } else if (param.param_type === ParameterType.ENUM && param.enum_values) {
        const match = param.enum_values.find((e) => e.value === value)
        displayValue = match ? match.label : String(value)
      } else {
        displayValue = String(value)
      }

      rows.push({ label: param.display_name, value: displayValue })
    }

    if (rows.length > 0) {
      sections.push({ category, rows })
    }
  }

  // Derived values
  if (derivedValues && Object.keys(derivedValues).length > 0) {
    const grouped = new Map<
      string,
      Array<{ key: string; value: number | null; meta: Record<string, unknown> }>
    >()

    for (const [key, value] of Object.entries(derivedValues)) {
      const meta = (derivedMetadata?.[key] ?? {}) as Record<string, unknown>
      if (!meta['visible']) continue

      const cat = (meta['category'] as string) || 'Calculated Values'
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push({ key, value, meta })
    }

    for (const [cat, items] of grouped) {
      items.sort(
        (a, b) => ((a.meta['order'] as number) ?? 999) - ((b.meta['order'] as number) ?? 999),
      )

      const rows: Array<{ label: string; value: string }> = []
      for (const { key, value, meta } of items) {
        const displayName = (meta['display_name'] as string) || key
        let formattedValue: string
        if (value == null || isNaN(value)) {
          formattedValue = '—'
        } else if (derivedFormatted[key]) {
          formattedValue = derivedFormatted[key]
        } else {
          const decimals = (meta['decimals'] as number) ?? 2
          const unit = (meta['unit'] as string) ?? ''
          formattedValue = `${value.toFixed(decimals)} ${unit}`.trim()
        }
        rows.push({ label: displayName, value: formattedValue })
      }

      sections.push({ category: cat, rows })
    }
  }

  const bytes = await dimensionsTableToPdf(instrumentName, sections)
  return Buffer.from(bytes)
}

// ---------------------------------------------------------------------------
// Fret positions → PDF (parses HTML, delegates to core)
// ---------------------------------------------------------------------------

export async function fretPositionsToPdfBuffer(
  instrumentName: string,
  fretPositions: FretPositionsResult,
): Promise<Buffer> {
  const fretRows =
    fretPositions.available && fretPositions.html
      ? parseFretRowsFromHtml(fretPositions.html)
      : null

  const bytes = await fretPositionsToPdf(
    instrumentName,
    fretPositions.vsl ?? null,
    fretPositions.no_frets ?? null,
    fretRows,
  )
  return Buffer.from(bytes)
}
