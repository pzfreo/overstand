/**
 * Tests for OutputSection component.
 *
 * OutputSection wraps an Accordion and renders read-only derived values
 * with formatting, units, and descriptions.
 */

import { jest } from '@jest/globals';
import { OutputSection } from './output-section.js';

// Minimal section definition matching ui_metadata.py shape
function makeSectionDef(overrides = {}) {
    return {
        id: 'key-measurements',
        title: 'Key Measurements',
        icon: '📏',
        default_expanded: true,
        description: 'Calculated output values',
        parameter_names: ['neck_angle', 'string_length'],
        ...overrides,
    };
}

// Derived value metadata (mirrors Python DERIVED_VALUE_METADATA)
function makeDerivedValues() {
    return {
        neck_angle: {
            display_name: 'Neck Angle',
            unit: '°',
            decimals: 2,
            description: 'Angle of the neck relative to the body',
        },
        string_length: {
            display_name: 'String Length',
            unit: 'mm',
            decimals: 1,
            description: null,
        },
    };
}

describe('OutputSection', () => {
    test('creates an element that can be appended to DOM', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const el = section.getElement();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.className).toBe('accordion-section');
    });

    test('renders section description', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const desc = section.getAccordion().getContentElement()
            .querySelector('.section-description');
        expect(desc).not.toBeNull();
        expect(desc.textContent).toBe('Calculated output values');
    });

    test('skips description when not present', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef({ description: null }),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const desc = section.getAccordion().getContentElement()
            .querySelector('.section-description');
        expect(desc).toBeNull();
    });

    test('renders output groups for each parameter_name', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: { neck_angle: 5.25, string_length: 325.0 },
        });

        const groups = section.getAccordion().getContentElement()
            .querySelectorAll('.output-group');
        expect(groups.length).toBe(2);
    });

    test('displays formatted values with correct decimals', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: { neck_angle: 5.256, string_length: 325.0 },
        });

        const content = section.getAccordion().getContentElement();
        const neckValue = content.querySelector('.output-value[data-value-name="neck_angle"]');
        const stringValue = content.querySelector('.output-value[data-value-name="string_length"]');

        expect(neckValue.textContent).toBe('5.26'); // 2 decimals
        expect(stringValue.textContent).toBe('325.0'); // 1 decimal
    });

    test('shows em dash for missing values', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const content = section.getAccordion().getContentElement();
        const neckValue = content.querySelector('.output-value[data-value-name="neck_angle"]');
        expect(neckValue.textContent).toBe('—');
    });

    test('shows em dash for null values', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: { neck_angle: null },
        });

        const content = section.getAccordion().getContentElement();
        const neckValue = content.querySelector('.output-value[data-value-name="neck_angle"]');
        expect(neckValue.textContent).toBe('—');
    });

    test('displays unit labels', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const content = section.getAccordion().getContentElement();
        const units = content.querySelectorAll('.output-unit');
        const unitTexts = [...units].map(u => u.textContent);
        expect(unitTexts).toContain('°');
        expect(unitTexts).toContain('mm');
    });

    test('displays value description when present', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        const content = section.getAccordion().getContentElement();
        const descs = content.querySelectorAll('.output-description');
        // neck_angle has a description, string_length does not
        expect(descs.length).toBe(1);
        expect(descs[0].textContent).toBe('Angle of the neck relative to the body');
    });

    test('warns and skips unknown parameter names', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const section = new OutputSection({
            sectionDef: makeSectionDef({ parameter_names: ['unknown_param'] }),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('unknown_param')
        );

        const groups = section.getAccordion().getContentElement()
            .querySelectorAll('.output-group');
        expect(groups.length).toBe(0);

        warnSpy.mockRestore();
    });

    // ---- updateValues ----

    test('updateValues refreshes displayed values', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: { neck_angle: 5.0, string_length: 300.0 },
        });

        // Append to DOM so querySelector works within accordion content
        document.body.appendChild(section.getElement());

        section.updateValues({ neck_angle: 7.89, string_length: 350.5 });

        const content = section.getAccordion().getContentElement();
        const neckValue = content.querySelector('.output-value[data-value-name="neck_angle"]');
        const stringValue = content.querySelector('.output-value[data-value-name="string_length"]');

        expect(neckValue.textContent).toBe('7.89');
        expect(stringValue.textContent).toBe('350.5');

        document.body.removeChild(section.getElement());
    });

    test('updateValues shows em dash when value becomes missing', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef(),
            derivedValues: makeDerivedValues(),
            calculatedValues: { neck_angle: 5.0, string_length: 300.0 },
        });

        document.body.appendChild(section.getElement());

        section.updateValues({});

        const content = section.getAccordion().getContentElement();
        const neckValue = content.querySelector('.output-value[data-value-name="neck_angle"]');
        expect(neckValue.textContent).toBe('—');

        document.body.removeChild(section.getElement());
    });

    // ---- Delegation to Accordion ----

    test('isExpanded reflects accordion state', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef({ default_expanded: true }),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });
        expect(section.isExpanded()).toBe(true);
    });

    test('setExpanded changes accordion state', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef({ default_expanded: true }),
            derivedValues: makeDerivedValues(),
            calculatedValues: {},
        });

        section.setExpanded(false);
        expect(section.isExpanded()).toBe(false);
    });

    test('formatValue defaults to 2 decimals when not specified', () => {
        const section = new OutputSection({
            sectionDef: makeSectionDef({ parameter_names: ['custom'] }),
            derivedValues: {
                custom: { display_name: 'Custom', unit: 'mm' },
            },
            calculatedValues: { custom: 3.14159 },
        });

        const content = section.getAccordion().getContentElement();
        const value = content.querySelector('.output-value[data-value-name="custom"]');
        expect(value.textContent).toBe('3.14'); // default 2 decimals
    });
});
