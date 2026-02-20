// @ts-check
import { test, expect } from '@playwright/test';

// Characterization tests for app.js core flows.
// Verify user-visible behavior at the boundary (not internals)
// to serve as a safety net before any future refactoring.
//
// Pyodide takes ~10-30s to load on first run.

const PYODIDE_TIMEOUT = 120000;

/**
 * Wait for Pyodide to finish loading and the first generation to complete.
 * Checks that: (1) status bar has "ready" class, (2) SVG exists in preview.
 */
async function waitForReady(page) {
    await page.waitForFunction(
        () => {
            const status = document.getElementById('status');
            const svg = document.querySelector('#preview-container svg');
            return status && status.className.includes('ready') && svg;
        },
        { timeout: PYODIDE_TIMEOUT }
    );
}

test.describe('Core Generation Flow', () => {
    test.setTimeout(PYODIDE_TIMEOUT);

    test('Pyodide loads and generates initial preview', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        await expect(page.locator('#status')).toHaveClass(/ready/);
        const svgCount = await page.locator('#preview-container svg').count();
        expect(svgCount).toBeGreaterThanOrEqual(1);
    });

    test('parameter change triggers regeneration', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        // Change vsl (vibrating string length) — a core numeric input
        const vslInput = page.locator('#vsl');
        if (await vslInput.isVisible()) {
            await vslInput.fill('340');
            await vslInput.dispatchEvent('input');

            await waitForReady(page);

            const svgCount = await page.locator('#preview-container svg').count();
            expect(svgCount).toBeGreaterThanOrEqual(1);
        }
    });

    test('switching instrument family regenerates', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        const familySelect = page.locator('#instrument_family');
        if (await familySelect.isVisible()) {
            await familySelect.selectOption('VIOL');

            await waitForReady(page);

            const svgCount = await page.locator('#preview-container svg').count();
            expect(svgCount).toBeGreaterThanOrEqual(1);

            // Fret positions tab should be enabled for Viol
            const fretTab = page.locator('.view-tab[data-view="fret_positions"]');
            await expect(fretTab).not.toBeDisabled();
        }
    });
});

test.describe('View Switching', () => {
    test.setTimeout(PYODIDE_TIMEOUT);

    test('switching to dimensions view shows a table', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        const dimTab = page.locator('.view-tab[data-view="dimensions"]');
        await dimTab.click();
        await expect(dimTab).toHaveClass(/active/, { timeout: 5000 });

        await expect(page.locator('#preview-container .dimensions-table')).toBeAttached({ timeout: 5000 });
    });

    test('switching back to side view restores SVG', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        // Go to dimensions
        await page.locator('.view-tab[data-view="dimensions"]').click();
        await expect(page.locator('.view-tab[data-view="dimensions"]')).toHaveClass(/active/, { timeout: 5000 });

        // Back to side
        const sideTab = page.locator('.view-tab[data-view="side"]');
        await sideTab.click();
        await expect(sideTab).toHaveClass(/active/, { timeout: 5000 });

        const svgCount = await page.locator('#preview-container svg').count();
        expect(svgCount).toBeGreaterThanOrEqual(1);
    });
});

test.describe('Derived Values', () => {
    test.setTimeout(PYODIDE_TIMEOUT);

    test('UI generates accordion sections after Pyodide loads', async ({ page }) => {
        await page.goto('/');
        await waitForReady(page);

        // The parameters container should have accordion sections
        const accordionCount = await page.locator('.accordion-section').count();
        expect(accordionCount).toBeGreaterThan(0);
    });
});
