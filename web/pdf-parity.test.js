/**
 * PDF parity tests — verify that web and CLI PDF generation use the same
 * shared constants from web/pdf_constants.js.
 *
 * These tests scan the source files to catch drift between the two
 * implementations. If a constant is hardcoded instead of imported,
 * or if the shared file is modified without updating consumers, these
 * tests will fail.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function readSource(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

// Load the shared constants for value verification
const pdfConstants = readSource('web/pdf_constants.js');
const webPdfExport = readSource('web/pdf_export.js');
const cliPdf = readSource('src-ts/cli/pdf.ts');

// ---------------------------------------------------------------------------
// Shared constants file is well-formed
// ---------------------------------------------------------------------------

describe('pdf_constants.js', () => {
  test('exports ISO_SIZES with 5 paper sizes', () => {
    expect(pdfConstants).toContain('ISO_SIZES');
    expect(pdfConstants).toContain("'A4'");
    expect(pdfConstants).toContain("'A3'");
    expect(pdfConstants).toContain("'A2'");
    expect(pdfConstants).toContain("'A1'");
    expect(pdfConstants).toContain("'A0'");
  });

  test('exports PDF_MARGIN_MM', () => {
    expect(pdfConstants).toContain('PDF_MARGIN_MM');
    expect(pdfConstants).toMatch(/PDF_MARGIN_MM\s*=\s*20/);
  });

  test('exports BRAND_COLOR_HEX', () => {
    expect(pdfConstants).toContain('BRAND_COLOR_HEX');
    expect(pdfConstants).toContain('#4F46E5');
  });

  test('exports BRAND_COLOR_RGB', () => {
    expect(pdfConstants).toContain('BRAND_COLOR_RGB');
    expect(pdfConstants).toContain('79, 70, 229');
  });
});

// ---------------------------------------------------------------------------
// Web pdf_export.js uses shared constants (no hardcoded values)
// ---------------------------------------------------------------------------

describe('web/pdf_export.js uses shared constants', () => {
  test('imports from pdf_constants.js', () => {
    expect(webPdfExport).toContain("from './pdf_constants.js'");
  });

  test('uses ISO_SIZES (not hardcoded isoSizes)', () => {
    expect(webPdfExport).toContain('ISO_SIZES');
    expect(webPdfExport).not.toMatch(/\bisoSizes\b/);
    // Should not contain inline paper size definitions
    expect(webPdfExport).not.toMatch(/name:\s*'a4'/i);
  });

  test('uses PDF_MARGIN_MM (not hardcoded margin)', () => {
    expect(webPdfExport).toContain('PDF_MARGIN_MM');
    // Allow "margin = PDF_MARGIN_MM" but not "margin = 20"
    expect(webPdfExport).not.toMatch(/margin\s*=\s*20\s*;/);
  });

  test('uses BRAND_COLOR_RGB (not hardcoded fillColor)', () => {
    expect(webPdfExport).toContain('BRAND_COLOR_RGB');
    expect(webPdfExport).not.toMatch(/fillColor:\s*\[79,\s*70,\s*229\]/);
  });
});

// ---------------------------------------------------------------------------
// CLI pdf.ts uses shared constants (no hardcoded values)
// ---------------------------------------------------------------------------

describe('src-ts/cli/pdf.ts uses shared constants', () => {
  test('imports from pdf_constants.js', () => {
    expect(cliPdf).toContain('pdf_constants.js');
  });

  test('uses ISO_SIZES (not hardcoded)', () => {
    expect(cliPdf).toContain('ISO_SIZES');
    // Should not contain inline paper size array
    expect(cliPdf).not.toMatch(/name:\s*'A4',\s*width:\s*210/);
  });

  test('uses PDF_MARGIN_MM (not hardcoded)', () => {
    expect(cliPdf).toContain('PDF_MARGIN_MM');
    expect(cliPdf).not.toMatch(/MARGIN_MM\s*=\s*20/);
  });

  test('uses shared brand color (not hardcoded)', () => {
    expect(cliPdf).toContain('BRAND_COLOR_HEX');
    // Should not define its own BRAND_COLOR constant with a hex value
    expect(cliPdf).not.toMatch(/BRAND_COLOR\s*=\s*'#4F46E5'/);
  });
});
