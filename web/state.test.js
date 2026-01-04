/**
 * Tests for state.js - Global state management
 */

import { state, elements, initElements } from './state.js';

describe('state', () => {
  describe('initial state', () => {
    test('state object exists', () => {
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
    });

    test('pyodide is initially null', () => {
      expect(state.pyodide).toBeNull();
    });

    test('isGenerating is initially false', () => {
      expect(state.isGenerating).toBe(false);
    });

    test('views is initially null', () => {
      expect(state.views).toBeNull();
    });

    test('currentView defaults to side', () => {
      expect(state.currentView).toBe('side');
    });

    test('svgCanvas is initially null', () => {
      expect(state.svgCanvas).toBeNull();
    });

    test('parameterDefinitions is initially null', () => {
      expect(state.parameterDefinitions).toBeNull();
    });

    test('presets is initially null', () => {
      expect(state.presets).toBeNull();
    });

    test('parametersModified is initially false', () => {
      expect(state.parametersModified).toBe(false);
    });
  });

  describe('state properties', () => {
    test('state has all expected properties', () => {
      const expectedProps = [
        'pyodide',
        'isGenerating',
        'views',
        'currentView',
        'svgCanvas',
        'initialViewBox',
        'parameterDefinitions',
        'presets',
        'derivedValues',
        'derivedMetadata',
        'derivedFormatted',
        'parametersModified'
      ];

      expectedProps.forEach(prop => {
        expect(state).toHaveProperty(prop);
      });
    });

    test('state is mutable', () => {
      const originalValue = state.isGenerating;
      state.isGenerating = true;
      expect(state.isGenerating).toBe(true);
      // Reset
      state.isGenerating = originalValue;
    });
  });

  describe('window.state', () => {
    test('state is available on window object', () => {
      expect(window.state).toBeDefined();
      expect(window.state).toBe(state);
    });
  });
});

describe('elements', () => {
  test('elements object exists', () => {
    expect(elements).toBeDefined();
    expect(typeof elements).toBe('object');
  });

  test('elements is initially empty', () => {
    expect(Object.keys(elements).length).toBe(0);
  });
});

describe('initElements', () => {
  test('initElements is a function', () => {
    expect(typeof initElements).toBe('function');
  });

  test('initElements populates elements object', () => {
    initElements();

    expect(elements.status).toBeDefined();
    expect(elements.statusText).toBeDefined();
    expect(elements.genBtn).toBeDefined();
    expect(elements.preview).toBeDefined();
  });

  test('initElements references correct DOM elements', () => {
    initElements();

    expect(elements.status).toBe(document.getElementById('status'));
    expect(elements.genBtn).toBe(document.getElementById('gen-btn'));
    expect(elements.preview).toBe(document.getElementById('preview-container'));
  });

  test('initElements populates all expected element references', () => {
    initElements();

    const expectedElements = [
      'status',
      'statusText',
      'genBtn',
      'preview',
      'errorPanel',
      'errorList',
      'parametersContainer',
      'presetSelect',
      'viewTabs',
      'zoomControls',
      'dlSvg',
      'dlPdf',
      'calculatedFields',
      'saveParamsBtn',
      'loadParamsBtn',
      'loadParamsInput',
      'zoomInBtn',
      'zoomOutBtn',
      'zoomResetBtn'
    ];

    expectedElements.forEach(elem => {
      expect(elements).toHaveProperty(elem);
    });
  });
});
