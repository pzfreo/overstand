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
 * - Parameters Edited: When user edits parameters (debounced)
 * - Instrument Family Changed: When user switches instrument type
 * - About Viewed: When user opens the About dialog
 * - Engagement Milestone: When user reaches time milestones (5min, 15min, 30min)
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

// ============================================
// Parameter Edit Tracking (debounced)
// ============================================

let editedParams = new Set();
let editDebounceTimer = null;
const EDIT_DEBOUNCE_MS = 3000; // Wait 3s after last edit before sending

/**
 * Track that a parameter was edited. Events are debounced and batched.
 * @param {string} paramName - The parameter that was edited
 */
export function trackParameterEdit(paramName) {
    editedParams.add(paramName);

    // Clear existing timer
    if (editDebounceTimer) {
        clearTimeout(editDebounceTimer);
    }

    // Set new timer - fire event after user stops editing
    editDebounceTimer = setTimeout(() => {
        if (editedParams.size > 0) {
            trackEvent('Parameters Edited', {
                count: editedParams.size,
                params: Array.from(editedParams).slice(0, 10).join(',') // First 10 params
            });
            editedParams.clear();
        }
    }, EDIT_DEBOUNCE_MS);
}

// ============================================
// Engagement Time Tracking
// ============================================

const ENGAGEMENT_MILESTONES = [5, 15, 30, 60]; // minutes
let sessionStartTime = Date.now();
let milestonesReached = new Set();
let engagementCheckInterval = null;

/**
 * Start tracking engagement time. Call once on page load.
 */
export function startEngagementTracking() {
    sessionStartTime = Date.now();
    milestonesReached.clear();

    // Check every minute
    engagementCheckInterval = setInterval(() => {
        const minutesActive = Math.floor((Date.now() - sessionStartTime) / 60000);

        for (const milestone of ENGAGEMENT_MILESTONES) {
            if (minutesActive >= milestone && !milestonesReached.has(milestone)) {
                milestonesReached.add(milestone);
                trackEvent('Engagement Milestone', {
                    minutes: milestone
                });
            }
        }

        // Stop checking after last milestone
        if (minutesActive > ENGAGEMENT_MILESTONES[ENGAGEMENT_MILESTONES.length - 1]) {
            clearInterval(engagementCheckInterval);
        }
    }, 60000); // Check every minute
}

/**
 * Reset engagement tracking (e.g., if user was idle and came back)
 */
export function resetEngagementTracking() {
    sessionStartTime = Date.now();
    milestonesReached.clear();
}
