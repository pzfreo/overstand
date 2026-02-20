/**
 * Guard test to prevent reintroduction of native browser dialogs.
 *
 * Native confirm(), prompt(), and alert() block the JS event loop,
 * look inconsistent with the styled modal system, and can't be themed.
 * All dialogs should use the async modal equivalents from modal.js:
 *   showConfirmModal(), showPromptModal(), showErrorModal(), showInfoModal()
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scan all .js files in web/ (excluding test files and node_modules)
const jsFiles = readdirSync(__dirname)
    .filter(f => f.endsWith('.js') && !f.includes('.test.') && !f.includes('node_modules'));

describe('No native browser dialogs', () => {
    // Match confirm(, prompt(, alert( that are actual function calls,
    // not inside comments or strings like 'showConfirmModal'
    const nativeDialogPattern = /(?<![.\w])(confirm|prompt|alert)\s*\(/;

    for (const file of jsFiles) {
        test(`${file} does not use native confirm/prompt/alert`, () => {
            const source = readFileSync(resolve(__dirname, file), 'utf-8');
            const lines = source.split('\n');
            const violations = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip comment lines
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
                // Skip lines that are part of our modal API (showConfirmModal, showPromptModal, etc.)
                if (line.includes('showConfirmModal') || line.includes('showPromptModal') ||
                    line.includes('showErrorModal') || line.includes('showInfoModal')) continue;

                if (nativeDialogPattern.test(line)) {
                    violations.push(`${file}:${i + 1}: ${line.trim()}`);
                }
            }

            expect(violations).toEqual([]);
        });
    }
});
