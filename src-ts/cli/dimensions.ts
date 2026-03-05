/**
 * Standalone HTML generators for CLI output.
 *
 * These produce complete HTML documents (with inline CSS) suitable for
 * saving to files or converting to PDF. They use the parameter registry
 * directly and have no browser/DOM dependencies.
 */

import {
  getParameterCategories,
  getAllInputParameters,
} from '../parameter_registry'
import { ParameterType } from '../types'
import type { Params } from '../types'
import type { FretPositionsResult } from '../instrument_generator'

const CSS = `
body { font-family: Arial, sans-serif; margin: 40px; }
h1 { color: #4F46E5; }
table { border-collapse: collapse; width: 100%; max-width: 800px; }
th { background: #4F46E5; color: white; padding: 12px; text-align: left; }
td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
tr:hover { background: #f9fafb; }
.category-header { background: #f3f4f6; font-weight: 600; color: #374151; }
.param-unit { color: #6b7280; font-size: 0.9em; font-style: italic; }
`

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`
}

/**
 * Generate a full-page dimensions HTML document.
 */
export function generateStandaloneDimensionsHTML(
  params: Params,
  derivedValues: Record<string, number | null>,
  derivedFormatted: Record<string, string>,
  derivedMetadata: Record<string, unknown>,
): string {
  const instrumentName = (params['instrument_name'] as string) || 'Instrument'
  const instrumentFamily = (params['instrument_family'] as string) || 'VIOLIN'
  const categories = getParameterCategories()
  const inputParams = getAllInputParameters()

  let table = '<table>\n<thead><tr><th>Parameter</th><th>Value</th></tr></thead>\n<tbody>\n'

  for (const category of categories) {
    if (category === 'Display Options') continue

    // Collect visible parameters for this category
    const visibleInCategory: Array<[string, (typeof inputParams)[string]]> = []
    for (const [key, param] of Object.entries(inputParams)) {
      const paramCategory = param.input_config?.category
      if (paramCategory !== category) continue
      if (!param.isVisibleInContext(params as Record<string, unknown>)) continue
      // Skip output-for-this-family params
      if (param.is_output_for?.[instrumentFamily]) continue
      visibleInCategory.push([key, param])
    }

    if (visibleInCategory.length === 0) continue

    table += `<tr><td colspan="2" class="category-header">${category}</td></tr>\n`

    for (const [key, param] of visibleInCategory) {
      const value = params[key]
      if (value == null) continue

      let displayValue: string
      if (param.param_type === ParameterType.NUMERIC) {
        displayValue = `${value} <span class="param-unit">${param.unit}</span>`
      } else if (param.param_type === ParameterType.BOOLEAN) {
        displayValue = value ? 'Yes' : 'No'
      } else if (param.param_type === ParameterType.ENUM && param.enum_values) {
        const match = param.enum_values.find((e) => e.value === value)
        displayValue = match ? match.label : String(value)
      } else {
        displayValue = String(value)
      }

      table += `<tr><td>${param.display_name}</td><td>${displayValue}</td></tr>\n`
    }
  }

  // Derived values
  if (derivedValues && Object.keys(derivedValues).length > 0) {
    // Group by category
    const grouped = new Map<string, Array<{ key: string; value: number | null; meta: Record<string, unknown> }>>()

    for (const [key, value] of Object.entries(derivedValues)) {
      const meta = (derivedMetadata?.[key] ?? {}) as Record<string, unknown>
      if (!meta['visible']) continue

      const category = (meta['category'] as string) || 'Calculated Values'
      if (!grouped.has(category)) grouped.set(category, [])
      grouped.get(category)!.push({ key, value, meta })
    }

    for (const [category, items] of grouped) {
      items.sort((a, b) => ((a.meta['order'] as number) ?? 999) - ((b.meta['order'] as number) ?? 999))
      table += `<tr><td colspan="2" class="category-header">${category}</td></tr>\n`

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
        table += `<tr><td>${displayName}</td><td>${formattedValue}</td></tr>\n`
      }
    }
  }

  table += '</tbody>\n</table>'

  return htmlPage(
    `${instrumentName} - Dimensions`,
    `<h1>${instrumentName} - Dimensions</h1>\n${table}`,
  )
}

/**
 * Generate a full-page fret positions HTML document.
 */
export function generateStandaloneFretPositionsHTML(
  instrumentName: string,
  fretPositions: FretPositionsResult,
): string {
  if (!fretPositions.available || !fretPositions.html) {
    return htmlPage(
      `${instrumentName} - Fret Positions`,
      `<h1>${instrumentName} - Fret Positions</h1>\n<p>Fret positions not available for this instrument.</p>`,
    )
  }

  return htmlPage(
    `${instrumentName} - Fret Positions`,
    `<h1>${instrumentName} - Fret Positions</h1>\n${fretPositions.html}`,
  )
}
