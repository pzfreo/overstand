/**
 * Tests for the TypeScript CLI.
 *
 * Ported from tests/test_cli.py with additions for new views
 * (radius_template, fret_positions).
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { sanitizeFilename, getUniqueFilename, VIEW_NAMES, VALID_VIEWS } from '../cli/utils'
import { loadParameters } from '../cli/cli'
import { generateStandaloneDimensionsHTML, generateStandaloneFretPositionsHTML } from '../cli/dimensions'
import { generateViolin } from '../instrument_generator'
import { getDefaultValues } from '../parameter_registry'
import type { Params } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..')
const CLI_PATH = path.resolve(__dirname, '../cli/cli.ts')
const PRESETS_DIR = path.resolve(ROOT, 'presets')

let tmpDir: string
let tmpCounter = 0

function makeTmpDir(): string {
  const dir = path.join(tmpdir(), `cli-test-${Date.now()}-${tmpCounter++}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function defaultViolinParams(): Params {
  const defaults = getDefaultValues()
  return { ...defaults, instrument_family: 'VIOLIN' } as Params
}

function defaultViolParams(): Params {
  const defaults = getDefaultValues()
  return { ...defaults, instrument_family: 'VIOL', no_frets: 7 } as Params
}

function defaultGuitarParams(): Params {
  const defaults = getDefaultValues()
  return {
    ...defaults,
    instrument_family: 'GUITAR_MANDOLIN',
    fret_join: 12,
    no_frets: 19,
    string_height_12th_fret: 2.5,
  } as Params
}

function runCli(args: string[], cwd?: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI_PATH, ...args], {
      cwd: cwd || ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '', status: 0 }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      status: err.status ?? 1,
    }
  }
}

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  test('spaces replaced with underscores', () => {
    expect(sanitizeFilename('My Violin')).toBe('My_Violin')
  })

  test('multiple spaces become single underscore', () => {
    expect(sanitizeFilename('a  b')).toBe('a_b')
  })

  test('special chars replaced', () => {
    expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_name')
  })

  test('leading/trailing underscores stripped', () => {
    expect(sanitizeFilename(' leading')).toBe('leading')
    expect(sanitizeFilename('trailing ')).toBe('trailing')
  })

  test('plain name unchanged', () => {
    expect(sanitizeFilename('BasicViolin')).toBe('BasicViolin')
  })

  test('underscores already present unchanged', () => {
    expect(sanitizeFilename('My_Violin_2024')).toBe('My_Violin_2024')
  })
})

// ---------------------------------------------------------------------------
// getUniqueFilename
// ---------------------------------------------------------------------------

describe('getUniqueFilename', () => {
  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  test('returns same path when no collision', () => {
    const target = path.join(tmpDir, 'output.svg')
    expect(getUniqueFilename(target)).toBe(target)
  })

  test('adds counter when file exists', () => {
    const target = path.join(tmpDir, 'output.svg')
    writeFileSync(target, '')
    const result = getUniqueFilename(target)
    expect(path.basename(result)).toBe('output_1.svg')
  })

  test('increments counter for multiple conflicts', () => {
    const target = path.join(tmpDir, 'output.svg')
    writeFileSync(target, '')
    writeFileSync(path.join(tmpDir, 'output_1.svg'), '')
    writeFileSync(path.join(tmpDir, 'output_2.svg'), '')
    const result = getUniqueFilename(target)
    expect(path.basename(result)).toBe('output_3.svg')
  })

  test('preserves suffix', () => {
    const target = path.join(tmpDir, 'diagram.pdf')
    writeFileSync(target, '')
    const result = getUniqueFilename(target)
    expect(path.extname(result)).toBe('.pdf')
  })
})

// ---------------------------------------------------------------------------
// VALID_VIEWS / VIEW_NAMES
// ---------------------------------------------------------------------------

describe('view constants', () => {
  test('VALID_VIEWS includes expected views', () => {
    expect(VALID_VIEWS).toContain('side')
    expect(VALID_VIEWS).toContain('cross_section')
    expect(VALID_VIEWS).toContain('radius_template')
    expect(VALID_VIEWS).toContain('dimensions')
    expect(VALID_VIEWS).toContain('fret_positions')
  })

  test('VIEW_NAMES maps view keys to filename-friendly names', () => {
    expect(VIEW_NAMES['side']).toBe('side-view')
    expect(VIEW_NAMES['cross_section']).toBe('cross-section')
  })
})

// ---------------------------------------------------------------------------
// loadParameters
// ---------------------------------------------------------------------------

describe('loadParameters', () => {
  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  test('loads valid JSON with simple parameters', () => {
    const file = path.join(tmpDir, 'simple.json')
    writeFileSync(file, JSON.stringify({ instrument_name: 'Simple Test', vsl: 325.0 }))
    const params = loadParameters(file)
    expect(params['instrument_name']).toBe('Simple Test')
    expect(params['vsl']).toBe(325.0)
  })

  test('extracts parameters from metadata wrapper', () => {
    const file = path.join(tmpDir, 'wrapped.json')
    writeFileSync(
      file,
      JSON.stringify({
        metadata: { version: '1.0' },
        parameters: { instrument_name: 'Test Violin', vsl: 325 },
      }),
    )
    const params = loadParameters(file)
    expect(params['instrument_name']).toBe('Test Violin')
    expect(params).not.toHaveProperty('metadata')
  })

  test('exits on missing file', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    expect(() => loadParameters(path.join(tmpDir, 'nonexistent.json'))).toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test('exits on invalid JSON', () => {
    const file = path.join(tmpDir, 'invalid.json')
    writeFileSync(file, '{ this is not valid json }')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    expect(() => loadParameters(file)).toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// View generation (via generateViolin)
// ---------------------------------------------------------------------------

describe('view generation', () => {
  test('side view returns valid SVG', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    expect(result.views?.['side']).toMatch(/^<svg/)
    expect(result.views?.['side']).toContain('</svg>')
    expect(result.views?.['side']).toContain('viewBox')
  })

  test('cross_section view returns valid SVG', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    expect(result.views?.['cross_section']).toMatch(/<svg/)
    expect(result.views?.['cross_section']).toContain('</svg>')
  })

  test('radius_template view returns valid SVG', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    expect(result.views?.['radius_template']).toMatch(/<svg/)
    expect(result.views?.['radius_template']).toContain('</svg>')
  })

  test('side view for viol', () => {
    const params = defaultViolParams()
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    expect(result.views?.['side']).toMatch(/^<svg/)
    expect(result.views?.['side']).toContain('</svg>')
  })

  test('side view for guitar', () => {
    const params = defaultGuitarParams()
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    expect(result.views?.['side']).toMatch(/^<svg/)
    expect(result.views?.['side']).toContain('</svg>')
  })

  test('side view has SVG elements', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    expect(result.views?.['side']).toContain('<path')
    expect(result.views?.['side']).toContain('stroke')
  })
})

// ---------------------------------------------------------------------------
// Dimensions HTML
// ---------------------------------------------------------------------------

describe('dimensions HTML', () => {
  test('dimensions has categories', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    const html = generateStandaloneDimensionsHTML(
      params,
      result.derived_values ?? {},
      result.derived_formatted ?? {},
      result.derived_metadata ?? {},
    )
    expect(html).toContain('General')
    expect(html).toContain('Basic Dimensions')
  })

  test('dimensions has parameter values', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    const html = generateStandaloneDimensionsHTML(
      params,
      result.derived_values ?? {},
      result.derived_formatted ?? {},
      result.derived_metadata ?? {},
    )
    expect(html).toContain('Vibrating String Length')
    expect(html).toContain('325')
  })

  test('dimensions includes instrument name in title', () => {
    const params = { ...defaultViolinParams(), instrument_name: 'My Test Violin' } as Params
    const result = generateViolin(params)
    const html = generateStandaloneDimensionsHTML(
      params,
      result.derived_values ?? {},
      result.derived_formatted ?? {},
      result.derived_metadata ?? {},
    )
    expect(html).toContain('My Test Violin')
  })

  test('dimensions is a full HTML page', () => {
    const params = defaultViolinParams()
    const result = generateViolin(params)
    const html = generateStandaloneDimensionsHTML(
      params,
      result.derived_values ?? {},
      result.derived_formatted ?? {},
      result.derived_metadata ?? {},
    )
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<table>')
    expect(html).toContain('</table>')
  })
})

// ---------------------------------------------------------------------------
// Fret positions HTML
// ---------------------------------------------------------------------------

describe('fret positions HTML', () => {
  test('renders available fret positions', () => {
    const html = generateStandaloneFretPositionsHTML('Test Guitar', {
      available: true,
      html: '<table><tr><td>Fret 1</td></tr></table>',
    })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Test Guitar')
    expect(html).toContain('Fret 1')
  })

  test('shows message when fret positions not available', () => {
    const html = generateStandaloneFretPositionsHTML('My Violin', {
      available: false,
    })
    expect(html).toContain('not available')
  })
})

// ---------------------------------------------------------------------------
// CLI integration tests (subprocess)
// ---------------------------------------------------------------------------

describe('CLI integration', () => {
  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  test('side view to stdout', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile, '--view', 'side'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('<svg')
    expect(result.stdout).toContain('</svg>')
  })

  test('side view to file', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputFile = path.join(tmpDir, 'output.svg')
    const result = runCli([presetFile, '--view', 'side', '-o', outputFile])
    expect(result.status).toBe(0)
    expect(existsSync(outputFile)).toBe(true)
    const content = readFileSync(outputFile, 'utf-8')
    expect(content).toContain('<svg')
  })

  test('dimensions view generates HTML', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputFile = path.join(tmpDir, 'dimensions.html')
    const result = runCli([presetFile, '--view', 'dimensions', '-o', outputFile])
    expect(result.status).toBe(0)
    expect(existsSync(outputFile)).toBe(true)
    const content = readFileSync(outputFile, 'utf-8')
    expect(content).toContain('<!DOCTYPE html>')
  })

  test('cross_section view generates SVG', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile, '--view', 'cross_section'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('<svg')
    expect(result.stdout).toContain('</svg>')
  })

  test('--all creates multiple files', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputDir = path.join(tmpDir, 'output')
    const result = runCli([presetFile, '--all', '--output-dir', outputDir])
    expect(result.status).toBe(0)
    expect(existsSync(path.join(outputDir, 'Default_Violin_side-view.svg'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'Default_Violin_cross-section.svg'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'Default_Violin_dimensions.html'))).toBe(true)
  })

  test('errors when neither --view nor --all specified', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile])
    expect(result.status).not.toBe(0)
    expect(result.stderr.toLowerCase()).toContain('error')
  })

  test('--all requires --output-dir', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile, '--all'])
    expect(result.status).not.toBe(0)
    expect(result.stderr.toLowerCase()).toContain('output-dir')
  })

  test('cannot use both --all and --view', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile, '--all', '--output-dir', tmpDir, '--view', 'side'])
    expect(result.status).not.toBe(0)
  })

  test('handles missing input file', () => {
    const result = runCli([path.join(tmpDir, 'nonexistent.json'), '--view', 'side'])
    expect(result.status).not.toBe(0)
    expect(result.stderr.toLowerCase()).toContain('not found')
  })

  test('invalid view name errors', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const result = runCli([presetFile, '--view', 'unknown_view'])
    expect(result.status).not.toBe(0)
    expect(result.stderr.toLowerCase()).toContain('invalid view')
  })

  test('--pdf generates PDF for side view', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputFile = path.join(tmpDir, 'output.pdf')
    const result = runCli([presetFile, '--view', 'side', '--pdf', '-o', outputFile])
    expect(result.status).toBe(0)
    expect(existsSync(outputFile)).toBe(true)
    const content = readFileSync(outputFile)
    expect(content.slice(0, 5).toString()).toBe('%PDF-')
  })

  test('--pdf generates PDF for dimensions', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputFile = path.join(tmpDir, 'dims.pdf')
    const result = runCli([presetFile, '--view', 'dimensions', '--pdf', '-o', outputFile])
    expect(result.status).toBe(0)
    expect(existsSync(outputFile)).toBe(true)
    const content = readFileSync(outputFile)
    expect(content.slice(0, 5).toString()).toBe('%PDF-')
  })

  test('--pdf generates PDF for fret_positions', () => {
    const presetFile = path.join(PRESETS_DIR, 'bass_viol.json')
    const outputFile = path.join(tmpDir, 'frets.pdf')
    const result = runCli([presetFile, '--view', 'fret_positions', '--pdf', '-o', outputFile])
    expect(result.status).toBe(0)
    expect(existsSync(outputFile)).toBe(true)
    const content = readFileSync(outputFile)
    expect(content.slice(0, 5).toString()).toBe('%PDF-')
  })

  test('--all --pdf creates PDF files with paper size in SVG names', () => {
    const presetFile = path.join(PRESETS_DIR, 'violin.json')
    const outputDir = path.join(tmpDir, 'pdf-output')
    const result = runCli([presetFile, '--all', '--pdf', '--output-dir', outputDir])
    expect(result.status).toBe(0)
    const files = readdirSync(outputDir)
    // SVG views get paper size suffix
    const sideView = files.find((f) => f.includes('side-view') && f.endsWith('.pdf'))
    expect(sideView).toBeDefined()
    expect(sideView).toMatch(/_a\d\.pdf$/)
    // Table views have no paper size suffix
    expect(files.find((f) => f.includes('dimensions') && f.endsWith('.pdf'))).toBeDefined()
  })

  test('--help shows usage', () => {
    const result = runCli(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('--view')
    expect(result.stdout).toContain('--all')
  })
})

// ---------------------------------------------------------------------------
// Multi-preset integration
// ---------------------------------------------------------------------------

describe('preset integration', () => {
  test('violin preset generates all SVG views', () => {
    const params = loadParameters(path.join(PRESETS_DIR, 'violin.json'))
    const merged = { ...getDefaultValues(), ...params } as Params
    const result = generateViolin(merged)
    expect(result.success).toBe(true)
    expect(result.views?.['side']).toContain('<svg')
    expect(result.views?.['cross_section']).toContain('<svg')
    expect(result.views?.['radius_template']).toContain('<svg')
  })

  test('cello preset generates successfully', () => {
    const params = loadParameters(path.join(PRESETS_DIR, 'cello.json'))
    const merged = { ...getDefaultValues(), ...params } as Params
    const result = generateViolin(merged)
    expect(result.success).toBe(true)
    expect(result.views?.['side']).toContain('<svg')
  })

  test('bass_viol preset generates with fret positions', () => {
    const params = loadParameters(path.join(PRESETS_DIR, 'bass_viol.json'))
    const merged = { ...getDefaultValues(), ...params } as Params
    const result = generateViolin(merged)
    expect(result.success).toBe(true)
    expect(result.fret_positions?.available).toBe(true)
  })

  test('mandolin preset generates with fret positions', () => {
    const params = loadParameters(path.join(PRESETS_DIR, 'mandolin.json'))
    const merged = { ...getDefaultValues(), ...params } as Params
    const result = generateViolin(merged)
    expect(result.success).toBe(true)
    expect(result.fret_positions?.available).toBe(true)
  })
})
