import { test, expect } from '@playwright/test';

/**
 * Azure Local Switch Configuration Wizard - E2E Tests
 * 
 * Tests for Odin-style UI redesign with:
 * - Single-page scroll layout with 7 numbered sections
 * - Sticky summary sidebar with own scrollbar
 * - Breadcrumb navigation
 * - Theme toggle (dark/light)
 * - Font size controls
 * 
 * TIMEOUT CONFIG: 30s per test, 3min global (playwright.config.ts)
 */

// ============================================================================
// TEST HELPERS
// ============================================================================

/** Complete Phase 1 (Pattern & Switch) quickly */
async function setupSwitch(page: any, options: {
  pattern?: string;
  vendor?: string;
  model?: string;
  role?: string;
} = {}) {
  const {
    pattern = 'fully_converged',
    vendor = 'dellemc',
    model = 's5248f-on',
    role = 'TOR1'
  } = options;
  
  // Select pattern
  await page.locator(`.pattern-card[data-pattern="${pattern}"] h4`).click();
  await page.waitForTimeout(100);
  
  // Select hardware
  await page.selectOption('#vendor-select', vendor);
  await page.selectOption('#model-select', model);
  
  // Select role
  await page.click(`.role-card[data-role="${role}"]`);
  await page.waitForTimeout(100);
}

/** Load a template quickly */
async function loadTemplate(page: any, pattern = 'Fully Converged', role = 'TOR1') {
  await page.click('button:has-text("Load")');
  await expect(page.locator('#template-modal')).toBeVisible();
  
  if (pattern === 'Fully Converged') {
    await page.click(`.template-card:has-text("${role}")`);
  } else {
    const section = page.locator(`.template-category:has-text("${pattern}") + .template-grid`);
    await section.locator(`.template-card:has-text("${role}")`).click();
  }
  await page.waitForTimeout(300);
}


// ============================================================================
// 1. PAGE LOAD & LAYOUT
// ============================================================================

test.describe('1. Page Load & Layout', () => {
  
  test('loads with header and title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Azure Local Switch Configuration/i);
    await expect(page.locator('h1')).toContainText('Azure Local');
  });

  test('displays navigation elements', async ({ page }) => {
    await page.goto('/');
    // Check for either breadcrumb nav or phase nav
    const hasBreadcrumb = await page.locator('.breadcrumb-nav').count() > 0;
    const hasPhaseNav = await page.locator('.nav-phase').count() > 0;
    expect(hasBreadcrumb || hasPhaseNav).toBeTruthy();
  });
});


// ============================================================================
// 2. NAVIGATION
// ============================================================================

test.describe('2. Navigation', () => {
  
  test('navigation items are clickable', async ({ page }) => {
    await page.goto('/');
    
    // Click second nav item
    const navItems = page.locator('.breadcrumb-item, .nav-phase');
    if (await navItems.count() > 1) {
      await navItems.nth(1).click();
      await page.waitForTimeout(300);
    }
  });

  test('phase 2 shows substeps', async ({ page }) => {
    await page.goto('/');
    await page.click('.nav-phase[data-phase="2"]');
    
    const phase2 = page.locator('.nav-phase[data-phase="2"]');
    await expect(phase2).toHaveClass(/active/);
    
    // Should have substeps
    const substeps = phase2.locator('.sub-step');
    expect(await substeps.count()).toBeGreaterThanOrEqual(2);
  });
});


// ============================================================================
// 3. PATTERN SELECTION
// ============================================================================

test.describe('3. Pattern Selection', () => {
  
  test('displays 3 pattern cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pattern-card')).toHaveCount(3);
    await expect(page.locator('.pattern-card[data-pattern="switchless"]')).toBeVisible();
    await expect(page.locator('.pattern-card[data-pattern="switched"]')).toBeVisible();
    await expect(page.locator('.pattern-card[data-pattern="fully_converged"]')).toBeVisible();
  });

  test('selecting pattern marks it as selected', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
    
    const selectedCard = page.locator('.pattern-card[data-pattern="fully_converged"]');
    await expect(selectedCard).toHaveClass(/selected/);
  });

  test('selecting pattern reveals hardware section', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pattern-card[data-pattern="switched"] h4').click();
    
    await expect(page.locator('#vendor-select')).toBeVisible();
  });
});


// ============================================================================
// 4. HARDWARE SELECTION
// ============================================================================

test.describe('4. Hardware Selection', () => {
  
  test('vendor dropdown populates model dropdown', async ({ page }) => {
    await page.goto('/');
    await page.click('.pattern-card[data-pattern="fully_converged"]');
    
    await expect(page.locator('#model-select')).toBeDisabled();
    await page.selectOption('#vendor-select', 'cisco');
    await expect(page.locator('#model-select')).not.toBeDisabled();
  });

  test('model selection reveals role section', async ({ page }) => {
    await page.goto('/');
    await page.click('.pattern-card[data-pattern="fully_converged"]');
    await page.selectOption('#vendor-select', 'dellemc');
    await page.selectOption('#model-select', 's5248f-on');
    
    await expect(page.locator('.role-card[data-role="TOR1"]')).toBeVisible();
  });

  test('role selection auto-generates hostname', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page);
    
    const hostname = page.locator('#hostname');
    await expect(hostname).toHaveValue(/tor1/i);
  });
});


// ============================================================================
// 5. SUMMARY SIDEBAR
// ============================================================================

test.describe('5. Summary Sidebar', () => {
  
  test('sidebar or summary panel exists', async ({ page }) => {
    await page.goto('/');
    const hasSidebar = await page.locator('#pattern-sidebar, #summary-panel, .summary-column').count() > 0;
    expect(hasSidebar).toBeTruthy();
  });

  test('sidebar updates on pattern selection', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
    
    // Pattern sidebar should be visible with pattern name
    await expect(page.locator('#pattern-sidebar')).toBeVisible();
    await expect(page.locator('#sidebar-pattern-name')).toContainText(/Converged/i);
  });

  test('config summary updates on selection', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page);
    
    // Summary should reflect selections
    const summaryText = await page.locator('#sum-pattern, #summary-content').textContent();
    expect(summaryText).toBeTruthy();
  });
});


// ============================================================================
// 6. VLAN CONFIGURATION
// ============================================================================

test.describe('6. VLAN Configuration', () => {
  
  test('fully converged pattern shows both storage VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
    await expect(page.locator('#vlan-storage2-id')).toHaveValue('712');
  });

  test('VLAN name auto-updates on ID change', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.waitForTimeout(200);
    
    await page.fill('#vlan-storage1-id', '800');
    await page.locator('#vlan-storage1-id').dispatchEvent('change');
    
    await expect(page.locator('#vlan-storage1-name')).toHaveValue(/800/);
  });

  test('switchless pattern has empty storage VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('');
  });
});


// ============================================================================
// 7. PORT CONFIGURATION
// ============================================================================

test.describe('7. Port Configuration', () => {
  
  test('fully converged shows converged port section', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page, { pattern: 'fully_converged' });
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.click('.sub-nav-btn[data-substep="2.2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#port-section-converged')).toBeVisible();
  });

  test('switched TOR1 shows Storage1 section', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page, { pattern: 'switched', role: 'TOR1' });
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.click('.sub-nav-btn[data-substep="2.2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#port-section-storage1')).toBeVisible();
    await expect(page.locator('#port-section-storage2')).not.toBeVisible();
  });

  test('switched TOR2 shows Storage2 section', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page, { pattern: 'switched', role: 'TOR2' });
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.click('.sub-nav-btn[data-substep="2.2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#port-section-storage2')).toBeVisible();
    await expect(page.locator('#port-section-storage1')).not.toBeVisible();
  });
});


// ============================================================================
// 8. ROUTING CONFIGURATION
// ============================================================================

test.describe('8. Routing Configuration', () => {
  
  test('BGP and Static options visible', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="3"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('.routing-card[data-routing="bgp"]')).toBeVisible();
    await expect(page.locator('.routing-card[data-routing="static"]')).toBeVisible();
  });

  test('can add BGP neighbor', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="3"]');
    await page.waitForTimeout(200);
    
    const initialCount = await page.locator('.neighbor-entry').count();
    await page.click('#btn-add-neighbor');
    
    await expect(page.locator('.neighbor-entry')).toHaveCount(initialCount + 1);
  });
});


// ============================================================================
// 9. TEMPLATE LOADING
// ============================================================================

test.describe('9. Template Loading', () => {
  
  test('template modal opens and closes', async ({ page }) => {
    await page.goto('/');
    
    await page.click('button:has-text("Load")');
    await expect(page.locator('#template-modal')).toBeVisible();
    
    await page.click('.modal-close');
    await expect(page.locator('#template-modal')).not.toBeVisible();
  });

  test('loading template populates form', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await expect(page.locator('#hostname')).toHaveValue('sample-tor1');
    await expect(page.locator('#pattern-sidebar')).toBeVisible();
  });

  test('switched template loads correct VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switched', 'TOR1');
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
  });
});


// ============================================================================
// 10. EXPORT FUNCTIONALITY
// ============================================================================

test.describe('10. Export Functionality', () => {
  
  test('JSON preview is visible in review', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="review"]');
    await page.waitForTimeout(200);
    
    await expect(page.locator('#json-preview')).toBeVisible();
  });

  test('export button triggers download', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="review"]');
    await page.waitForTimeout(200);
    
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('#btn-export');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});


// ============================================================================
// 11. IMPORT FUNCTIONALITY
// ============================================================================

test.describe('11. Import Functionality', () => {
  
  test('import JSON file works', async ({ page }) => {
    await page.goto('/');
    
    const testConfig = {
      switch: {
        vendor: 'dellemc',
        model: 's5248f-on',
        firmware: 'os10',
        hostname: 'imported-switch',
        role: 'TOR1',
        deployment_pattern: 'fully_converged'
      },
      vlans: [{ vlan_id: 7, name: 'Mgmt_7', purpose: 'management' }]
    };
    
    await page.locator('input#import-json').setInputFiles({
      name: 'test-config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(testConfig))
    });
    await page.waitForTimeout(300);
    
    await expect(page.locator('#hostname')).toHaveValue('imported-switch');
  });
});


// ============================================================================
// 12. START OVER / RESET
// ============================================================================

test.describe('12. Start Over', () => {
  
  test('start over resets with confirmation', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    page.on('dialog', dialog => dialog.accept());
    
    await page.click('button:has-text("Start Over"), #btn-reset');
    await page.waitForTimeout(300);
    
    await expect(page.locator('#hostname')).toHaveValue('');
  });
});


// ============================================================================
// 13. CRITICAL BUSINESS RULES
// ============================================================================

test.describe('13. Critical Business Rules', () => {
  
  test('peer-link tagged_vlans excludes storage (7,201 only)', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await page.click('.nav-phase[data-phase="review"]');
    await page.waitForTimeout(300);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    const peerLink = config.port_channels?.find((pc: any) => pc.vpc_peer_link === true);
    expect(peerLink?.tagged_vlans).toBe('7,201');
  });

  test('switchless pattern excludes storage VLANs from config', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    await page.click('.nav-phase[data-phase="review"]');
    await page.waitForTimeout(300);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Should not have storage VLANs
    const storageVlans = config.vlans?.filter((v: any) => 
      v.purpose === 'storage_1' || v.purpose === 'storage_2'
    );
    expect(storageVlans?.length || 0).toBe(0);
  });
});


// ============================================================================
// 14. UI COMPONENTS
// ============================================================================

test.describe('14. UI Components', () => {
  
  test('lightbox opens on pattern image click', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
    
    await expect(page.locator('#pattern-lightbox')).not.toBeVisible();
    await page.click('#sidebar-pattern-img');
    await expect(page.locator('#pattern-lightbox')).toBeVisible();
    
    await page.click('#pattern-lightbox');
    await expect(page.locator('#pattern-lightbox')).not.toBeVisible();
  });

  test('collapsible BMC section toggles', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    await page.click('.nav-phase[data-phase="2"]');
    await page.waitForTimeout(200);
    
    const bmcContent = page.locator('#vlan-bmc-section .collapsible-content');
    await expect(bmcContent).not.toBeVisible();
    
    await page.click('#vlan-bmc-section .collapsible-header');
    await expect(bmcContent).toBeVisible();
  });
});
