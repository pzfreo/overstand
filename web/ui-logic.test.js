/**
 * Tests for UI logic functions from ui.js.
 *
 * Validates parameter visibility, output detection, error handling, status bar,
 * parameter controls, and tab state management documented in
 * docs/UI_DESIGN_DECISIONS.md.
 */

import { jest } from '@jest/globals';
import { state, elements, initElements } from './state.js';
import {
    checkParameterVisibility,
    isParameterOutput,
    showErrors,
    hideErrors,
    setStatus,
    createParameterControl,
    updateTabStates,
    setSwitchViewCallback
} from './ui.js';

beforeEach(() => {
    // Set up switchView callback which updateTabStates calls for Violin family
    setSwitchViewCallback(() => {});
    // DOM scaffold is set up by test-setup.js beforeEach
    initElements();
});

// ============================================
// checkParameterVisibility
// ============================================

describe('checkParameterVisibility', () => {
    beforeEach(() => {
        // Some visibility checks fall back to parameterDefinitions defaults
        state.parameterDefinitions = {
            parameters: {
                instrument_family: { default: 'VIOLIN' }
            }
        };
    });

    test('returns true when no visible_when condition', () => {
        const param = { label: 'Body Length', type: 'number' };
        expect(checkParameterVisibility(param, {})).toBe(true);
    });

    test('returns true when single value condition is met', () => {
        const param = {
            visible_when: { instrument_family: 'VIOLIN' }
        };
        expect(checkParameterVisibility(param, { instrument_family: 'VIOLIN' })).toBe(true);
    });

    test('returns false when single value condition is not met', () => {
        const param = {
            visible_when: { instrument_family: 'GUITAR_MANDOLIN' }
        };
        expect(checkParameterVisibility(param, { instrument_family: 'VIOLIN' })).toBe(false);
    });

    test('returns true when array condition is met', () => {
        const param = {
            visible_when: { instrument_family: ['VIOLIN', 'VIOL'] }
        };
        expect(checkParameterVisibility(param, { instrument_family: 'VIOL' })).toBe(true);
    });

    test('returns false when array condition is not met', () => {
        const param = {
            visible_when: { instrument_family: ['VIOLIN', 'VIOL'] }
        };
        expect(checkParameterVisibility(param, { instrument_family: 'GUITAR_MANDOLIN' })).toBe(false);
    });

    test('fret_join only visible for GUITAR_MANDOLIN', () => {
        // This matches the real fret_join parameter from parameter_registry.py
        const fretJoinParam = {
            visible_when: { instrument_family: 'GUITAR_MANDOLIN' }
        };
        expect(checkParameterVisibility(fretJoinParam, { instrument_family: 'VIOLIN' })).toBe(false);
        expect(checkParameterVisibility(fretJoinParam, { instrument_family: 'VIOL' })).toBe(false);
        expect(checkParameterVisibility(fretJoinParam, { instrument_family: 'GUITAR_MANDOLIN' })).toBe(true);
    });

    test('falls back to parameterDefinitions default when param not in currentParams', () => {
        const param = {
            visible_when: { instrument_family: 'VIOLIN' }
        };
        // instrument_family not in currentParams — should use default 'VIOLIN'
        expect(checkParameterVisibility(param, {})).toBe(true);
    });
});

// ============================================
// isParameterOutput
// ============================================

describe('isParameterOutput', () => {
    test('returns false when no is_output property', () => {
        expect(isParameterOutput({}, 'VIOLIN')).toBe(false);
    });

    test('returns true when is_output[mode] is true', () => {
        const param = { is_output: { GUITAR_MANDOLIN: true, VIOLIN: false } };
        expect(isParameterOutput(param, 'GUITAR_MANDOLIN')).toBe(true);
    });

    test('returns false when is_output[mode] is false', () => {
        const param = { is_output: { GUITAR_MANDOLIN: true, VIOLIN: false } };
        expect(isParameterOutput(param, 'VIOLIN')).toBe(false);
    });

    test('body_stop is output for GUITAR_MANDOLIN, input for VIOLIN', () => {
        // Matches the real body_stop parameter
        const bodyStop = { is_output: { VIOLIN: false, VIOL: false, GUITAR_MANDOLIN: true } };
        expect(isParameterOutput(bodyStop, 'VIOLIN')).toBe(false);
        expect(isParameterOutput(bodyStop, 'GUITAR_MANDOLIN')).toBe(true);
    });
});

// ============================================
// Error handling
// ============================================

describe('Error handling', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('showErrors adds "show" class to error panel', () => {
        showErrors(['test error']);
        expect(elements.errorPanel.classList.contains('show')).toBe(true);
    });

    test('showErrors with transient type adds transient class', () => {
        showErrors(['test'], 'transient');
        expect(elements.errorPanel.classList.contains('transient')).toBe(true);
    });

    test('showErrors with persistent type adds persistent class', () => {
        showErrors(['test'], 'persistent');
        expect(elements.errorPanel.classList.contains('persistent')).toBe(true);
    });

    test('transient errors auto-dismiss after 4 seconds', () => {
        showErrors(['test'], 'transient');
        expect(elements.errorPanel.classList.contains('show')).toBe(true);

        jest.advanceTimersByTime(3999);
        expect(elements.errorPanel.classList.contains('show')).toBe(true);

        jest.advanceTimersByTime(1);
        expect(elements.errorPanel.classList.contains('show')).toBe(false);
    });

    test('persistent errors do not auto-dismiss', () => {
        showErrors(['test'], 'persistent');
        jest.advanceTimersByTime(10000);
        expect(elements.errorPanel.classList.contains('show')).toBe(true);
    });

    test('hideErrors removes show class', () => {
        showErrors(['test'], 'persistent');
        hideErrors();
        expect(elements.errorPanel.classList.contains('show')).toBe(false);
    });

    test('error messages are rendered as list items', () => {
        showErrors(['Error 1', 'Error 2']);
        const items = elements.errorList.querySelectorAll('li');
        expect(items.length).toBe(2);
        expect(items[0].textContent).toBe('Error 1');
        expect(items[1].textContent).toBe('Error 2');
    });
});

// ============================================
// setStatus
// ============================================

describe('setStatus', () => {
    test('updates status text', () => {
        setStatus('ready', 'Ready');
        expect(elements.statusText.textContent).toBe('Ready');
    });

    test('updates status class', () => {
        setStatus('loading', 'Loading...');
        expect(elements.status.className).toBe('status-bar loading');
    });

    test('shows "Updating preview..." during generation', () => {
        setStatus('loading', 'Updating preview...');
        expect(elements.statusText.textContent).toBe('Updating preview...');
    });
});

// ============================================
// createParameterControl
// ============================================

describe('createParameterControl', () => {
    const noopCallbacks = {
        onInputChange: () => {},
        onEnumChange: () => {},
        collectParameters: () => ({})
    };

    test('creates number input with correct attributes', () => {
        const param = {
            type: 'number', label: 'Body Length', unit: 'mm',
            default: 355, min: 10, max: 1000, step: 1,
            description: 'Length of body'
        };
        const el = createParameterControl('body_length', param, false, noopCallbacks);
        const input = el.querySelector('input[type="number"]');
        expect(input).not.toBeNull();
        expect(input.value).toBe('355');
        expect(input.min).toBe('10');
        expect(input.max).toBe('1000');
    });

    test('output parameters are readonly with indicator', () => {
        const param = {
            type: 'number', label: 'Neck Angle', unit: '°',
            default: 5.2, min: 0, max: 90, step: 0.1,
            description: 'Calculated angle'
        };
        const el = createParameterControl('neck_angle', param, true, noopCallbacks);
        const input = el.querySelector('input');
        expect(input.readOnly).toBe(true);
        expect(input.classList.contains('readonly-output')).toBe(true);
        expect(el.classList.contains('param-output')).toBe(true);

        // "(calculated)" indicator
        const indicator = el.querySelector('.output-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toMatch(/calculated/);
    });

    test('creates enum/select control', () => {
        const param = {
            type: 'enum', label: 'Instrument Family',
            options: [
                { value: 'VIOLIN', label: 'Violin Family' },
                { value: 'VIOL', label: 'Viol Family' }
            ],
            default: 'VIOLIN',
            description: 'Select family'
        };
        const el = createParameterControl('instrument_family', param, false, noopCallbacks);
        const select = el.querySelector('select');
        expect(select).not.toBeNull();
        expect(select.options.length).toBe(2);
        expect(select.value).toBe('VIOLIN');
    });

    test('creates boolean/checkbox control', () => {
        const param = {
            type: 'boolean', label: 'Show Measurements',
            default: true, description: 'Display annotations'
        };
        const el = createParameterControl('show_measurements', param, false, noopCallbacks);
        const checkbox = el.querySelector('input[type="checkbox"]');
        expect(checkbox).not.toBeNull();
        expect(checkbox.checked).toBe(true);
    });

    test('creates string/text control', () => {
        const param = {
            type: 'string', label: 'Instrument Name',
            default: 'My Instrument', max_length: 50,
            description: 'Name for this instrument'
        };
        const el = createParameterControl('instrument_name', param, false, noopCallbacks);
        const input = el.querySelector('input[type="text"]');
        expect(input).not.toBeNull();
        expect(input.value).toBe('My Instrument');
        expect(input.maxLength).toBe(50);
    });

    test('adds description as tooltip when present', () => {
        const param = {
            type: 'number', label: 'Test', unit: 'mm',
            default: 10, min: 0, max: 100, step: 1,
            description: 'A helpful description'
        };
        const el = createParameterControl('test', param, false, noopCallbacks);
        expect(el.title).toBe('A helpful description');
    });
});

// ============================================
// updateTabStates
// ============================================

describe('updateTabStates', () => {
    beforeEach(() => {
        // Add fret_positions tab to DOM (not in default test-setup scaffold)
        const viewTabs = document.getElementById('view-tabs');
        const fretTab = document.createElement('button');
        fretTab.className = 'view-tab';
        fretTab.dataset.view = 'fret_positions';
        fretTab.textContent = 'Fret Positions';
        viewTabs.appendChild(fretTab);

        // Need parameterDefinitions for visibility checks in updateParameterVisibility
        // (called internally by updateTabStates)
        state.parameterDefinitions = { parameters: {}, categories: [] };
        state.uiSections = null;
    });

    test('disables fret tab for Violin family', () => {
        updateTabStates({ instrument_family: 'VIOLIN' });
        const fretTab = document.querySelector('.view-tab[data-view="fret_positions"]');
        expect(fretTab.disabled).toBe(true);
        expect(fretTab.style.opacity).toBe('0.3');
        expect(fretTab.style.cursor).toBe('not-allowed');
    });

    test('enables fret tab for Viol family', () => {
        updateTabStates({ instrument_family: 'VIOL' });
        const fretTab = document.querySelector('.view-tab[data-view="fret_positions"]');
        expect(fretTab.disabled).toBe(false);
        expect(fretTab.style.opacity).toBe('1');
        expect(fretTab.style.cursor).toBe('pointer');
    });

    test('enables fret tab for Guitar/Mandolin family', () => {
        updateTabStates({ instrument_family: 'GUITAR_MANDOLIN' });
        const fretTab = document.querySelector('.view-tab[data-view="fret_positions"]');
        expect(fretTab.disabled).toBe(false);
    });

    test('calls switchView when disabling currently active fret_positions', () => {
        const calls = [];
        setSwitchViewCallback((view) => calls.push(view));
        state.currentView = 'fret_positions';
        updateTabStates({ instrument_family: 'VIOLIN' });
        expect(calls).toContain('side');
        state.currentView = 'side'; // reset
    });
});
