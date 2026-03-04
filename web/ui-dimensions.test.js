/**
 * Tests for ui.js - generateDimensionsTableHTML and populatePresets
 *
 * These test the untested logic-heavy functions in ui.js that were
 * not covered by ui-logic.test.js.
 */

import { state, elements, initElements } from './state.js';
import {
    generateDimensionsTableHTML,
    populatePresets,
    displayCurrentView,
    updateParameterVisibility,
    setSwitchViewCallback,
} from './ui.js';

beforeEach(() => {
    setSwitchViewCallback(() => {});
    initElements();
    state.parameterDefinitions = { parameters: {}, categories: [] };
    state.uiSections = null;
    state.uiMetadata = null;
    state.derivedMetadata = null;
});

// ============================================
// generateDimensionsTableHTML
// ============================================

describe('generateDimensionsTableHTML', () => {
    test('returns table HTML with headers', () => {
        state.parameterDefinitions = {
            categories: [],
            parameters: {}
        };

        const html = generateDimensionsTableHTML({}, {});
        expect(html).toContain('<table class="dimensions-table">');
        expect(html).toContain('<th>Parameter</th>');
        expect(html).toContain('<th>Value</th>');
        expect(html).toContain('</table>');
    });

    test('renders number parameters with correct decimals based on step', () => {
        state.parameterDefinitions = {
            categories: ['Geometry'],
            parameters: {
                body_length: {
                    type: 'number', label: 'Body Length',
                    unit: 'mm', step: 1, category: 'Geometry'
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { body_length: 355 }, {}
        );
        expect(html).toContain('Body Length');
        expect(html).toContain('355');
        expect(html).toContain('mm');
    });

    test('infers decimal places from step (0.1 = 1 decimal)', () => {
        state.parameterDefinitions = {
            categories: ['Angles'],
            parameters: {
                neck_angle: {
                    type: 'number', label: 'Neck Angle',
                    unit: '°', step: 0.01, category: 'Angles'
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { neck_angle: 5.256 }, {}
        );
        expect(html).toContain('5.26'); // 2 decimal places from step 0.01
    });

    test('shows em dash for null/NaN values', () => {
        state.parameterDefinitions = {
            categories: ['Geometry'],
            parameters: {
                body_length: {
                    type: 'number', label: 'Body Length',
                    unit: 'mm', step: 1, category: 'Geometry'
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { body_length: null }, {}
        );
        expect(html).toContain('—');
    });

    test('renders boolean parameters as Yes/No', () => {
        state.parameterDefinitions = {
            categories: ['Display'],
            parameters: {
                show_measurements: {
                    type: 'boolean', label: 'Show Measurements',
                    category: 'Display'
                }
            }
        };

        const htmlYes = generateDimensionsTableHTML(
            { show_measurements: true }, {}
        );
        expect(htmlYes).toContain('Yes');

        const htmlNo = generateDimensionsTableHTML(
            { show_measurements: false }, {}
        );
        expect(htmlNo).toContain('No');
    });

    test('renders enum parameters with label not value', () => {
        state.parameterDefinitions = {
            categories: ['General'],
            parameters: {
                instrument_family: {
                    type: 'enum', label: 'Instrument Family',
                    category: 'General',
                    options: [
                        { value: 'VIOLIN', label: 'Violin Family' },
                        { value: 'VIOL', label: 'Viol Family' }
                    ]
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { instrument_family: 'VIOLIN' }, {}
        );
        expect(html).toContain('Violin Family');
        expect(html).not.toContain('>VIOLIN<');
    });

    test('skips Display Options category', () => {
        state.parameterDefinitions = {
            categories: ['Geometry', 'Display Options'],
            parameters: {
                body_length: {
                    type: 'number', label: 'Body Length',
                    unit: 'mm', step: 1, category: 'Geometry'
                },
                show_grid: {
                    type: 'boolean', label: 'Show Grid',
                    category: 'Display Options'
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { body_length: 355, show_grid: true }, {}
        );
        expect(html).toContain('Body Length');
        expect(html).not.toContain('Show Grid');
        expect(html).not.toContain('Display Options');
    });

    test('hides parameters that fail visibility check', () => {
        state.parameterDefinitions = {
            categories: ['Setup'],
            parameters: {
                fret_count: {
                    type: 'number', label: 'Fret Count', unit: '',
                    step: 1, category: 'Setup',
                    visible_when: { instrument_family: 'GUITAR_MANDOLIN' }
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { instrument_family: 'VIOLIN', fret_count: 7 }, {}
        );
        expect(html).not.toContain('Fret Count');
    });

    test('shows category header only when visible params exist', () => {
        state.parameterDefinitions = {
            categories: ['Setup'],
            parameters: {
                fret_count: {
                    type: 'number', label: 'Fret Count', unit: '',
                    step: 1, category: 'Setup',
                    visible_when: { instrument_family: 'GUITAR_MANDOLIN' }
                }
            }
        };

        const html = generateDimensionsTableHTML(
            { instrument_family: 'VIOLIN' }, {}
        );
        expect(html).not.toContain('Setup');
    });

    test('renders derived values section with metadata', () => {
        state.parameterDefinitions = { categories: [], parameters: {} };
        state.derivedMetadata = {
            neck_angle: {
                display_name: 'Neck Angle', unit: '°',
                decimals: 2, category: 'Key Measurements',
                visible: true, order: 1
            }
        };

        const html = generateDimensionsTableHTML(
            {}, { neck_angle: 5.25 }
        );
        expect(html).toContain('Key Measurements');
        expect(html).toContain('Neck Angle');
        expect(html).toContain('5.25');
    });

    test('uses pre-formatted derived values when available', () => {
        state.parameterDefinitions = { categories: [], parameters: {} };
        state.derivedMetadata = {
            neck_angle: {
                display_name: 'Neck Angle', unit: '°',
                decimals: 2, category: 'Measurements',
                visible: true, order: 1
            }
        };

        const html = generateDimensionsTableHTML(
            {}, { neck_angle: 5.256 }, { neck_angle: '5.26 °' }
        );
        expect(html).toContain('5.26');
    });

    test('skips derived values with visible=false', () => {
        state.parameterDefinitions = { categories: [], parameters: {} };
        state.derivedMetadata = {
            hidden_value: {
                display_name: 'Hidden', unit: 'mm',
                decimals: 1, category: 'Internal',
                visible: false, order: 1
            }
        };

        const html = generateDimensionsTableHTML(
            {}, { hidden_value: 42.0 }
        );
        expect(html).not.toContain('Hidden');
    });

    test('sorts derived values by order within category', () => {
        state.parameterDefinitions = { categories: [], parameters: {} };
        state.derivedMetadata = {
            second: {
                display_name: 'Second', unit: 'mm',
                decimals: 1, category: 'Results',
                visible: true, order: 2
            },
            first: {
                display_name: 'First', unit: 'mm',
                decimals: 1, category: 'Results',
                visible: true, order: 1
            }
        };

        const html = generateDimensionsTableHTML(
            {}, { first: 10, second: 20 }
        );
        const firstPos = html.indexOf('First');
        const secondPos = html.indexOf('Second');
        expect(firstPos).toBeLessThan(secondPos);
    });
});

// ============================================
// populatePresets
// ============================================

describe('populatePresets', () => {
    test('populates from uiMetadata presets when available', () => {
        state.uiMetadata = {
            presets: {
                violin: {
                    id: 'violin', display_name: 'Standard Violin',
                    family: 'Violin', description: 'A standard violin'
                },
                viola: {
                    id: 'viola', display_name: 'Standard Viola',
                    family: 'Violin', description: 'A standard viola'
                }
            }
        };

        populatePresets();
        const options = elements.presetSelect.querySelectorAll('option');
        expect(options.length).toBe(2);
    });

    test('sorts presets by family then display name', () => {
        state.uiMetadata = {
            presets: {
                bass_viol: {
                    id: 'bass_viol', display_name: 'Bass Viol',
                    family: 'Viol', description: ''
                },
                violin: {
                    id: 'violin', display_name: 'Standard Violin',
                    family: 'Violin', description: ''
                },
                alto_viol: {
                    id: 'alto_viol', display_name: 'Alto Viol',
                    family: 'Viol', description: ''
                }
            }
        };

        populatePresets();
        const options = [...elements.presetSelect.querySelectorAll('option')];
        const names = options.map(o => o.textContent);
        // "Viol" sorts before "Violin" alphabetically
        // Within Viol: Alto before Bass
        expect(names.indexOf('Alto Viol')).toBeLessThan(names.indexOf('Bass Viol'));
        expect(names.indexOf('Bass Viol')).toBeLessThan(names.indexOf('Standard Violin'));
    });

    test('puts custom preset last', () => {
        state.uiMetadata = {
            presets: {
                custom: {
                    id: 'custom', display_name: 'Custom / Other',
                    family: 'Other', description: ''
                },
                violin: {
                    id: 'violin', display_name: 'Standard Violin',
                    family: 'Violin', description: ''
                }
            }
        };

        populatePresets();
        const options = [...elements.presetSelect.querySelectorAll('option')];
        expect(options[options.length - 1].value).toBe('custom');
    });

    test('defaults to violin preset when available', () => {
        state.uiMetadata = {
            presets: {
                viola: {
                    id: 'viola', display_name: 'Standard Viola',
                    family: 'Violin', description: ''
                },
                violin: {
                    id: 'violin', display_name: 'Standard Violin',
                    family: 'Violin', description: ''
                }
            }
        };

        populatePresets();
        expect(elements.presetSelect.value).toBe('violin');
    });

    test('falls back to legacy presets when uiMetadata absent', () => {
        state.uiMetadata = null;
        state.presets = {
            basic_violin: { name: 'Basic Violin' },
            basic_viola: { name: 'Basic Viola' }
        };

        populatePresets();
        const options = [...elements.presetSelect.querySelectorAll('option')];
        // First option is custom placeholder
        expect(options[0].textContent).toBe('-- Custom --');
        expect(options[1].textContent).toBe('Basic Violin');
        expect(options[2].textContent).toBe('Basic Viola');
    });

    test('falls back to legacy presets when uiMetadata presets empty', () => {
        state.uiMetadata = { presets: {} };
        state.presets = {
            test_preset: { name: 'Test' }
        };

        populatePresets();
        const options = [...elements.presetSelect.querySelectorAll('option')];
        expect(options[0].textContent).toBe('-- Custom --');
    });

    test('sets title attribute from description', () => {
        state.uiMetadata = {
            presets: {
                violin: {
                    id: 'violin', display_name: 'Violin',
                    family: 'Violin', description: 'Standard 4/4 violin'
                }
            }
        };

        populatePresets();
        const option = elements.presetSelect.querySelector('option');
        expect(option.title).toBe('Standard 4/4 violin');
    });
});

// ============================================
// displayCurrentView
// ============================================

describe('displayCurrentView', () => {
    test('does nothing when views is null', () => {
        state.views = null;
        state.currentView = 'side';
        displayCurrentView();
        // Should not throw
    });

    test('does nothing when current view does not exist', () => {
        state.views = { side: '<svg></svg>' };
        state.currentView = 'nonexistent';
        displayCurrentView();
        // Should not throw
    });

    test('renders dimensions view as HTML', () => {
        state.views = { dimensions: '<div>Dimensions table</div>' };
        state.currentView = 'dimensions';
        state.svgCanvas = null;

        displayCurrentView();
        expect(elements.preview.innerHTML).toContain('Dimensions table');
    });

    test('renders fret positions when available', () => {
        state.views = {
            fret_positions: { available: true, html: '<table>Frets</table>' }
        };
        state.currentView = 'fret_positions';
        state.svgCanvas = null;

        displayCurrentView();
        expect(elements.preview.innerHTML).toContain('Frets');
    });

    test('shows message when fret positions not available', () => {
        state.views = {
            fret_positions: { available: false }
        };
        state.currentView = 'fret_positions';
        state.svgCanvas = null;

        displayCurrentView();
        expect(elements.preview.innerHTML).toContain('not available');
    });
});

// ============================================
// updateParameterVisibility
// ============================================

describe('updateParameterVisibility', () => {
    test('delegates to component sections when available', () => {
        const mockSection = { updateVisibility: vi.fn() };
        state.uiSections = { input: [mockSection] };
        state.parameterDefinitions = { parameters: {} };

        updateParameterVisibility({ instrument_family: 'VIOLIN' });
        expect(mockSection.updateVisibility).toHaveBeenCalledWith({ instrument_family: 'VIOLIN' });
    });

    test('falls back to legacy when no component sections', () => {
        state.uiSections = null;
        state.parameterDefinitions = {
            parameters: {
                fret_count: {
                    label: 'Fret Count',
                    visible_when: { instrument_family: 'GUITAR_MANDOLIN' }
                }
            }
        };

        // Create a param group in DOM
        const group = document.createElement('div');
        group.className = 'param-group';
        group.dataset.paramName = 'fret_count';
        document.body.appendChild(group);

        updateParameterVisibility({ instrument_family: 'VIOLIN' });
        expect(group.style.display).toBe('none');

        document.body.removeChild(group);
    });
});
