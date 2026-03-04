/**
 * Tests for generation.js - Template generation and error classification
 */

import { vi } from 'vitest';
import { classifyErrors } from './generation.js';

// ============================================
// classifyErrors
// ============================================

describe('classifyErrors', () => {
    test('returns transient for null/empty errors', () => {
        expect(classifyErrors(null)).toBe('transient');
        expect(classifyErrors([])).toBe('transient');
    });

    test('returns transient for validation errors', () => {
        expect(classifyErrors(['Validation failed: value too large'])).toBe('transient');
        expect(classifyErrors(['Parameter must be positive'])).toBe('transient');
        expect(classifyErrors(['Invalid value for body_length'])).toBe('transient');
    });

    test('returns persistent for geometry errors', () => {
        expect(classifyErrors(['Geometry error: cannot compute'])).toBe('persistent');
    });

    test('returns persistent for calculation errors', () => {
        expect(classifyErrors(['Calculation failed for neck angle'])).toBe('persistent');
    });

    test('returns persistent for general failures', () => {
        expect(classifyErrors(['Operation failed'])).toBe('persistent');
    });

    test('returns transient for unknown error patterns', () => {
        expect(classifyErrors(['Something unexpected happened'])).toBe('transient');
    });

    test('checks all errors combined (case insensitive)', () => {
        // "FAILED" in second error triggers persistent
        expect(classifyErrors(['Minor issue', 'CALCULATION FAILED'])).toBe('persistent');
    });

    test('validation keyword takes precedence when it appears first in text', () => {
        // Both validation and failed present — validation check runs first
        expect(classifyErrors(['Validation failed'])).toBe('transient');
    });
});

// ============================================
// generateNeck
// ============================================

// generateNeck requires heavy mocking of the TS engine import
// which uses a bare specifier '/dist/instrument_generator.js'.
// We test it by mocking all dependencies.

vi.mock('/dist/instrument_generator.js', () => ({
    generateViolinNeck: vi.fn(),
    getDerivedValues: vi.fn(),
}));

vi.mock('./analytics.js', () => ({
    trackTemplateGenerated: vi.fn(),
    trackError: vi.fn(),
}));

vi.mock('./ui.js', () => ({
    hideErrors: vi.fn(),
    showErrors: vi.fn(),
    setStatus: vi.fn(),
    displayCurrentView: vi.fn(),
    updateTabStates: vi.fn(),
    generateDimensionsTableHTML: vi.fn(() => '<table></table>'),
}));

vi.mock('./params.js', () => ({
    collectParameters: vi.fn(() => ({ instrument_family: 'VIOLIN', body_length: 355 })),
    debounce: vi.fn((fn) => fn),
}));

describe('generateNeck', () => {
    let generateNeck, state, elements, generateViolinNeck, ui, analytics;

    beforeEach(async () => {
        vi.resetAllMocks();

        const stateModule = await import('./state.js');
        state = stateModule.state;
        elements = stateModule.elements;

        // Set up elements that generateNeck accesses directly
        stateModule.initElements();
        // Add has-content class setup and preview element
        elements.preview = document.getElementById('preview-container');

        // Reset state
        state.isGenerating = false;
        state.views = null;

        const genModule = await import('./generation.js');
        generateNeck = genModule.generateNeck;

        generateViolinNeck = (await import('/dist/instrument_generator.js')).generateViolinNeck;
        ui = await import('./ui.js');
        analytics = await import('./analytics.js');
    });

    test('does nothing if already generating', () => {
        state.isGenerating = true;
        generateNeck();
        expect(ui.hideErrors).not.toHaveBeenCalled();
    });

    test('sets isGenerating flag during execution', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views: { side: '<svg></svg>' },
            derived_values: {}, derived_formatted: {}
        }));

        generateNeck();
        // After completion, isGenerating should be reset
        expect(state.isGenerating).toBe(false);
    });

    test('re-enables generate button after completion', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views: { side: '<svg></svg>' },
            derived_values: {}, derived_formatted: {}
        }));

        generateNeck();
        expect(elements.genBtn.disabled).toBe(false);
    });

    test('updates state.views on success', () => {
        const views = { side: '<svg>side</svg>', top: '<svg>top</svg>' };
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views, derived_values: {}, derived_formatted: {}
        }));

        generateNeck();
        expect(state.views.side).toBe('<svg>side</svg>');
        expect(state.views.top).toBe('<svg>top</svg>');
    });

    test('stores derived values on success', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views: { side: '<svg></svg>' },
            derived_values: { neck_angle: 5.2 },
            derived_formatted: { neck_angle: '5.20°' }
        }));

        generateNeck();
        expect(state.derivedValues).toEqual({ neck_angle: 5.2 });
        expect(state.derivedFormatted).toEqual({ neck_angle: '5.20°' });
    });

    test('calls displayCurrentView on success', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views: { side: '<svg></svg>' },
            derived_values: {}, derived_formatted: {}
        }));

        generateNeck();
        expect(ui.displayCurrentView).toHaveBeenCalled();
    });

    test('tracks template generation on success', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: true, views: { side: '<svg></svg>' },
            derived_values: {}, derived_formatted: {}
        }));

        generateNeck();
        expect(analytics.trackTemplateGenerated).toHaveBeenCalledWith('VIOLIN');
    });

    test('shows errors on failure result', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: false, errors: ['Geometry error: invalid dimensions']
        }));

        generateNeck();
        expect(ui.showErrors).toHaveBeenCalledWith(
            ['Geometry error: invalid dimensions'],
            'persistent'
        );
    });

    test('tracks error on failure result', () => {
        generateViolinNeck.mockReturnValue(JSON.stringify({
            success: false, errors: ['Bad value']
        }));

        generateNeck();
        expect(analytics.trackError).toHaveBeenCalledWith('generation', 'Bad value');
    });

    test('handles exceptions gracefully', () => {
        generateViolinNeck.mockImplementation(() => { throw new Error('Engine crashed'); });

        generateNeck();
        expect(ui.showErrors).toHaveBeenCalledWith(
            ['Unexpected error: Engine crashed'],
            'persistent'
        );
        expect(state.isGenerating).toBe(false);
        expect(elements.genBtn.disabled).toBe(false);
    });

    test('tracks exception errors', () => {
        generateViolinNeck.mockImplementation(() => { throw new Error('boom'); });

        generateNeck();
        expect(analytics.trackError).toHaveBeenCalledWith('generation_exception', 'boom');
    });
});
