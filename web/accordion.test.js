/**
 * Tests for the Accordion component.
 *
 * Validates accessibility, keyboard support, localStorage persistence, and
 * expand/collapse behavior documented in docs/UI_DESIGN_DECISIONS.md.
 */

import { Accordion } from './components/accordion.js';

beforeEach(() => {
    localStorage.clear();
});

describe('Accordion: default state', () => {
    test('expanded by default when no config or localStorage', () => {
        const acc = new Accordion({ id: 'test', title: 'Test' });
        expect(acc.isExpanded()).toBe(true);
    });

    test('respects expanded: true config', () => {
        const acc = new Accordion({ id: 'test', title: 'Test', expanded: true });
        expect(acc.isExpanded()).toBe(true);
        expect(acc.getContentElement().style.display).toBe('block');
    });

    test('respects expanded: false config', () => {
        const acc = new Accordion({ id: 'test', title: 'Test', expanded: false });
        expect(acc.isExpanded()).toBe(false);
        expect(acc.getContentElement().style.display).toBe('none');
    });
});

describe('Accordion: localStorage persistence', () => {
    test('localStorage overrides expanded: true config', () => {
        localStorage.setItem('section-test-expanded', 'false');
        const acc = new Accordion({ id: 'test', title: 'Test', expanded: true });
        expect(acc.isExpanded()).toBe(false);
    });

    test('localStorage overrides expanded: false config', () => {
        localStorage.setItem('section-test-expanded', 'true');
        const acc = new Accordion({ id: 'test', title: 'Test', expanded: false });
        expect(acc.isExpanded()).toBe(true);
    });

    test('toggle() saves state to localStorage', () => {
        const acc = new Accordion({ id: 'persist', title: 'Test', expanded: true });
        acc.toggle();
        expect(localStorage.getItem('section-persist-expanded')).toBe('false');
        acc.toggle();
        expect(localStorage.getItem('section-persist-expanded')).toBe('true');
    });

    test('setExpanded() saves state to localStorage', () => {
        const acc = new Accordion({ id: 'persist2', title: 'Test', expanded: true });
        acc.setExpanded(false);
        expect(localStorage.getItem('section-persist2-expanded')).toBe('false');
    });
});

describe('Accordion: ARIA accessibility', () => {
    test('header has role="button"', () => {
        const acc = new Accordion({ id: 'aria', title: 'Test' });
        const header = acc.getElement().querySelector('.accordion-header');
        expect(header.getAttribute('role')).toBe('button');
    });

    test('header has tabindex="0"', () => {
        const acc = new Accordion({ id: 'aria', title: 'Test' });
        const header = acc.getElement().querySelector('.accordion-header');
        expect(header.getAttribute('tabindex')).toBe('0');
    });

    test('header aria-expanded matches state', () => {
        const acc = new Accordion({ id: 'aria', title: 'Test', expanded: true });
        const header = acc.getElement().querySelector('.accordion-header');
        expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    test('aria-expanded updates on toggle', () => {
        const acc = new Accordion({ id: 'aria', title: 'Test', expanded: true });
        const header = acc.getElement().querySelector('.accordion-header');
        acc.toggle();
        expect(header.getAttribute('aria-expanded')).toBe('false');
        acc.toggle();
        expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    test('content region has role="region"', () => {
        const acc = new Accordion({ id: 'aria', title: 'Test' });
        const content = acc.getContentElement();
        expect(content.getAttribute('role')).toBe('region');
    });
});

describe('Accordion: keyboard support', () => {
    test('Enter key triggers toggle', () => {
        const acc = new Accordion({ id: 'kbd', title: 'Test', expanded: true });
        const header = acc.getElement().querySelector('.accordion-header');

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        header.dispatchEvent(event);

        expect(acc.isExpanded()).toBe(false);
    });

    test('Space key triggers toggle', () => {
        const acc = new Accordion({ id: 'kbd', title: 'Test', expanded: true });
        const header = acc.getElement().querySelector('.accordion-header');

        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        header.dispatchEvent(event);

        expect(acc.isExpanded()).toBe(false);
    });

    test('other keys do not trigger toggle', () => {
        const acc = new Accordion({ id: 'kbd', title: 'Test', expanded: true });
        const header = acc.getElement().querySelector('.accordion-header');

        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        header.dispatchEvent(event);

        expect(acc.isExpanded()).toBe(true);
    });
});

describe('Accordion: chevron indicator', () => {
    test('shows down arrow when expanded', () => {
        const acc = new Accordion({ id: 'chev', title: 'Test', expanded: true });
        const chevron = acc.getElement().querySelector('.accordion-chevron');
        expect(chevron.textContent).toBe('▼');
    });

    test('shows right arrow when collapsed', () => {
        const acc = new Accordion({ id: 'chev', title: 'Test', expanded: false });
        const chevron = acc.getElement().querySelector('.accordion-chevron');
        expect(chevron.textContent).toBe('▶');
    });

    test('chevron updates on toggle', () => {
        const acc = new Accordion({ id: 'chev', title: 'Test', expanded: true });
        const chevron = acc.getElement().querySelector('.accordion-chevron');
        acc.toggle();
        expect(chevron.textContent).toBe('▶');
        acc.toggle();
        expect(chevron.textContent).toBe('▼');
    });
});

describe('Accordion: onToggle callback', () => {
    test('fires with correct boolean on toggle', () => {
        const calls = [];
        const acc = new Accordion({
            id: 'cb',
            title: 'Test',
            expanded: true,
            onToggle: (val) => calls.push(val)
        });
        acc.toggle();
        expect(calls).toEqual([false]);
        acc.toggle();
        expect(calls).toEqual([false, true]);
    });

    test('setExpanded is no-op when state already matches', () => {
        const calls = [];
        const acc = new Accordion({
            id: 'noop',
            title: 'Test',
            expanded: true,
            onToggle: (val) => calls.push(val)
        });
        acc.setExpanded(true);
        expect(calls).toEqual([]);
    });

    test('setExpanded fires callback when state changes', () => {
        const calls = [];
        const acc = new Accordion({
            id: 'change',
            title: 'Test',
            expanded: true,
            onToggle: (val) => calls.push(val)
        });
        acc.setExpanded(false);
        expect(calls).toEqual([false]);
    });
});
