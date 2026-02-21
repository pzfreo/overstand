/**
 * Scans source files for potential hardcoded secrets.
 *
 * Python files (src/*.py) are copied to public/ during the build, and
 * JavaScript files (web/*.js) are served directly — so any secrets in
 * them are exposed to end users. This test catches common secret
 * patterns before they ship.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', 'src');
const webDir = __dirname;

const pyFiles = readdirSync(srcDir)
    .filter(f => f.endsWith('.py'))
    .map(f => ({ name: `src/${f}`, content: readFileSync(resolve(srcDir, f), 'utf-8') }));

// Exclude test files and the example config (which has intentional placeholders)
const jsFiles = readdirSync(webDir)
    .filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'config.example.js')
    .map(f => ({ name: `web/${f}`, content: readFileSync(resolve(webDir, f), 'utf-8') }));

// Patterns that suggest hardcoded secrets.
// Each entry: [regex, description]
const SECRET_PATTERNS = [
    [/(?:api[_-]?key|apikey)\s*=\s*["'][^"']{8,}/i, 'API key assignment'],
    [/(?:secret|token)\s*=\s*["'][^"']{8,}/i, 'secret/token assignment'],
    [/(?:password|passwd|pwd)\s*=\s*["'][^"']{4,}/i, 'password assignment'],
    [/(?:supabase_url|supabase_key|supabase_anon)\s*=\s*["']/i, 'Supabase credential'],
    [/(?:aws_access_key|aws_secret)\s*=\s*["']/i, 'AWS credential'],
    [/(?:private[_-]?key)\s*=\s*["']/i, 'private key assignment'],
    [/(?:connection[_-]?string|database[_-]?url|db[_-]?url)\s*=\s*["'][^"']{8,}/i, 'database connection string'],
    [/Bearer\s+[A-Za-z0-9\-._~+/]{20,}/i, 'Bearer token'],
    [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, 'PEM private key'],
    [/ghp_[A-Za-z0-9]{36}/, 'GitHub personal access token'],
    [/sk-[A-Za-z0-9]{20,}/, 'OpenAI/Stripe secret key'],
    [/eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}/, 'JWT token'],
];

function isComment(line, lang) {
    const trimmed = line.trim();
    if (lang === 'py') return trimmed.startsWith('#');
    // JS single-line comments and lines inside JSDoc/block comments
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function scanFiles(files, lang) {
    const violations = [];

    for (const { name, content } of files) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isComment(line, lang)) continue;

            for (const [pattern, description] of SECRET_PATTERNS) {
                if (pattern.test(line)) {
                    violations.push(`${name}:${i + 1}: ${description} — ${line.trim()}`);
                }
            }
        }
    }

    return violations;
}

describe('Source secret scanner', () => {

    test('no hardcoded secrets in src/*.py files', () => {
        const violations = scanFiles(pyFiles, 'py');
        if (violations.length > 0) {
            throw new Error(
                'Potential secrets found in Python source files (served to the browser):\n' +
                violations.map(v => `  ${v}`).join('\n')
            );
        }
    });

    test('no hardcoded secrets in web/*.js files', () => {
        const violations = scanFiles(jsFiles, 'js');
        if (violations.length > 0) {
            throw new Error(
                'Potential secrets found in JavaScript source files (served to the browser):\n' +
                violations.map(v => `  ${v}`).join('\n')
            );
        }
    });

    test('scanner covers all source files', () => {
        expect(pyFiles.length).toBeGreaterThan(0);
        expect(jsFiles.length).toBeGreaterThan(0);
    });
});
