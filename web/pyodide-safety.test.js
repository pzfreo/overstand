// @vitest-environment node
/**
 * Tests to verify the TypeScript engine cutover is complete and no unsafe
 * Pyodide patterns remain in the web app source.
 *
 * After the cutover from Pyodide to the TypeScript geometry engine:
 * - No runPythonAsync calls should exist
 * - No loadPyodide calls should exist
 * - No string interpolation into eval-like calls
 * - The TS engine import should be present in generation.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(__dirname, 'app.js'), 'utf-8');
const generationSource = readFileSync(resolve(__dirname, 'generation.js'), 'utf-8');

describe('TypeScript engine cutover safety', () => {

  test('no runPythonAsync calls exist in app.js or generation.js', () => {
    const combinedSource = appSource + '\n' + generationSource;
    expect(combinedSource).not.toContain('runPythonAsync');
  });

  test('no loadPyodide calls exist in app.js or generation.js', () => {
    const combinedSource = appSource + '\n' + generationSource;
    expect(combinedSource).not.toContain('loadPyodide');
  });

  test('no pyodide.globals.set calls exist in app.js or generation.js', () => {
    const combinedSource = appSource + '\n' + generationSource;
    expect(combinedSource).not.toContain('globals.set');
  });

  test('generation.js imports from the TypeScript engine bundle', () => {
    expect(generationSource).toContain("from '/dist/instrument_generator.js'");
  });

  test('generation.js uses generateViolinNeck from TS engine', () => {
    expect(generationSource).toContain('generateViolinNeck(paramsJson)');
  });

  test('generation.js uses getDerivedValues from TS engine', () => {
    expect(generationSource).toContain('getDerivedValues(paramsJson)');
  });

  test('app.js imports metadata functions from the TypeScript engine bundle', () => {
    expect(appSource).toContain("from '/dist/instrument_generator.js'");
  });

  test('app.js uses getParameterDefinitions from TS engine', () => {
    expect(appSource).toContain('getParameterDefinitions()');
  });

  test('app.js uses getDerivedValueMetadata from TS engine', () => {
    expect(appSource).toContain('getDerivedValueMetadata()');
  });

  test('app.js uses getUiMetadata from TS engine', () => {
    expect(appSource).toContain('getUiMetadata()');
  });

  test('no .replace() used to escape strings for code execution', () => {
    // The old vulnerable pattern was: paramsJson.replace(/'/g, "\\'")
    const combinedSource = appSource + '\n' + generationSource;
    const dangerousPattern = /paramsJson\.replace\(/;
    expect(dangerousPattern.test(combinedSource)).toBe(false);
  });
});
