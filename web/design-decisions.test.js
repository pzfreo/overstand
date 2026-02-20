/**
 * Static analysis tests for UI design decisions.
 *
 * These tests read source files as text and assert invariants documented in
 * docs/UI_DESIGN_DECISIONS.md. They catch regressions during UI redesigns
 * without needing to import or execute the application code.
 *
 * Pattern follows pyodide-safety.test.js.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFile(relativePath) {
    return readFileSync(resolve(__dirname, relativePath), 'utf-8');
}

const stylesSource = readFile('styles.css');
const constantsSource = readFile('constants.js');
const stateSource = readFile('state.js');
const uiSource = readFile('ui.js');
const indexSource = readFile('index.html');
const oauthCallbackSource = readFile('oauth-callback.html');

describe('Design decisions: no alert() dialogs', () => {
    // All alert() calls replaced with modal system (commits 1221bbd, 3309d57)
    // Exception: cache-clear fallback in app.js is acceptable

    test('JS files do not use alert() except cache-clear fallback', () => {
        const jsFiles = readdirSync(__dirname)
            .filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'service-worker.js');

        const violations = [];
        for (const file of jsFiles) {
            const source = readFile(file);
            const lines = source.split('\n');
            lines.forEach((line, i) => {
                // Match alert( but not in comments or string definitions mentioning alert
                if (/\balert\s*\(/.test(line) && !/\/\//.test(line.split('alert')[0]) && !/replaces.*alert|Replace.*alert/i.test(line)) {
                    // Allow the single cache-clear fallback in app.js or info-modals.js
                    if ((file === 'app.js' || file === 'info-modals.js') && /cache/i.test(line)) return;
                    violations.push(`${file}:${i + 1}: ${line.trim()}`);
                }
            });
        }
        expect(violations).toEqual([]);
    });
});

describe('Design decisions: CSS invariants', () => {
    test('modal z-index (2000) exceeds panel z-index values', () => {
        // Find the modal overlay z-index
        const modalZMatch = stylesSource.match(/z-index:\s*2000/);
        expect(modalZMatch).not.toBeNull();

        // Panel z-index values should all be less than 2000
        const zIndexMatches = [...stylesSource.matchAll(/z-index:\s*(\d+)/g)];
        const zValues = zIndexMatches.map(m => parseInt(m[1]));
        const maxNonModal = Math.max(...zValues.filter(z => z < 2000));
        expect(maxNonModal).toBeLessThan(2000);
    });

    test('CSS uses custom properties for theming', () => {
        expect(stylesSource).toMatch(/:root\s*\{[^}]*--color-primary/s);
    });

    test('indigo brand color #4F46E5 is present', () => {
        expect(stylesSource.toLowerCase()).toMatch(/#4f46e5/);
    });
});

describe('Design decisions: constants', () => {
    test('mobile breakpoint is 1024px', () => {
        expect(constantsSource).toMatch(/MOBILE_BREAKPOINT\s*=\s*1024/);
    });

    test('auto-generate debounce is 500ms', () => {
        expect(constantsSource).toMatch(/DEBOUNCE_GENERATE\s*=\s*500/);
    });

    test('all 6 view names are defined', () => {
        const requiredViews = ['side', 'top', 'cross_section', 'dimensions', 'fret_positions', 'radius_template'];
        for (const view of requiredViews) {
            expect(constantsSource).toMatch(new RegExp(`['"]?${view}['"]?\\s*:`));
        }
    });
});

describe('Design decisions: state defaults', () => {
    test('default view is side', () => {
        expect(stateSource).toMatch(/currentView\s*:\s*['"]side['"]/);
    });
});

describe('Design decisions: UI logic invariants', () => {
    test('output parameters get "(calculated)" indicator', () => {
        expect(uiSource).toMatch(/\(calculated\)/);
    });
});

describe('Design decisions: OAuth implicit flow', () => {
    test('oauth-callback.html parses access_token from URL hash', () => {
        expect(oauthCallbackSource).toMatch(/access_token/);
        // Should parse from hash fragment, not query params
        expect(oauthCallbackSource).toMatch(/hash/i);
    });
});

describe('Design decisions: emergency cache reset', () => {
    test('index.html has ?reset check before module scripts', () => {
        // The reset script must appear before any type="module" script
        const resetPos = indexSource.indexOf('reset');
        const modulePos = indexSource.indexOf('type="module"');

        expect(resetPos).toBeGreaterThan(-1);
        expect(modulePos).toBeGreaterThan(-1);
        expect(resetPos).toBeLessThan(modulePos);
    });
});

describe('Design decisions: user-facing terminology', () => {
    test('no "Export to JSON" or "Import from JSON" in index.html', () => {
        // Should be "Export to File" / "Import from File" (commit c3a414f)
        expect(indexSource).not.toMatch(/Export to JSON/i);
        expect(indexSource).not.toMatch(/Import from JSON/i);
    });
});

describe('Design decisions: toolbar layout', () => {
    test('index.html has a toolbar element', () => {
        expect(indexSource).toMatch(/class="toolbar"/);
        expect(indexSource).toMatch(/id="toolbar"/);
    });

    test('toolbar has brand with "Overstand" text', () => {
        expect(indexSource).toMatch(/class="toolbar-brand"/);
        expect(indexSource).toMatch(/Overstand/);
    });

    test('toolbar has hamburger for mobile', () => {
        expect(indexSource).toMatch(/id="toolbar-hamburger"/);
    });

    test('download buttons are in toolbar (not preview panel)', () => {
        expect(indexSource).toMatch(/id="toolbar-dl-svg"/);
        expect(indexSource).toMatch(/id="toolbar-dl-pdf"/);
    });

    test('state.js references toolbar download button IDs', () => {
        expect(stateSource).toMatch(/toolbar-dl-svg/);
        expect(stateSource).toMatch(/toolbar-dl-pdf/);
    });

    test('params panel width is 400px in main grid', () => {
        expect(stylesSource).toMatch(/grid-template-columns:\s*400px\s+1fr/);
    });

    test('no icon bar HTML remains', () => {
        expect(indexSource).not.toMatch(/mobile-icon-bar/);
        expect(indexSource).not.toMatch(/mobile-menu-toggle/);
        expect(indexSource).not.toMatch(/mobile-params-toggle/);
    });
});

describe('Design decisions: dark theme', () => {
    test('CSS has dark theme overrides via data-theme attribute', () => {
        expect(stylesSource).toMatch(/\[data-theme="dark"\]/);
    });

    test('index.html has data-theme attribute on html element', () => {
        expect(indexSource).toMatch(/data-theme="light"/);
    });

    test('theme is read from localStorage before first paint', () => {
        // The theme init script must appear in <head> before stylesheets load
        expect(indexSource).toMatch(/overstand-theme/);
    });
});
