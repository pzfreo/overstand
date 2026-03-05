/**
 * PDF generator entry point — bundled by Vite for browser use.
 *
 * Re-exports shared PDF functions from pdf_core and adds a browser
 * download helper. The CLI imports pdf_core directly.
 */

export {
  svgToPdf,
  dimensionsTableToPdf,
  fretPositionsToPdf,
  parseFretRowsFromHtml,
  parseSvgDimensions,
  selectPaperSize,
} from './pdf_core'

export type { SvgPdfResult, TableSection, FretRow, SvgDimensions, PaperSize } from './pdf_core'

/**
 * Trigger a browser download from PDF bytes.
 */
export function downloadPdfBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
