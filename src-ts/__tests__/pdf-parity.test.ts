/**
 * PDF parity tests — verify that web and CLI PDF generation both use the
 * shared pdf_core module, and that shared constants are properly defined.
 *
 * Scans source files to catch drift between implementations.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

const pdfConstants = readSource('web/pdf_constants.js')
const pdfCore = readSource('src-ts/pdf/pdf_core.ts')
const cliPdf = readSource('src-ts/cli/pdf.ts')
const webPdfExport = readSource('web/pdf_export.js')

// ---------------------------------------------------------------------------
// Shared constants file is well-formed
// ---------------------------------------------------------------------------

describe('pdf_constants.js', () => {
  test('exports ISO_SIZES with 5 paper sizes', () => {
    expect(pdfConstants).toContain('ISO_SIZES')
    expect(pdfConstants).toContain("'A4'")
    expect(pdfConstants).toContain("'A3'")
    expect(pdfConstants).toContain("'A2'")
    expect(pdfConstants).toContain("'A1'")
    expect(pdfConstants).toContain("'A0'")
  })

  test('exports PDF_MARGIN_MM', () => {
    expect(pdfConstants).toMatch(/PDF_MARGIN_MM\s*=\s*20/)
  })

  test('exports BRAND_COLOR_HEX', () => {
    expect(pdfConstants).toContain('#0f766e')
  })

  test('exports BRAND_COLOR_RGB', () => {
    expect(pdfConstants).toContain('15, 118, 110')
  })
})

// ---------------------------------------------------------------------------
// Shared pdf_core.ts imports shared constants
// ---------------------------------------------------------------------------

describe('pdf_core.ts uses shared constants', () => {
  test('imports from pdf_constants.js', () => {
    expect(pdfCore).toContain('pdf_constants.js')
  })

  test('imports ISO_SIZES', () => {
    expect(pdfCore).toContain('ISO_SIZES')
  })

  test('imports PDF_MARGIN_MM', () => {
    expect(pdfCore).toContain('PDF_MARGIN_MM')
  })

  test('imports BRAND_COLOR_HEX', () => {
    expect(pdfCore).toContain('BRAND_COLOR_HEX')
  })

  test('does not hardcode paper sizes', () => {
    expect(pdfCore).not.toMatch(/name:\s*'A4',\s*width:\s*210/)
  })

  test('does not hardcode margin', () => {
    expect(pdfCore).not.toMatch(/MARGIN_MM\s*=\s*20/)
  })

  test('does not hardcode brand color', () => {
    expect(pdfCore).not.toMatch(/BRAND_COLOR\s*=\s*'#0f766e'/)
  })
})

// ---------------------------------------------------------------------------
// CLI pdf.ts delegates to shared core
// ---------------------------------------------------------------------------

describe('CLI pdf.ts uses shared core', () => {
  test('imports from pdf_core', () => {
    expect(cliPdf).toContain("from '../pdf/pdf_core'")
  })

  test('imports svgToPdf from core', () => {
    expect(cliPdf).toContain('svgToPdf')
  })

  test('imports dimensionsTableToPdf from core', () => {
    expect(cliPdf).toContain('dimensionsTableToPdf')
  })

  test('imports fretPositionsToPdf from core', () => {
    expect(cliPdf).toContain('fretPositionsToPdf')
  })

  test('does not import PDFDocument directly', () => {
    // CLI should not use PDFKit directly — shared core handles it
    expect(cliPdf).not.toContain("from 'pdfkit'")
  })

  test('does not import SVGtoPDF directly', () => {
    expect(cliPdf).not.toContain("from 'svg-to-pdfkit'")
  })
})

// ---------------------------------------------------------------------------
// Web pdf_export.js uses shared core (via bundled dist)
// ---------------------------------------------------------------------------

describe('web pdf_export.js uses shared core', () => {
  test('imports from dist/pdf_generator.js', () => {
    expect(webPdfExport).toContain('/dist/pdf_generator.js')
  })

  test('imports svgToPdf from shared module', () => {
    expect(webPdfExport).toContain('svgToPdf')
  })

  test('imports dimensionsTableToPdf from shared module', () => {
    expect(webPdfExport).toContain('dimensionsTableToPdf')
  })

  test('imports fretPositionsToPdf from shared module', () => {
    expect(webPdfExport).toContain('fretPositionsToPdf')
  })

  test('does not use jsPDF', () => {
    expect(webPdfExport).not.toContain('jsPDF')
    expect(webPdfExport).not.toContain('jspdf')
  })

  test('does not use svg2pdf', () => {
    expect(webPdfExport).not.toContain('svg2pdf')
  })

  test('does not use DOMParser', () => {
    expect(webPdfExport).not.toContain('DOMParser')
  })

  test('does not use autoTable', () => {
    expect(webPdfExport).not.toContain('autoTable')
  })

  test('does not read from DOM tables', () => {
    expect(webPdfExport).not.toContain('.dimensions-table')
    expect(webPdfExport).not.toContain('.fret-table')
  })
})
