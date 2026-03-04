/**
 * Tests for params.js - Parameter collection, debounce, and form management
 */

import { vi } from 'vitest';
import { state } from './state.js';
import { debounce, collectParameters, applyParametersToForm, updateSaveIndicator, markParametersModified, confirmDiscardChanges } from './params.js';

// ============================================
// debounce
// ============================================

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('delays function execution', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('resets timer on subsequent calls', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced(); // Reset
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('passes arguments to debounced function', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 'b');
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a', 'b');
    });

    test('uses arguments from last call when debounced', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        debounced('second');
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('second');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

// ============================================
// collectParameters
// ============================================

describe('collectParameters', () => {
    beforeEach(() => {
        state.parameterDefinitions = null;
    });

    test('returns empty object when no parameter definitions', () => {
        expect(collectParameters()).toEqual({});
    });

    test('collects number parameters with parsed float', () => {
        state.parameterDefinitions = {
            parameters: {
                body_length: { type: 'number', default: 355 }
            }
        };

        // Create form element
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'body_length';
        input.value = '360';
        document.body.appendChild(input);

        const params = collectParameters();
        expect(params.body_length).toBe(360);

        document.body.removeChild(input);
    });

    test('falls back to default for invalid number input', () => {
        state.parameterDefinitions = {
            parameters: {
                body_length: { type: 'number', default: 355 }
            }
        };

        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'body_length';
        input.value = 'not-a-number';
        document.body.appendChild(input);

        const params = collectParameters();
        expect(params.body_length).toBe(355);

        document.body.removeChild(input);
    });

    test('collects boolean parameters from checkbox', () => {
        state.parameterDefinitions = {
            parameters: {
                show_measurements: { type: 'boolean', default: true }
            }
        };

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'show_measurements';
        input.checked = false;
        document.body.appendChild(input);

        const params = collectParameters();
        expect(params.show_measurements).toBe(false);

        document.body.removeChild(input);
    });

    test('collects string/enum parameters as value', () => {
        state.parameterDefinitions = {
            parameters: {
                instrument_family: { type: 'enum', default: 'VIOLIN' }
            }
        };

        const select = document.createElement('select');
        select.id = 'instrument_family';
        const opt = document.createElement('option');
        opt.value = 'VIOL';
        opt.textContent = 'Viol';
        select.appendChild(opt);
        select.value = 'VIOL';
        document.body.appendChild(select);

        const params = collectParameters();
        expect(params.instrument_family).toBe('VIOL');

        document.body.removeChild(select);
    });

    test('skips parameters without DOM elements', () => {
        state.parameterDefinitions = {
            parameters: {
                missing_param: { type: 'number', default: 10 }
            }
        };

        const params = collectParameters();
        expect(params).toEqual({});
    });

    test('collects multiple parameters at once', () => {
        state.parameterDefinitions = {
            parameters: {
                body_length: { type: 'number', default: 355 },
                show_dimensions: { type: 'boolean', default: true },
                instrument_family: { type: 'enum', default: 'VIOLIN' }
            }
        };

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.id = 'body_length';
        numInput.value = '400';
        document.body.appendChild(numInput);

        const checkInput = document.createElement('input');
        checkInput.type = 'checkbox';
        checkInput.id = 'show_dimensions';
        checkInput.checked = true;
        document.body.appendChild(checkInput);

        const select = document.createElement('select');
        select.id = 'instrument_family';
        const opt = document.createElement('option');
        opt.value = 'VIOLIN';
        select.appendChild(opt);
        select.value = 'VIOLIN';
        document.body.appendChild(select);

        const params = collectParameters();
        expect(params.body_length).toBe(400);
        expect(params.show_dimensions).toBe(true);
        expect(params.instrument_family).toBe('VIOLIN');

        document.body.removeChild(numInput);
        document.body.removeChild(checkInput);
        document.body.removeChild(select);
    });
});

// ============================================
// applyParametersToForm
// ============================================

describe('applyParametersToForm', () => {
    test('sets value on input elements', () => {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'body_length';
        document.body.appendChild(input);

        applyParametersToForm({ body_length: 400 });
        expect(input.value).toBe('400');

        document.body.removeChild(input);
    });

    test('sets checked on checkbox elements', () => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'show_measurements';
        document.body.appendChild(input);

        applyParametersToForm({ show_measurements: true });
        expect(input.checked).toBe(true);

        applyParametersToForm({ show_measurements: false });
        expect(input.checked).toBe(false);

        document.body.removeChild(input);
    });

    test('sets value on select elements', () => {
        const select = document.createElement('select');
        select.id = 'instrument_family';
        ['VIOLIN', 'VIOL'].forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            select.appendChild(opt);
        });
        document.body.appendChild(select);

        applyParametersToForm({ instrument_family: 'VIOL' });
        expect(select.value).toBe('VIOL');

        document.body.removeChild(select);
    });

    test('skips parameters without matching DOM elements', () => {
        // Should not throw
        applyParametersToForm({ nonexistent: 42 });
    });
});

// ============================================
// updateSaveIndicator
// ============================================

describe('updateSaveIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = document.createElement('span');
        indicator.id = 'save-indicator';
        document.body.appendChild(indicator);
        state.parametersModified = false;
        state.currentProfileName = null;
    });

    afterEach(() => {
        document.body.removeChild(indicator);
    });

    test('shows empty when no profile loaded', () => {
        updateSaveIndicator();
        expect(indicator.textContent).toBe('');
        expect(indicator.className).toBe('save-indicator');
    });

    test('shows profile name when saved', () => {
        state.currentProfileName = 'My Violin';
        state.parametersModified = false;
        updateSaveIndicator();
        expect(indicator.textContent).toBe('— My Violin');
        expect(indicator.className).toBe('save-indicator');
    });

    test('shows unsaved state with profile name', () => {
        state.currentProfileName = 'My Violin';
        state.parametersModified = true;
        updateSaveIndicator();
        expect(indicator.textContent).toBe('— My Violin (unsaved)');
        expect(indicator.className).toBe('save-indicator unsaved');
    });

    test('does nothing when indicator element missing', () => {
        document.body.removeChild(indicator);
        // Should not throw
        updateSaveIndicator();
        // Re-add so afterEach doesn't fail
        indicator = document.createElement('span');
        indicator.id = 'save-indicator';
        document.body.appendChild(indicator);
    });
});

// ============================================
// confirmDiscardChanges
// ============================================

describe('confirmDiscardChanges', () => {
    test('returns true immediately when no modifications', async () => {
        state.parametersModified = false;
        const result = await confirmDiscardChanges('Load preset');
        expect(result).toBe(true);
    });
});
