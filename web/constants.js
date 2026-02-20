/**
 * Constants used across the web application.
 *
 * Centralizes magic numbers and configuration values for easier maintenance
 * and consistent behavior across the application.
 */

// Debounce timing (milliseconds)
export const DEBOUNCE_GENERATE = 500;  // Delay before auto-generating on input change

// Responsive breakpoints (pixels)
export const MOBILE_BREAKPOINT = 1024;  // Width below which mobile layout applies

// Zoom configuration
export const ZOOM_CONFIG = {
    min: 0.1,      // Minimum zoom level
    max: 20,       // Maximum zoom level
    factor: 1.3    // Multiplier for zoom in/out operations
};

// Platform detection
export const IS_MAC = /mac/i.test(navigator?.userAgentData?.platform || navigator?.platform || '');

// View key to filename-safe name mapping (used by SVG and PDF downloads)
export const VIEW_FILENAME_PARTS = {
    side: 'side-view',
    top: 'top-view',
    cross_section: 'cross-section',
    dimensions: 'dimensions',
    fret_positions: 'fret-positions',
    radius_template: 'radius-template'
};
