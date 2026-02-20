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
  // The toolbar has a Menu button that opens a dropdown overlay.
  // Menu overlay uses 'open' class.

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar menu button is visible', async ({ page }) => {
    await expect(page.locator('#toolbar-menu')).toBeVisible();
  });

  test('clicking menu button opens menu dropdown', async ({ page }) => {
    const menuOverlay = page.locator('#app-menu-overlay');
    await expect(menuOverlay).not.toHaveClass(/open/);

    await page.locator('#toolbar-menu').click();
    await expect(menuOverlay).toHaveClass(/open/);
  });

  test('menu has key items visible on desktop', async ({ page }) => {
    await page.locator('#toolbar-menu').click();

    // Menu-only items always visible
    await expect(page.locator('#mm-shortcuts')).toBeVisible();
    await expect(page.locator('#mm-about')).toBeVisible();
    await expect(page.locator('#mm-cache')).toBeVisible();

    // Toolbar duplicates hidden on desktop (present in DOM but not visible)
    await expect(page.locator('#mm-load')).toBeAttached();
    await expect(page.locator('#mm-load')).not.toBeVisible();
  });

  test('toolbar uses "Import" / "Export" terminology', async ({ page }) => {
    await expect(page.locator('#toolbar-import')).toHaveAttribute('title', 'Import from File');
    await expect(page.locator('#toolbar-export')).toHaveAttribute('title', 'Export to File');
  });

  test('click outside closes menu', async ({ page }) => {
    await page.locator('#toolbar-menu').click();
    await expect(page.locator('#app-menu-overlay')).toHaveClass(/open/);

    // Click the overlay background (outside the menu)
    await page.locator('#app-menu-overlay').click({ position: { x: 10, y: 400 } });
    await expect(page.locator('#app-menu-overlay')).not.toHaveClass(/open/);
  });

  test('Escape key closes menu', async ({ page }) => {
    await page.locator('#toolbar-menu').click();
    await expect(page.locator('#app-menu-overlay')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#app-menu-overlay')).not.toHaveClass(/open/);
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

  test('modal z-index is above other overlays (2100)', async ({ page }) => {
    const zIndex = await page.locator('#modal-overlay').evaluate(
      el => getComputedStyle(el).zIndex
    );
    expect(zIndex).toBe('2100');
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

test.describe('Layout Constraints', () => {
  test('preview panel height fits within viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const box = await page.locator('.preview-panel').boundingBox();
    // Preview must fit within viewport (800px minus toolbar ~52px, status ~24px)
    expect(box.height).toBeLessThan(750);
    expect(box.height).toBeGreaterThan(200);
  });

  test('controls panel has scrollable params area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const overflow = await page.locator('.scrollable-params').evaluate(
      el => getComputedStyle(el).overflowY
    );
    expect(overflow).toBe('auto');
  });

  test('body overflow is hidden (no page scroll)', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.locator('body').evaluate(
      el => getComputedStyle(el).overflow
    );
    expect(overflow).toBe('hidden');
  });

  test('main container grid row fills available height', async ({ page }) => {
    await page.goto('/');
    const rows = await page.locator('.main-container').evaluate(
      el => getComputedStyle(el).gridTemplateRows
    );
    // 1fr resolves to an actual pixel value, so just check it's not 'auto' or 'none'
    expect(rows).not.toBe('auto');
    expect(rows).not.toBe('none');
  });

  test('preview panel height is independent of params content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/');
    const previewBox = await page.locator('.preview-panel').boundingBox();
    // Preview shouldn't be taller than the viewport
    expect(previewBox.height).toBeLessThan(580);
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

test.describe('Mobile Params Drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
  });

  test('"Edit Parameters" is first item in hamburger menu', async ({ page }) => {
    await page.click('#toolbar-hamburger');
    const firstButton = page.locator('#app-menu button.app-menu-item').first();
    await expect(firstButton).toHaveAttribute('id', 'mm-params');
    await expect(firstButton).toContainText('Edit Parameters');
  });

  test('"Sign In" is right after "Edit Parameters" in hamburger menu', async ({ page }) => {
    await page.click('#toolbar-hamburger');
    const buttons = page.locator('#app-menu button.app-menu-item');
    // mm-auth should be the second button (after mm-params)
    const secondButton = buttons.nth(1);
    await expect(secondButton).toHaveAttribute('id', 'mm-auth');
    await expect(secondButton).toContainText('Sign In');
  });

  test('menu uses dvh for max-height (Android nav bar safe)', async ({ page }) => {
    const menu = page.locator('#app-menu');
    const maxHeight = await menu.evaluate(el => getComputedStyle(el).maxHeight);
    // dvh should be resolved to a pixel value (not '100vh')
    expect(maxHeight).toMatch(/px$/);
  });

  test('mobile params drawer has close button and header', async ({ page }) => {
    const closeHeader = page.locator('#mobile-params-close');
    await expect(closeHeader).toBeAttached();
    await expect(closeHeader.locator('.close-label')).toHaveText('Edit Parameters');
    await expect(page.locator('#mobile-params-close-btn')).toBeAttached();
  });

  test('mobile params drawer opens and closes', async ({ page }) => {
    const controlsPanel = page.locator('#controls-panel');

    // Open via hamburger menu
    await page.click('#toolbar-hamburger');
    await page.click('#mm-params');
    await expect(controlsPanel).toHaveClass(/mobile-open/);

    // Close via ✕ button
    await page.click('#mobile-params-close-btn');
    await expect(controlsPanel).not.toHaveClass(/mobile-open/);
  });

  test('mobile params drawer is full-width', async ({ page }) => {
    await page.click('#toolbar-hamburger');
    await page.click('#mm-params');
    const panel = page.locator('#controls-panel');
    const box = await panel.boundingBox();
    // Full-width: should be at least 90% of viewport
    expect(box.width).toBeGreaterThanOrEqual(375 * 0.9);
  });

  test('mobile params drawer is scrollable', async ({ page }) => {
    await page.click('#toolbar-hamburger');
    await page.click('#mm-params');
    const panel = page.locator('#controls-panel');
    const overflow = await panel.evaluate(el => getComputedStyle(el).overflowY);
    expect(overflow).toBe('auto');
  });
});
