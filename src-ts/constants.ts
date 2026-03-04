/**
 * Constants used across the instrument generator.
 *
 * Ported from src/constants.py - centralizes all magic numbers and
 * configuration values to provide a single source of truth.
 */

// Template dimensions (mm)
export const TEMPLATE_WIDTH_MARGIN = 10.0  // Extra width beyond fingerboard
export const MIN_FLAT_AREA_HEIGHT = 20.0   // Minimum flat area for text on radius template
export const ARC_POINT_RESOLUTION = 50     // Number of points to use when rendering arcs

// Text sizing for radius template
export const TEXT_HEIGHT_FRACTION = 1.0 / 3.0  // Text height as fraction of flat area
export const TEXT_WIDTH_FACTOR = 0.6            // Approximation factor for text width estimation
export const TEXT_MARGIN_FRACTION = 0.3         // Margin as fraction of text height

// SVG rendering
export const SVG_MARGIN = 2.0  // Margin around SVG viewBox (mm)

// Default instrument parameters
export const DEFAULT_FINGERBOARD_RADIUS = 41.0         // mm, typical for violin
export const DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT = 3.2    // mm
export const DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN = 1.2   // mm
export const DEFAULT_FB_WIDTH_AT_NUT = 24.0            // mm, typical violin nut width
export const DEFAULT_FB_WIDTH_AT_END = 42.0            // mm, typical violin end width

// Fret calculation
export const DEFAULT_FRETS_VIOL = 7
export const DEFAULT_FRETS_GUITAR = 20
export const DEFAULT_FRETS_VIOLIN = 0  // No frets

// Numerical precision
export const EPSILON = 1e-10  // Threshold for detecting parallel lines
