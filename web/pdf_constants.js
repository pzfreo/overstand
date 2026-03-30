/**
 * Shared PDF constants used by both web and CLI PDF generation.
 *
 * IMPORTANT: Keep web/pdf_export.js and src-ts/cli/pdf.ts in sync.
 * Changes here are enforced by web/pdf-parity.test.js.
 */

/** ISO paper sizes in mm (smallest to largest). */
export const ISO_SIZES = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A3', width: 297, height: 420 },
  { name: 'A2', width: 420, height: 594 },
  { name: 'A1', width: 594, height: 841 },
  { name: 'A0', width: 841, height: 1189 },
];

/** Margin in mm added to each side when selecting paper size. */
export const PDF_MARGIN_MM = 20;

/** Overstand brand color (hex). */
export const BRAND_COLOR_HEX = '#0f766e';

/** Overstand brand color (RGB array for jsPDF). */
export const BRAND_COLOR_RGB = [15, 118, 110];
