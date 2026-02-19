// @ts-check
import { test, expect } from '@playwright/test';

// These tests validate UI design decisions documented in docs/UI_DESIGN_DECISIONS.md.
// They test the static HTML/CSS structure and interactivity without requiring Pyodide.
// The app.js module loads and initializes (menu setup, auth UI) but Pyodide loading
// happens asynchronously and is not needed for these structural tests.

test.describe('Page Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('title is "Overstand"', async ({ page }) => {
    await expect(page).toHaveTitle('Overstand');
  });

  test('toolbar with brand is visible', async ({ page }) => {
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('.toolbar-brand')).toContainText('Overstand');
  });

  test('toolbar has Sign In button', async ({ page }) => {
    const authBtn = page.locator('#toolbar-auth');
    await expect(authBtn).toBeVisible();
    await expect(authBtn).toHaveText('Sign In');
  });

  test('controls panel and preview panel exist', async ({ page }) => {
    await expect(page.locator('.controls-panel')).toBeAttached();
    await expect(page.locator('.preview-panel')).toBeAttached();
  });

  test('footer has Privacy Policy and Terms links', async ({ page }) => {
    const footer = page.locator('footer.app-footer');
    await expect(footer.locator('a[href="privacy.html"]')).toHaveText('Privacy Policy');
    await expect(footer.locator('a[href="terms.html"]')).toHaveText('Terms of Service');
  });
});

test.describe('View Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Side View tab is active by default', async ({ page }) => {
    const sideTab = page.locator('.view-tab[data-view="side"]');
    await expect(sideTab).toHaveClass(/active/);
  });

  test('all 6 view tabs are present', async ({ page }) => {
    const tabs = page.locator('.view-tab');
    await expect(tabs).toHaveCount(6);

    const expectedViews = ['side', 'top', 'cross_section', 'dimensions', 'fret_positions', 'radius_template'];
    for (const view of expectedViews) {
      await expect(page.locator(`.view-tab[data-view="${view}"]`)).toBeAttached();
    }
  });

  test('Top View tab is disabled with "Coming Soon"', async ({ page }) => {
    const topTab = page.locator('.view-tab[data-view="top"]');
    await expect(topTab).toBeDisabled();
    await expect(topTab).toContainText('Coming Soon');
  });
});

test.describe('Menu System', () => {
  // The toolbar has a Menu button that opens the slide-in menu panel.
  // Menu panel uses 'open' class, not 'active'.

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar menu button is visible', async ({ page }) => {
    await expect(page.locator('#toolbar-menu')).toBeVisible();
  });

  test('clicking menu button opens menu panel', async ({ page }) => {
    const menuPanel = page.locator('#menu-panel');
    await expect(menuPanel).not.toHaveClass(/open/);

    await page.locator('#toolbar-menu').click();
    await expect(menuPanel).toHaveClass(/open/);
  });

  test('menu has correct sections', async ({ page }) => {
    await page.locator('#toolbar-menu').click();

    const sectionTitles = page.locator('.menu-section-title');
    const titles = await sectionTitles.allTextContents();
    expect(titles).toEqual(['Account', 'Help', 'Troubleshooting', 'Links']);
  });

  test('toolbar uses "Import" / "Export" terminology', async ({ page }) => {
    await expect(page.locator('#toolbar-import')).toHaveAttribute('title', 'Import from File');
    await expect(page.locator('#toolbar-export')).toHaveAttribute('title', 'Export to File');
  });

  test('close button closes menu', async ({ page }) => {
    await page.locator('#toolbar-menu').click();
    await expect(page.locator('#menu-panel')).toHaveClass(/open/);

    await page.locator('#menu-close-btn').click();
    await expect(page.locator('#menu-panel')).not.toHaveClass(/open/);
  });

  test('Escape key closes menu', async ({ page }) => {
    await page.locator('#toolbar-menu').click();
    await expect(page.locator('#menu-panel')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-panel')).not.toHaveClass(/open/);
  });
});

test.describe('Modal System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('modal overlay is hidden by default', async ({ page }) => {
    const modal = page.locator('#modal-overlay');
    await expect(modal).not.toHaveClass(/active/);
  });

  test('modal z-index is 2000', async ({ page }) => {
    const zIndex = await page.locator('#modal-overlay').evaluate(
      el => getComputedStyle(el).zIndex
    );
    expect(zIndex).toBe('2000');
  });

  test('modal is outside .app-container', async ({ page }) => {
    const isInsideAppContainer = await page.locator('#modal-overlay').evaluate(
      el => !!el.closest('.app-container')
    );
    expect(isInsideAppContainer).toBe(false);
  });
});

test.describe('Toolbar Responsiveness', () => {
  test('toolbar visible at mobile width (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('toolbar visible at desktop width (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('hamburger visible on mobile, hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('#toolbar-hamburger')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#toolbar-hamburger')).not.toBeVisible();
  });

  test('toolbar actions visible on desktop, hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('#toolbar-actions')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#toolbar-actions')).not.toBeVisible();
  });
});

test.describe('CSS Design Decisions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('indigo brand color #4F46E5 in theme-color meta tag', async ({ page }) => {
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#4F46E5');
  });

  test('CSS custom properties defined in :root', async ({ page }) => {
    const hasCustomProps = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      // Check that key CSS custom properties resolve to non-empty values
      const primary = styles.getPropertyValue('--color-primary');
      return primary.trim().length > 0;
    });
    expect(hasCustomProps).toBe(true);
  });

  test('sidebar overlay has no backdrop-filter', async ({ page }) => {
    // Design decision: no backdrop-filter on sidebar overlay (breaks Firefox/Android)
    const backdropFilter = await page.locator('.sidebar-overlay').evaluate(
      el => getComputedStyle(el).backdropFilter
    );
    expect(backdropFilter === 'none' || backdropFilter === '').toBe(true);
  });
});

test.describe('Zoom and Download Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('zoom in/out/reset buttons present', async ({ page }) => {
    await expect(page.locator('#zoom-in')).toBeAttached();
    await expect(page.locator('#zoom-out')).toBeAttached();
    await expect(page.locator('#zoom-reset')).toBeAttached();
  });

  test('download buttons (SVG, PDF) present in toolbar', async ({ page }) => {
    await expect(page.locator('#toolbar-dl-svg')).toBeAttached();
    await expect(page.locator('#toolbar-dl-pdf')).toBeAttached();
  });
});

test.describe('Params Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
  });

  test('params panel has header with collapse button', async ({ page }) => {
    await expect(page.locator('.params-header h2')).toHaveText('Parameters');
    await expect(page.locator('#params-collapse-btn')).toBeAttached();
  });
});
