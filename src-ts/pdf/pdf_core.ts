/**
 * Shared PDF generation core — used by both CLI and web.
 *
 * Uses PDFKit + svg-to-pdfkit for DOM-free SVG → PDF conversion.
 * All functions return PDFKit documents; callers collect output
 * via collectPdfBytes() (Uint8Array, works in Node and browser).
 */

import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'

// Shared constants (single source of truth for web + CLI)
// @ts-expect-error — plain JS module, no type declarations
import { ISO_SIZES, PDF_MARGIN_MM, BRAND_COLOR_HEX } from '../../web/pdf_constants.js'

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
  const fallback = ISO_SIZES[ISO_SIZES.length - 1]
  return { ...fallback, orientation: 'landscape' }
}

// ---------------------------------------------------------------------------
// Output collection — works in both Node (Buffer) and browser (Uint8Array)
// ---------------------------------------------------------------------------

export function collectPdfBytes(doc: PDFKit.PDFDocument): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk)))
    doc.on('end', () => {
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      resolve(result)
    })
    doc.on('error', reject)
    doc.end()
  })
}

// ---------------------------------------------------------------------------
// SVG → PDF
// ---------------------------------------------------------------------------

export interface SvgPdfResult {
  bytes: Uint8Array
  paperSize: string // e.g. 'A4', 'A3'
}

/**
 * Convert an SVG string to PDF bytes.
 * Auto-selects paper size and centers the SVG on the page.
 */
export async function svgToPdf(svg: string): Promise<SvgPdfResult> {
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
    fontCallback: (_family: string, bold: boolean, italic: boolean) => {
      if (bold && italic) return 'Helvetica-BoldOblique'
      if (bold) return 'Helvetica-Bold'
      if (italic) return 'Helvetica-Oblique'
      return 'Helvetica'
    },
  })

  return { bytes: await collectPdfBytes(doc), paperSize: paper.name }
}

// ---------------------------------------------------------------------------
// Table data types — callers build these from their own data sources
// ---------------------------------------------------------------------------

export interface TableSection {
  category: string
  rows: Array<{ label: string; value: string }>
}

export interface FretRow {
  fret: string
  distFromNut: string
  distFromPrev: string
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
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const pageWidth = doc.page.width
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
    if (y + rowHeight > doc.page.height - 40) {
      doc.addPage()
      y = 40
    }

    if (row.isCategoryHeader) {
      doc.save()
      doc.rect(tableX, y, tableWidth, rowHeight).fill('#f3f4f6')
      doc.fillColor('#374151').fontSize(fontSize).font('Helvetica-Bold')
      doc.text(row.cells[0], tableX + cellPadding, y + 6, {
        width: tableWidth - cellPadding * 2,
      })
      doc.restore()
    } else {
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
// Dimensions table → PDF
// ---------------------------------------------------------------------------

/**
 * Generate a PDF with the dimensions table.
 * Takes pre-built sections so it works in both CLI and browser.
 */
export async function dimensionsTableToPdf(
  instrumentName: string,
  sections: TableSection[],
): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })

  // Title
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_COLOR)
  doc.text(`${instrumentName} - Dimensions`, 40, 40)
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 62)

  // Build table rows from sections
  const rows: TableRow[] = []
  for (const section of sections) {
    if (section.rows.length === 0) continue
    rows.push({ cells: [section.category], isCategoryHeader: true })
    for (const row of section.rows) {
      rows.push({ cells: [row.label, row.value] })
    }
  }

  const columns: TableColumn[] = [
    { header: 'Parameter', width: 280 },
    { header: 'Value', width: 235 },
  ]

  renderTable(doc, columns, rows, 85)

  return collectPdfBytes(doc)
}

// ---------------------------------------------------------------------------
// Fret positions → PDF
// ---------------------------------------------------------------------------

/**
 * Generate a PDF with the fret positions table.
 * Takes pre-parsed fret rows so it works in both CLI and browser.
 */
export async function fretPositionsToPdf(
  instrumentName: string,
  vsl: number | null,
  noFrets: number | null,
  fretRows: FretRow[] | null,
): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })

  // Title
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_COLOR)
  doc.text(`${instrumentName} - Fret Positions`, 40, 40)
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 62)

  if (vsl) {
    doc.text(`Vibrating String Length: ${vsl} mm`, 40, 74)
  }
  if (noFrets) {
    doc.text(`Number of Frets: ${noFrets}`, 40, 86)
  }

  if (!fretRows || fretRows.length === 0) {
    doc.fontSize(12).font('Helvetica').fillColor('#111827')
    doc.text('Fret positions not available for this instrument.', 40, 110)
    return collectPdfBytes(doc)
  }

  const startY = vsl && noFrets ? 105 : 85
  const columns: TableColumn[] = [
    { header: 'Fret', width: 80, align: 'center' },
    { header: 'Distance from Nut (mm)', width: 200, align: 'right' },
    { header: 'Distance from Previous (mm)', width: 235, align: 'right' },
  ]

  const rows: TableRow[] = fretRows.map((f) => ({
    cells: [f.fret, f.distFromNut, f.distFromPrev],
  }))

  renderTable(doc, columns, rows, startY)

  return collectPdfBytes(doc)
}

// ---------------------------------------------------------------------------
// Helper: parse fret rows from HTML string
// ---------------------------------------------------------------------------

/**
 * Parse fret data from the HTML table generated by the geometry engine.
 * Returns structured rows, or null if parsing fails.
 */
export function parseFretRowsFromHtml(html: string): FretRow[] | null {
  const rows: FretRow[] = []
  const rowRegex = /<tr><td>(\d+)<\/td><td>([\d.]+)<\/td><td>([\d.]+)<\/td><\/tr>/g
  let match
  while ((match = rowRegex.exec(html)) !== null) {
    rows.push({ fret: match[1], distFromNut: match[2], distFromPrev: match[3] })
  }
  return rows.length > 0 ? rows : null
}
