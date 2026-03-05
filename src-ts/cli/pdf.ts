/**
 * PDF generation for CLI output.
 *
 * Uses PDFKit + svg-to-pdfkit to convert SVG views and generate
 * table-based PDFs for dimensions/fret positions. No DOM required.
 */

import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'

import {
  getParameterCategories,
  getAllInputParameters,
} from '../parameter_registry'
import { ParameterType } from '../types'
import type { Params } from '../types'
import type { FretPositionsResult } from '../instrument_generator'

// Shared constants (single source of truth for web + CLI)
// @ts-expect-error — plain JS module, no type declarations
import { ISO_SIZES, PDF_MARGIN_MM, BRAND_COLOR_HEX, BRAND_COLOR_RGB } from '../../web/pdf_constants.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Points per millimeter (1 inch = 72 points, 1 inch = 25.4 mm). */
const PT_PER_MM = 72 / 25.4

const BRAND_COLOR: string = BRAND_COLOR_HEX

// ---------------------------------------------------------------------------
// SVG dimension parsing
// ---------------------------------------------------------------------------

export interface SvgDimensions {
  width: number
  height: number
}

/**
 * Parse width and height (in mm) from an SVG string.
 * Looks for width="Xmm" height="Ymm" attributes, falling back to viewBox.
 */
export function parseSvgDimensions(svg: string): SvgDimensions {
  // Try width="123.4mm" height="567.8mm"
  const wMatch = svg.match(/width="([\d.]+)mm"/)
  const hMatch = svg.match(/height="([\d.]+)mm"/)
  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) }
  }

  // Fallback: viewBox="minX minY width height"
  const vbMatch = svg.match(/viewBox="([^"]+)"/)
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/)
    if (parts.length === 4) {
      return { width: parseFloat(parts[2]), height: parseFloat(parts[3]) }
    }
  }

  // Default to A4
  return { width: 210, height: 297 }
}

// ---------------------------------------------------------------------------
// Paper size selection
// ---------------------------------------------------------------------------

export interface PaperSize {
  name: string
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
}

/**
 * Select the smallest ISO paper size that fits the given dimensions + margins.
 * Matches the web app logic in web/pdf_export.js.
 */
export function selectPaperSize(widthMm: number, heightMm: number): PaperSize {
  const requiredW = widthMm + PDF_MARGIN_MM * 2
  const requiredH = heightMm + PDF_MARGIN_MM * 2

  for (const size of ISO_SIZES) {
    if (size.width >= requiredW && size.height >= requiredH) {
      return { ...size, orientation: 'portrait' }
    }
    if (size.height >= requiredW && size.width >= requiredH) {
      return { ...size, orientation: 'landscape' }
    }
  }

  // Fallback: A0 landscape
  return { ...ISO_SIZES[4], orientation: 'landscape' }
}

// ---------------------------------------------------------------------------
// PDF buffer collection
// ---------------------------------------------------------------------------

function pdfDocToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

// ---------------------------------------------------------------------------
// SVG → PDF
// ---------------------------------------------------------------------------

export interface SvgPdfResult {
  buffer: Buffer
  paperSize: string // e.g. 'A4', 'A3'
}

/**
 * Convert an SVG string to a PDF buffer.
 * Auto-selects paper size and centers the SVG on the page.
 */
export async function svgToPdfBuffer(svg: string): Promise<SvgPdfResult> {
  const dims = parseSvgDimensions(svg)
  const paper = selectPaperSize(dims.width, dims.height)

  const pageWidthPt =
    paper.orientation === 'portrait' ? paper.width * PT_PER_MM : paper.height * PT_PER_MM
  const pageHeightPt =
    paper.orientation === 'portrait' ? paper.height * PT_PER_MM : paper.width * PT_PER_MM

  const doc = new PDFDocument({
    size: [pageWidthPt, pageHeightPt],
    margin: 0,
  })

  // Center the SVG on the page
  const svgWidthPt = dims.width * PT_PER_MM
  const svgHeightPt = dims.height * PT_PER_MM
  const x = (pageWidthPt - svgWidthPt) / 2
  const y = (pageHeightPt - svgHeightPt) / 2

  SVGtoPDF(doc, svg, x, y, {
    width: svgWidthPt,
    height: svgHeightPt,
    fontCallback: (family: string, bold: boolean, italic: boolean) => {
      if (bold && italic) return 'Helvetica-BoldOblique'
      if (bold) return 'Helvetica-Bold'
      if (italic) return 'Helvetica-Oblique'
      return 'Helvetica'
    },
  })

  return { buffer: await pdfDocToBuffer(doc), paperSize: paper.name }
}

// ---------------------------------------------------------------------------
// Table rendering helper
// ---------------------------------------------------------------------------

interface TableColumn {
  header: string
  width: number
  align?: 'left' | 'right' | 'center'
}

interface TableRow {
  cells: string[]
  isCategoryHeader?: boolean
}

function renderTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: TableRow[],
  startY: number,
): number {
  const pageWidth = doc.page.width
  const marginX = 40
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const tableX = (pageWidth - tableWidth) / 2
  const rowHeight = 22
  const headerHeight = 26
  const fontSize = 9
  const headerFontSize = 10
  const cellPadding = 8

  let y = startY

  // Header row
  doc.save()
  doc.rect(tableX, y, tableWidth, headerHeight).fill(BRAND_COLOR)
  doc.fillColor('white').fontSize(headerFontSize).font('Helvetica-Bold')
  let colX = tableX
  for (const col of columns) {
    doc.text(col.header, colX + cellPadding, y + 7, {
      width: col.width - cellPadding * 2,
      align: col.align || 'left',
    })
    colX += col.width
  }
  doc.restore()
  y += headerHeight

  // Data rows
  for (const row of rows) {
    // Page break check
    if (y + rowHeight > doc.page.height - 40) {
      doc.addPage()
      y = 40
    }

    if (row.isCategoryHeader) {
      // Category header row
      doc.save()
      doc.rect(tableX, y, tableWidth, rowHeight).fill('#f3f4f6')
      doc.fillColor('#374151').fontSize(fontSize).font('Helvetica-Bold')
      doc.text(row.cells[0], tableX + cellPadding, y + 6, {
        width: tableWidth - cellPadding * 2,
      })
      doc.restore()
    } else {
      // Normal data row
      doc.save()
      doc.fillColor('#111827').fontSize(fontSize).font('Helvetica')
      colX = tableX
      for (let i = 0; i < columns.length; i++) {
        const text = row.cells[i] || ''
        doc.text(text, colX + cellPadding, y + 6, {
          width: columns[i].width - cellPadding * 2,
          align: columns[i].align || 'left',
        })
        colX += columns[i].width
      }
      // Bottom border
      doc
        .moveTo(tableX, y + rowHeight)
        .lineTo(tableX + tableWidth, y + rowHeight)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke()
      doc.restore()
    }

    y += rowHeight
  }

  return y
}

// ---------------------------------------------------------------------------
// Dimensions → PDF
// ---------------------------------------------------------------------------

/**
 * Generate a PDF buffer with the dimensions table.
 * Uses the same data-walking logic as generateStandaloneDimensionsHTML.
 */
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

  const doc = new PDFDocument({ size: 'A4', margin: 40 })

  // Title
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_COLOR)
  doc.text(`${instrumentName} - Dimensions`, 40, 40)
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 62)

  // Build table rows
  const rows: TableRow[] = []

  for (const category of categories) {
    if (category === 'Display Options') continue

    const visibleInCategory: Array<[string, (typeof inputParams)[string]]> = []
    for (const [key, param] of Object.entries(inputParams)) {
      if (param.input_config?.category !== category) continue
      if (!param.isVisibleInContext(params as Record<string, unknown>)) continue
      if (param.is_output_for?.[instrumentFamily]) continue
      visibleInCategory.push([key, param])
    }

    if (visibleInCategory.length === 0) continue

    rows.push({ cells: [category], isCategoryHeader: true })

    for (const [key, param] of visibleInCategory) {
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

      rows.push({ cells: [param.display_name, displayValue] })
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
      rows.push({ cells: [cat], isCategoryHeader: true })

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
        rows.push({ cells: [displayName, formattedValue] })
      }
    }
  }

  const columns: TableColumn[] = [
    { header: 'Parameter', width: 280 },
    { header: 'Value', width: 235 },
  ]

  renderTable(doc, columns, rows, 85)

  return pdfDocToBuffer(doc)
}

// ---------------------------------------------------------------------------
// Fret positions → PDF
// ---------------------------------------------------------------------------

/**
 * Generate a PDF buffer with the fret positions table.
 */
export async function fretPositionsToPdfBuffer(
  instrumentName: string,
  fretPositions: FretPositionsResult,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })

  // Title
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_COLOR)
  doc.text(`${instrumentName} - Fret Positions`, 40, 40)
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 62)

  if (fretPositions.vsl) {
    doc.text(`Vibrating String Length: ${fretPositions.vsl} mm`, 40, 74)
  }
  if (fretPositions.no_frets) {
    doc.text(`Number of Frets: ${fretPositions.no_frets}`, 40, 86)
  }

  if (!fretPositions.available || !fretPositions.html) {
    doc.fontSize(12).font('Helvetica').fillColor('#111827')
    doc.text('Fret positions not available for this instrument.', 40, 110)
    return pdfDocToBuffer(doc)
  }

  // Parse fret data from the HTML table
  const rows: TableRow[] = []
  const rowRegex = /<tr><td>(\d+)<\/td><td>([\d.]+)<\/td><td>([\d.]+)<\/td><\/tr>/g
  let match
  while ((match = rowRegex.exec(fretPositions.html)) !== null) {
    rows.push({ cells: [match[1], match[2], match[3]] })
  }

  const startY = fretPositions.vsl && fretPositions.no_frets ? 105 : 85
  const columns: TableColumn[] = [
    { header: 'Fret', width: 80, align: 'center' },
    { header: 'Distance from Nut (mm)', width: 200, align: 'right' },
    { header: 'Distance from Previous (mm)', width: 235, align: 'right' },
  ]

  renderTable(doc, columns, rows, startY)

  return pdfDocToBuffer(doc)
}
