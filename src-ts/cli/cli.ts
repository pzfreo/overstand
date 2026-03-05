#!/usr/bin/env tsx
/**
 * Overstand CLI - Generate instrument neck templates from parameter files.
 *
 * Usage:
 *   overstand params.json --view side -o diagram.svg
 *   overstand params.json --all --output-dir ./output
 *   overstand params.json --view dimensions -o dims.html
 */

import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateViolin, loadStencilFont } from '../instrument_generator'
import { getDefaultValues } from '../parameter_registry'
import type { Params } from '../types'

import { sanitizeFilename, getUniqueFilename, VIEW_NAMES, VALID_VIEWS } from './utils'
import {
  generateStandaloneDimensionsHTML,
  generateStandaloneFretPositionsHTML,
} from './dimensions'
import {
  svgToPdfBuffer,
  dimensionsTableToPdfBuffer,
  fretPositionsToPdfBuffer,
} from './pdf'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`Usage: overstand <input.json> [options]

Generate instrument neck templates from parameter files.

Arguments:
  input.json              Input JSON parameter file

Options:
  --view <name>           View to generate: ${VALID_VIEWS.join(', ')}
  --all                   Generate all views (requires --output-dir)
  --pdf                   Output as PDF instead of SVG/HTML
  -o, --output <file>     Output file (default: stdout)
  --output-dir <dir>      Output directory for --all mode
  -h, --help              Show this help message

Examples:
  overstand params.json --view side
  overstand params.json --view side -o side-view.svg
  overstand params.json --all --output-dir ./diagrams
  overstand params.json --view dimensions -o dims.html`)
}

// ---------------------------------------------------------------------------
// Parameter loading
// ---------------------------------------------------------------------------

export function loadParameters(jsonFile: string): Params {
  let raw: string
  try {
    raw = readFileSync(jsonFile, 'utf-8')
  } catch {
    console.error(`Error: File '${jsonFile}' not found`)
    process.exit(1)
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch (e) {
    console.error(`Error: Invalid JSON in '${jsonFile}': ${(e as Error).message}`)
    process.exit(1)
  }

  // Handle wrapped format { metadata, parameters }
  if ('parameters' in data && typeof data['parameters'] === 'object') {
    return data['parameters'] as Params
  }
  return data as Params
}

// ---------------------------------------------------------------------------
// View generation
// ---------------------------------------------------------------------------

interface ViewContent {
  content: string | Buffer
  ext: string
  paperSize?: string // e.g. 'a4', 'a3' — set for PDF output
}

import type { GenerateViolinResult } from '../instrument_generator'

interface GeneratedOutput {
  views: Record<string, ViewContent>
  result: GenerateViolinResult
}

async function generateAllViews(
  params: Params,
  viewsRequested: string[],
): Promise<GeneratedOutput> {
  // Load font if radius_template is requested
  if (viewsRequested.includes('radius_template')) {
    const fontPath = path.resolve(__dirname, '../../web/fonts/AllertaStencil-Regular.ttf')
    if (existsSync(fontPath)) {
      await loadStencilFont(fontPath)
    }
  }

  const result = generateViolin(params)

  if (!result.success) {
    console.error('Error:', result.errors.join(', '))
    process.exit(1)
  }

  const instrumentName = (params['instrument_name'] as string) || 'Instrument'
  const views: Record<string, ViewContent> = {}

  // SVG views
  for (const viewKey of ['side', 'cross_section', 'radius_template']) {
    if (viewsRequested.includes(viewKey) && result.views?.[viewKey]) {
      views[viewKey] = { content: result.views[viewKey], ext: 'svg' }
    }
  }

  // Dimensions HTML
  if (viewsRequested.includes('dimensions')) {
    views['dimensions'] = {
      content: generateStandaloneDimensionsHTML(
        params,
        result.derived_values ?? {},
        result.derived_formatted ?? {},
        result.derived_metadata ?? {},
      ),
      ext: 'html',
    }
  }

  // Fret positions HTML
  if (viewsRequested.includes('fret_positions') && result.fret_positions) {
    if (result.fret_positions.available) {
      views['fret_positions'] = {
        content: generateStandaloneFretPositionsHTML(instrumentName, result.fret_positions),
        ext: 'html',
      }
    } else if (!viewsRequested.includes('side')) {
      // Only warn if fret_positions was explicitly requested (not part of --all)
      console.error(`Note: ${result.fret_positions.message || 'Fret positions not available for this instrument'}`)
    }
  }

  return { views, result }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        view: { type: 'string' },
        all: { type: 'boolean', default: false },
        pdf: { type: 'boolean', default: false },
        output: { type: 'string', short: 'o' },
        'output-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`)
    process.exit(1)
  }

  const { values: opts, positionals } = parsed

  if (opts.help) {
    printUsage()
    process.exit(0)
  }

  // Validate arguments
  if (positionals.length !== 1) {
    console.error('Error: Expected exactly one input file')
    printUsage()
    process.exit(1)
  }

  if (opts.all && opts.view) {
    console.error('Error: Cannot use both --all and --view')
    process.exit(1)
  }

  if (!opts.all && !opts.view) {
    console.error('Error: Either --view or --all must be specified')
    process.exit(1)
  }

  if (opts.all && !opts['output-dir']) {
    console.error('Error: --all requires --output-dir')
    process.exit(1)
  }

  if (opts.view && !VALID_VIEWS.includes(opts.view)) {
    console.error(`Error: Invalid view '${opts.view}'. Valid views: ${VALID_VIEWS.join(', ')}`)
    process.exit(1)
  }

  // Load and merge parameters
  const inputFile = positionals[0]
  const params = loadParameters(inputFile)
  const defaults = getDefaultValues()
  const mergedParams: Params = { ...defaults, ...params }

  const instrumentName = sanitizeFilename(
    (mergedParams['instrument_name'] as string) || 'instrument',
  )

  // Determine which views to generate
  const viewsRequested = opts.all ? [...VALID_VIEWS] : [opts.view!]
  const { views, result } = await generateAllViews(mergedParams, viewsRequested)

  // Convert to PDF if requested
  if (opts.pdf) {
    for (const [viewKey, view] of Object.entries(views)) {
      if (view.ext === 'svg') {
        const { buffer, paperSize } = await svgToPdfBuffer(view.content as string)
        views[viewKey] = {
          content: buffer,
          ext: 'pdf',
          paperSize: paperSize.toLowerCase(),
        }
      } else if (viewKey === 'dimensions') {
        views[viewKey] = {
          content: await dimensionsTableToPdfBuffer(
            mergedParams,
            result.derived_values ?? {},
            result.derived_formatted ?? {},
            result.derived_metadata ?? {},
          ),
          ext: 'pdf',
        }
      } else if (viewKey === 'fret_positions' && result.fret_positions) {
        views[viewKey] = {
          content: await fretPositionsToPdfBuffer(
            (mergedParams['instrument_name'] as string) || 'Instrument',
            result.fret_positions,
          ),
          ext: 'pdf',
        }
      }
    }
  }

  if (opts.all) {
    // Generate all views to output directory
    const outputDir = opts['output-dir']!
    mkdirSync(outputDir, { recursive: true })

    for (const [viewKey, view] of Object.entries(views)) {
      const viewName = VIEW_NAMES[viewKey] || viewKey
      const sizeSuffix = view.paperSize ? `_${view.paperSize}` : ''
      const outputFile = path.join(outputDir, `${instrumentName}_${viewName}${sizeSuffix}.${view.ext}`)
      writeFileSync(outputFile, view.content)
      console.log(`Generated: ${outputFile}`)
    }
  } else {
    // Single view
    const viewKey = opts.view!
    const view = views[viewKey]

    if (!view) {
      console.error(`Error: View '${viewKey}' produced no output`)
      process.exit(1)
    }

    if (opts.output) {
      writeFileSync(opts.output, view.content)
      console.log(`Generated: ${opts.output}`)
    } else {
      process.stdout.write(view.content)
    }
  }
}

// Only run when executed directly via tsx (not when imported for testing or via main.ts)
const __thisFile = fileURLToPath(import.meta.url)
const isDirectRun =
  process.argv[1] &&
  __thisFile.endsWith('cli.ts') &&
  process.argv[1].replace(/\.ts$/, '').endsWith('cli')
if (isDirectRun) {
  main().catch((e) => {
    console.error(`Unexpected error: ${(e as Error).message}`)
    process.exit(1)
  })
}
