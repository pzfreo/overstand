/**
 * Analytics module for Overstand
 * Uses Plausible Analytics (privacy-friendly, no cookies)
 *
 * Events tracked:
 * - Preset Selected: When user selects an instrument preset
 * - Template Generated: When a template is successfully generated
 * - PDF Exported: When user downloads a PDF
 * - Parameters Saved: When user saves their parameters
 * - Parameters Loaded: When user loads a parameters file
 * - Error: When an error occurs
 */

/**
 * Track an analytics event safely (no-op if Plausible not loaded)
 * @param {string} eventName - The event name
 * @param {Object} [props] - Optional properties to include
 */
export function trackEvent(eventName, props = {}) {
    // Plausible exposes window.plausible when loaded
    if (typeof window.plausible === 'function') {
        window.plausible(eventName, { props });
    }
}

// Convenience functions for specific events

export function trackPresetSelected(presetId, instrumentFamily) {
    trackEvent('Preset Selected', {
        preset: presetId,
        family: instrumentFamily
    });
}

export function trackTemplateGenerated(instrumentFamily) {
    trackEvent('Template Generated', {
        family: instrumentFamily
    });
}

export function trackPDFExported(instrumentFamily) {
    trackEvent('PDF Exported', {
        family: instrumentFamily
    });
}

export function trackParametersSaved() {
    trackEvent('Parameters Saved');
}

export function trackParametersLoaded() {
    trackEvent('Parameters Loaded');
}

export function trackError(errorType, errorMessage) {
    trackEvent('Error', {
        type: errorType,
        message: errorMessage?.substring(0, 100) // Truncate long messages
    });
}
