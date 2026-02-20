/**
 * Tests for ParameterSection component.
 *
 * ParameterSection wraps an Accordion and renders input controls
 * using createParameterControl from ui.js.
 */

import { jest } from '@jest/globals';
import { state } from '../state.js';
import { ParameterSection } from './parameter-section.js';

// Minimal section definition matching ui_metadata.py shape
function makeSectionDef(overrides = {}) {
    return {
        id: 'basic-geometry',
        title: 'Basic Geometry',
        icon: '📐',
        default_expanded: true,
        description: 'Core instrument dimensions',
        parameter_names: ['body_length', 'neck_length'],
        ...overrides,
    };
}

// Parameter metadata (mirrors Python parameter_registry)
function makeParameters() {
    return {
        body_length: {
            type: 'number',
            label: 'Body Length',
            unit: 'mm',
            default: 355,
            min: 100,
            max: 1000,
            step: 1,
            description: 'Length of the instrument body',
        },
        neck_length: {
            type: 'number',
            label: 'Neck Length',
            unit: 'mm',
            default: 130,
            min: 50,
            max: 500,
            step: 1,
            description: 'Length of the neck',
        },
        fret_count: {
            type: 'number',
            label: 'Fret Count',
            unit: '',
            default: 7,
            min: 1,
            max: 24,
            step: 1,
            description: 'Number of frets',
            visible_when: { instrument_family: 'GUITAR_MANDOLIN' },
        },
    };
}

const noopCallbacks = {
    onInputChange: () => {},
    onEnumChange: () => {},
    collectParameters: () => ({ instrument_family: 'VIOLIN' }),
};

beforeEach(() => {
    // ui.js checkParameterVisibility reads state.parameterDefinitions
    state.parameterDefinitions = {
        parameters: {
            instrument_family: { default: 'VIOLIN' },
        },
        categories: [],
    };
    state.uiSections = null;
});

describe('ParameterSection', () => {
    test('creates an element that can be appended to DOM', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef(),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const el = section.getElement();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.className).toBe('accordion-section');
    });

    test('renders section description', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef(),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const desc = section.getAccordion().getContentElement()
            .querySelector('.section-description');
        expect(desc).not.toBeNull();
        expect(desc.textContent).toBe('Core instrument dimensions');
    });

    test('skips description when not present', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({ description: null }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const desc = section.getAccordion().getContentElement()
            .querySelector('.section-description');
        expect(desc).toBeNull();
    });

    test('renders param-group for each parameter_name', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef(),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const groups = section.getAccordion().getContentElement()
            .querySelectorAll('.param-group');
        expect(groups.length).toBe(2);
    });

    test('renders number inputs with correct values', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef(),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const content = section.getAccordion().getContentElement();
        const bodyInput = content.querySelector('#body_length');
        expect(bodyInput).not.toBeNull();
        expect(bodyInput.type).toBe('number');
        expect(bodyInput.value).toBe('355');
    });

    test('warns and skips unknown parameter names', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const section = new ParameterSection({
            sectionDef: makeSectionDef({ parameter_names: ['nonexistent'] }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('nonexistent')
        );

        const groups = section.getAccordion().getContentElement()
            .querySelectorAll('.param-group');
        expect(groups.length).toBe(0);

        warnSpy.mockRestore();
    });

    test('hides parameters that fail visibility check', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({ parameter_names: ['fret_count'] }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        const group = section.getAccordion().getContentElement()
            .querySelector('.param-group[data-param-name="fret_count"]');
        expect(group).not.toBeNull();
        expect(group.style.display).toBe('none');
    });

    test('shows parameters that pass visibility check', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({ parameter_names: ['fret_count'] }),
            parameters: makeParameters(),
            callbacks: {
                ...noopCallbacks,
                collectParameters: () => ({ instrument_family: 'GUITAR_MANDOLIN' }),
            },
            currentParams: { instrument_family: 'GUITAR_MANDOLIN' },
        });

        const group = section.getAccordion().getContentElement()
            .querySelector('.param-group[data-param-name="fret_count"]');
        expect(group.style.display).not.toBe('none');
    });

    // ---- updateVisibility ----

    test('updateVisibility toggles parameter display', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({
                parameter_names: ['body_length', 'fret_count'],
            }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        document.body.appendChild(section.getElement());

        // fret_count should be hidden for VIOLIN
        let fretGroup = section.getAccordion().getContentElement()
            .querySelector('.param-group[data-param-name="fret_count"]');
        expect(fretGroup.style.display).toBe('none');

        // Switch to GUITAR_MANDOLIN
        section.updateVisibility({ instrument_family: 'GUITAR_MANDOLIN' });

        fretGroup = section.getAccordion().getContentElement()
            .querySelector('.param-group[data-param-name="fret_count"]');
        expect(fretGroup.style.display).toBe('');

        document.body.removeChild(section.getElement());
    });

    test('updateVisibility hides section when no parameters visible', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({
                parameter_names: ['fret_count'],
            }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'GUITAR_MANDOLIN' },
        });

        document.body.appendChild(section.getElement());

        // Switch to VIOLIN — fret_count hidden, section should hide
        section.updateVisibility({ instrument_family: 'VIOLIN' });
        expect(section.getElement().style.display).toBe('none');

        // Switch back — section should reappear
        section.updateVisibility({ instrument_family: 'GUITAR_MANDOLIN' });
        expect(section.getElement().style.display).toBe('');

        document.body.removeChild(section.getElement());
    });

    // ---- Delegation to Accordion ----

    test('isExpanded reflects accordion state', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({ default_expanded: false }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });
        expect(section.isExpanded()).toBe(false);
    });

    test('setExpanded changes accordion state', () => {
        const section = new ParameterSection({
            sectionDef: makeSectionDef({ default_expanded: false }),
            parameters: makeParameters(),
            callbacks: noopCallbacks,
            currentParams: { instrument_family: 'VIOLIN' },
        });

        section.setExpanded(true);
        expect(section.isExpanded()).toBe(true);
    });
});
