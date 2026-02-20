/**
 * Tests to prevent Pyodide code injection vulnerabilities.
 *
 * The app passes user-controlled JSON to Python via Pyodide's runPythonAsync.
 * Interpolating strings directly into Python code (e.g. via template literals)
 * is unsafe -- crafted input could escape the string and execute arbitrary Python.
 *
 * The safe approach is pyodide.globals.set() to pass data as a variable,
 * then reference that variable in the Python code.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(__dirname, 'app.js'), 'utf-8');
const generationSource = readFileSync(resolve(__dirname, 'generation.js'), 'utf-8');

describe('Pyodide injection safety', () => {

  test('no string interpolation inside runPythonAsync calls', () => {
    // Match template literal interpolation (${...}) inside runPythonAsync blocks.
    // This pattern catches both direct variable interpolation and .replace() escaping.
    // Check all files that call runPythonAsync
    const combinedSource = appSource + '\n' + generationSource;
    const lines = combinedSource.split('\n');
    const violations = [];

    let insideRunPython = false;
    let blockStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('runPythonAsync(`') || line.includes('runPythonAsync(`')) {
        insideRunPython = true;
        blockStart = i + 1;
      }

      if (insideRunPython && line.includes('${')) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }

      // End of template literal inside runPythonAsync
      if (insideRunPython && line.includes('`)')) {
        insideRunPython = false;
      }
    }

    expect(violations).toEqual([]);
  });

  test('user data is passed via globals.set() before runPythonAsync', () => {
    // Verify the safe pattern: globals.set() followed by runPythonAsync
    // referencing the global variable (not string interpolation)
    // This pattern is now in generation.js after refactoring
    const combinedSource = appSource + '\n' + generationSource;
    const generateNeckMatch = combinedSource.includes('globals.set("_params_json", paramsJson)');
    expect(generateNeckMatch).toBe(true);
  });

  test('no .replace() used to escape strings for Python execution', () => {
    // The old vulnerable pattern was: paramsJson.replace(/'/g, "\\'")
    // This should never appear near runPythonAsync calls
    const combinedSource = appSource + '\n' + generationSource;
    const dangerousPattern = /paramsJson\.replace\(.*runPythonAsync|runPythonAsync[^)]*paramsJson\.replace/s;
    expect(dangerousPattern.test(combinedSource)).toBe(false);
  });

  test('runPythonAsync calls with static strings are safe', () => {
    // Static strings (no interpolation) are safe -- just verify they exist
    // These are the init-time calls that don't take user input
    const staticCalls = [
      'instrument_generator.get_parameter_definitions()',
      'instrument_generator.get_derived_value_metadata()',
      'instrument_generator.get_ui_metadata()'
    ];

    staticCalls.forEach(call => {
      expect(appSource).toContain(call);
    });
  });
});
