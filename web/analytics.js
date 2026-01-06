/**
 * Analytics module for Overstand
 * Uses Plausible Analytics (privacy-friendly, no cookies)
 *
 * Events tracked:
 * - Preset Selected: When user selects an instrument preset
 * - Template Generated: When a template is successfully generated
 * - View Changed: When user switches between views (side, dimensions, etc.)
 * - PDF Exported: When user downloads a PDF
 * - SVG Downloaded: When user downloads an SVG
 * - Parameters Saved: When user saves their parameters
 * - Parameters Loaded: When user loads a parameters file
 * - Instrument Family Changed: When user switches instrument type
 * - About Viewed: When user opens the About dialog
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

export function trackViewChanged(viewName) {
    trackEvent('View Changed', {
        view: viewName
    });
}

export function trackPDFExported(instrumentFamily) {
    trackEvent('PDF Exported', {
        family: instrumentFamily
    });
}

export function trackSVGDownloaded(viewName) {
    trackEvent('SVG Downloaded', {
        view: viewName
    });
}

export function trackParametersSaved() {
    trackEvent('Parameters Saved');
}

export function trackParametersLoaded() {
    trackEvent('Parameters Loaded');
}

export function trackInstrumentFamilyChanged(family) {
    trackEvent('Instrument Family Changed', {
        family: family
    });
}

export function trackAboutViewed() {
    trackEvent('About Viewed');
}

export function trackError(errorType, errorMessage) {
    trackEvent('Error', {
        type: errorType,
        message: errorMessage?.substring(0, 100) // Truncate long messages
    });
}
