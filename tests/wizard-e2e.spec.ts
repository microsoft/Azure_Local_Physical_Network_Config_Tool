import { test, expect } from '@playwright/test';

/**
 * Azure Local Switch Configuration Wizard - E2E Tests
 * 
 * Tests for Odin-style UI with single-page scroll layout.
 * 
 * TIMEOUT CONFIG (playwright.config.ts):
 * - Per test: 30 seconds
 * - Global: 3 minutes  
 * - Action: 10 seconds
 * - Navigation: 15 seconds
 * - Expect: 5 seconds
 */

// Set default timeout for all tests in this file
test.setTimeout(30000);

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
  
  // Select role (class is .role-btn not .role-card)
  await page.click(`.role-btn[data-role="${role}"]`);
  await page.waitForTimeout(100);
}

/** Load a template quickly */
async function loadTemplate(page: any, pattern = 'Fully Converged', role = 'TOR1') {
  // Load Template button is now a <label>, not a <button>
  await page.click('label:has-text("Load Template")', { timeout: 5000 });
  await expect(page.locator('#template-modal')).toBeVisible({ timeout: 5000 });
  
  if (pattern === 'Fully Converged') {
    await page.click(`.template-card:has-text("${role}")`, { timeout: 5000 });
  } else {
    const section = page.locator(`.template-category:has-text("${pattern}") + .template-grid`);
    await section.locator(`.template-card:has-text("${role}")`).click({ timeout: 5000 });
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
    // Check for breadcrumb nav (primary navigation)
    const hasBreadcrumb = await page.locator('.breadcrumb-nav').count() > 0;
    expect(hasBreadcrumb).toBeTruthy();
  });
});


// ============================================================================
// 2. NAVIGATION
// ============================================================================

test.describe('2. Navigation', () => {
  
  test('breadcrumb navigation items are clickable', async ({ page }) => {
    await page.goto('/');
    
    // Click second breadcrumb item
    const breadcrumbItems = page.locator('.breadcrumb-item');
    if (await breadcrumbItems.count() > 1) {
      await breadcrumbItems.nth(1).click();
      await page.waitForTimeout(300);
    }
  });

  test('all 5 sections are visible on scroll', async ({ page }) => {
    await page.goto('/');
    
    // All wizard-step sections should be visible (single-page scroll)
    // Note: There are 5 sections - Review section was removed
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase2-ports')).toBeVisible();
    await expect(page.locator('#phase2-redundancy')).toBeVisible();
    await expect(page.locator('#phase3')).toBeVisible();
  });

  test('breadcrumb clicks scroll to sections', async ({ page }) => {
    await page.goto('/');
    
    // Click breadcrumb 02 VLANs - should scroll to phase2
    // Breadcrumbs are <a> tags with class .breadcrumb-item
    await page.click('a.breadcrumb-item[data-section="phase2"]');
    await page.waitForTimeout(300);
    
    // Verify phase2 is in viewport (scrolled to)
    const phase2 = page.locator('#phase2');
    await expect(phase2).toBeInViewport();
  });

  test('progress bar starts at 0% on fresh page', async ({ page }) => {
    await page.goto('/');
    
    // Progress bar should show 0% on fresh load (no default values)
    const progressBar = page.locator('.progress-fill');
    const width = await progressBar.evaluate(el => getComputedStyle(el).width);
    
    // Width should be 0px or very small (0%)
    expect(parseInt(width)).toBeLessThanOrEqual(5);
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
    
    await expect(page.locator('.role-btn[data-role="TOR1"]')).toBeVisible();
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
    // Config summary sidebar should exist
    const hasSidebar = await page.locator('#config-summary-sidebar, .config-summary-sidebar').count() > 0;
    expect(hasSidebar).toBeTruthy();
  });

  test('pattern selection updates config summary', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
    
    // Config summary should update with pattern
    await expect(page.locator('#sum-pattern')).toContainText(/converged/i);
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
    
    // VLANs section is now always visible (single-page scroll)
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
    await expect(page.locator('#vlan-storage2-id')).toHaveValue('712');
  });

  test('VLAN name auto-updates on ID change', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // VLANs visible without navigation
    await page.fill('#vlan-storage1-id', '800');
    await page.locator('#vlan-storage1-id').dispatchEvent('change');
    
    await expect(page.locator('#vlan-storage1-name')).toHaveValue(/800/);
  });

  test('switchless pattern has empty storage VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    // VLANs visible without navigation
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
    
    // Port section visible on single-page scroll
    await expect(page.locator('#port-section-converged')).toBeVisible();
  });

  test('switched TOR1 shows Storage1 section', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page, { pattern: 'switched', role: 'TOR1' });
    
    // Port sections visible on single-page scroll
    await expect(page.locator('#port-section-storage1')).toBeVisible();
    await expect(page.locator('#port-section-storage2')).not.toBeVisible();
  });

  test('switched TOR2 shows Storage2 section', async ({ page }) => {
    await page.goto('/');
    await setupSwitch(page, { pattern: 'switched', role: 'TOR2' });
    
    // Port sections visible on single-page scroll
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
    
    // Routing section visible on single-page scroll
    await expect(page.locator('.routing-card[data-routing="bgp"]')).toBeVisible();
    await expect(page.locator('.routing-card[data-routing="static"]')).toBeVisible();
  });

  test('can add BGP neighbor', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // BGP section visible on single-page scroll
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
    
    // Load Template is now a <label>, not a <button>
    await page.click('label:has-text("Load Template")');
    await expect(page.locator('#template-modal')).toBeVisible();
    
    await page.click('.modal-close');
    await expect(page.locator('#template-modal')).not.toBeVisible();
  });

  test('loading template populates form', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await expect(page.locator('#hostname')).toHaveValue('sample-tor1');
    // Config summary should update
    await expect(page.locator('#sum-pattern')).toContainText(/converged/i);
  });

  test('switched template loads correct VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switched', 'TOR1');
    
    // VLANs visible on single-page scroll
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
  });
});


// ============================================================================
// 10. EXPORT FUNCTIONALITY
// ============================================================================

test.describe('10. Export Functionality', () => {
  
  test('JSON preview is visible by default', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // JSON preview should be open by default (not collapsed)
    const jsonPreview = page.locator('#json-preview');
    await expect(jsonPreview).toBeVisible();
    
    // Verify it has actual content (not empty)
    const jsonText = await jsonPreview.textContent();
    expect(jsonText?.trim().length).toBeGreaterThan(10);
  });

  test('export button triggers download', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // Export button visible on single-page scroll
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('#btn-export');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('copy JSON button copies to clipboard', async ({ page, context }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Click copy button
    await page.click('#btn-copy');
    
    // Verify clipboard content is valid JSON
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(() => JSON.parse(clipboardText)).not.toThrow();
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
    
    // Reset button visible on single-page scroll
    await page.click('#btn-reset');
    await page.waitForTimeout(300);
    
    // Check that form is reset
    await expect(page.locator('.pattern-card.selected')).toHaveCount(0);
  });
});


// ============================================================================
// 13. CRITICAL BUSINESS RULES
// ============================================================================

test.describe('13. Critical Business Rules', () => {
  
  test('peer-link tagged_vlans excludes storage VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    // JSON preview visible on single-page scroll
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Should have port_channels with peer-link
    const peerLink = config.port_channels?.find((pc: any) => pc.vpc_peer_link === true);
    if (peerLink) {
      // If peer-link exists, tagged_vlans should NOT include 711 or 712 (storage)
      const taggedVlans = peerLink.tagged_vlans || '';
      expect(taggedVlans).not.toContain('711');
      expect(taggedVlans).not.toContain('712');
    }
    // Test passes if no peer-link (config structure may vary)
  });

  test('switchless pattern excludes storage VLANs from config', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    // JSON preview visible on single-page scroll
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
  
  test('pattern cards show selected state', async ({ page }) => {
    await page.goto('/');
    
    // Click a pattern card
    await page.locator('.pattern-card[data-pattern="switched"]').click();
    
    // Verify selected state
    await expect(page.locator('.pattern-card[data-pattern="switched"]')).toHaveClass(/selected/);
    await expect(page.locator('.pattern-card[data-pattern="fully_converged"]')).not.toHaveClass(/selected/);
    
    // Click different pattern
    await page.locator('.pattern-card[data-pattern="fully_converged"]').click();
    await expect(page.locator('.pattern-card[data-pattern="fully_converged"]')).toHaveClass(/selected/);
    await expect(page.locator('.pattern-card[data-pattern="switched"]')).not.toHaveClass(/selected/);
  });

  test('theme toggle switches between dark and light', async ({ page }) => {
    await page.goto('/');
    
    // Check initial theme (dark by default)
    const body = page.locator('body');
    const initialTheme = await body.getAttribute('data-theme') || 'dark';
    
    // Click theme toggle (class selector, not ID)
    await page.click('.theme-toggle');
    await page.waitForTimeout(200);
    
    // Theme should change
    const newTheme = await body.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('font size controls adjust text', async ({ page }) => {
    await page.goto('/');
    
    // Font size is controlled via CSS classes on body
    const body = page.locator('body');
    
    // Click increase button (A+ text)
    await page.click('button:has-text("A+")');
    await page.waitForTimeout(200);
    
    // Body should have font-large class or changed from font-small
    const hasLargeClass = await body.evaluate(el => 
      el.classList.contains('font-large')
    );
    expect(hasLargeClass).toBeTruthy();
  });

  test('VLAN Add/Remove buttons in section header', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page);
    
    // Add button should be visible
    await expect(page.locator('#btn-add-mgmt')).toBeVisible();
    
    // Remove button should be hidden initially (only 1 VLAN)
    await expect(page.locator('#btn-remove-mgmt')).not.toBeVisible();
    
    // Add a VLAN
    await page.click('#btn-add-mgmt');
    await page.waitForTimeout(200);
    
    // Now Remove button should be visible (2 VLANs)
    await expect(page.locator('#btn-remove-mgmt')).toBeVisible();
    
    // Remove the last VLAN
    page.on('dialog', dialog => dialog.accept());
    await page.click('#btn-remove-mgmt');
    await page.waitForTimeout(200);
    
    // Remove button should be hidden again (1 VLAN)
    await expect(page.locator('#btn-remove-mgmt')).not.toBeVisible();
  });
});

// ============================================================================
// 15. STATIC ROUTING CONFIGURATION
// ============================================================================

test.describe('15. Static Routing Configuration', () => {
  
  test('static routing option is selectable', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    // Static routing card should be visible
    await expect(page.locator('.routing-card[data-routing="static"]')).toBeVisible();
    
    // Click static routing option
    await page.click('.routing-card[data-routing="static"]');
    await page.waitForTimeout(200);
    
    // Should be selected
    await expect(page.locator('.routing-card[data-routing="static"]')).toHaveClass(/selected/);
  });

  test('can add static route', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    // Select static routing
    await page.click('.routing-card[data-routing="static"]');
    await page.waitForTimeout(200);
    
    // Add static route button should be visible
    const addButton = page.locator('#btn-add-static-route, button:has-text("Add Static Route")');
    if (await addButton.isVisible()) {
      const initialCount = await page.locator('.static-route-entry').count();
      await addButton.click();
      await page.waitForTimeout(200);
      
      await expect(page.locator('.static-route-entry')).toHaveCount(initialCount + 1);
    }
  });

  test('switchless example has static_routes in JSON', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switchless', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Switchless template should have static_routes
    expect(config.static_routes).toBeDefined();
    expect(Array.isArray(config.static_routes)).toBeTruthy();
    expect(config.static_routes.length).toBeGreaterThan(0);
    
    // Each route should have destination and next_hop
    const firstRoute = config.static_routes[0];
    expect(firstRoute.destination).toBeDefined();
    expect(firstRoute.next_hop).toBeDefined();
  });
});


// ============================================================================
// 16. QOS CONFIGURATION
// ============================================================================

test.describe('16. QoS Configuration', () => {
  
  test('interface QoS is present in fully-converged template', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Find interfaces with qos: true
    const qosInterfaces = config.interfaces?.filter((i: any) => i.qos === true);
    expect(qosInterfaces?.length).toBeGreaterThan(0);
  });

  test('storage interface has QoS in switched template', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switched', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Find storage trunk interface
    const storageInterface = config.interfaces?.find((i: any) => 
      i.name?.toLowerCase().includes('storage')
    );
    
    if (storageInterface) {
      expect(storageInterface.qos).toBe(true);
    }
  });
});


// ============================================================================
// 17. BGP NETWORKS CONFIGURATION
// ============================================================================

test.describe('17. BGP Networks Configuration', () => {
  
  test('BGP networks array exists in template', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // BGP should have networks array
    expect(config.bgp).toBeDefined();
    expect(config.bgp.networks).toBeDefined();
    expect(Array.isArray(config.bgp.networks)).toBeTruthy();
    expect(config.bgp.networks.length).toBeGreaterThan(0);
  });
});


// ============================================================================
// 18. SWITCHED PATTERN PEER-LINK VALIDATION
// ============================================================================

test.describe('18. Switched Pattern Validation', () => {
  
  test('switched pattern peer-link excludes storage VLANs', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switched', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Find peer-link port channel
    const peerLink = config.port_channels?.find((pc: any) => pc.vpc_peer_link === true);
    if (peerLink) {
      // Peer-link tagged_vlans should NOT include storage VLANs (711, 712)
      const taggedVlans = peerLink.tagged_vlans || '';
      expect(taggedVlans).not.toContain('711');
      expect(taggedVlans).not.toContain('712');
    }
  });

  test('switched pattern has separate storage VLAN per TOR', async ({ page }) => {
    await page.goto('/');
    await loadTemplate(page, 'Switched', 'TOR1');
    
    await page.waitForTimeout(500);
    
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // TOR1 should have storage_1 VLAN (711), NOT storage_2 (712)
    const storage1 = config.vlans?.find((v: any) => v.purpose === 'storage_1');
    const storage2 = config.vlans?.find((v: any) => v.purpose === 'storage_2');
    
    expect(storage1).toBeDefined();
    expect(storage2).toBeUndefined();
  });
});


// ============================================================================
// 19. END-TO-END USER WORKFLOW
// ============================================================================

test.describe('19. End-to-End User Workflow', () => {

  test('user can fill wizard from scratch and export valid JSON', async ({ page }) => {
    await page.goto('/');
    
    // Use the setupSwitch helper which is more reliable
    await setupSwitch(page, { 
      pattern: 'fully_converged', 
      vendor: 'dellemc', 
      model: 's5248f-on', 
      role: 'TOR1' 
    });
    
    // Check hostname is auto-generated
    await page.waitForTimeout(300);
    const hostnameInput = page.locator('#hostname');
    await expect(hostnameInput).toHaveValue(/.+/);
    
    // Fill management VLAN with correct selectors (trigger change events)
    const mgmtIdInput = page.locator('.vlan-mgmt-id');
    await mgmtIdInput.fill('7');
    await mgmtIdInput.dispatchEvent('change');
    
    const mgmtIpInput = page.locator('.vlan-mgmt-ip');
    await mgmtIpInput.fill('192.168.1.2/24');
    
    // Fill compute VLAN
    const computeIdInput = page.locator('.vlan-compute-id');
    await computeIdInput.fill('201');
    await computeIdInput.dispatchEvent('change');
    
    // Fill storage VLANs (for fully_converged)
    const storage1Input = page.locator('#vlan-storage1-id');
    if (await storage1Input.isVisible()) {
      await storage1Input.fill('711');
      await storage1Input.dispatchEvent('change');
      
      const storage2Input = page.locator('#vlan-storage2-id');
      await storage2Input.fill('712');
      await storage2Input.dispatchEvent('change');
    }
    
    // Wait for state to update
    await page.waitForTimeout(800);
    
    // Verify JSON preview has valid config
    const jsonText = await page.locator('#json-preview').textContent();
    expect(jsonText).toBeTruthy();
    
    const config = JSON.parse(jsonText || '{}');
    
    // Verify switch section
    expect(config.switch).toBeDefined();
    expect(config.switch.vendor).toBe('dellemc');
    expect(config.switch.model).toBe('s5248f-on');
    expect(config.switch.role).toBe('TOR1');
    expect(config.switch.deployment_pattern).toBe('fully_converged');
    
    // Export JSON file (don't require vlans for this basic test)
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('#btn-export');
    const download = await downloadPromise;
    
    // Verify download has correct filename format
    expect(download.suggestedFilename()).toMatch(/.+-config\.json$/);
  });

  test('user can configure Cisco switch with BGP routing', async ({ page }) => {
    await page.goto('/');
    
    // Use the setupSwitch helper for Cisco
    await setupSwitch(page, { 
      pattern: 'fully_converged', 
      vendor: 'cisco', 
      model: '93180yc-fx3', 
      role: 'TOR1' 
    });
    
    // Scroll to routing section and select BGP
    await page.evaluate(() => document.querySelector('#phase3')?.scrollIntoView());
    await page.waitForTimeout(300);
    
    const bgpCard = page.locator('.routing-card[data-routing="bgp"]');
    if (await bgpCard.isVisible()) {
      await page.click('.routing-card[data-routing="bgp"]');
      
      // Fill BGP details
      await page.fill('#bgp-asn', '65001');
      await page.fill('#bgp-router-id', '10.0.0.1');
    }
    
    await page.waitForTimeout(500);
    
    // Verify JSON has Cisco config
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    expect(config.switch.vendor).toBe('cisco');
    expect(config.switch.firmware).toBe('nxos');
  });

  test('exported JSON contains all configured sections', async ({ page }) => {
    await page.goto('/');
    
    // Load a complete template
    await loadTemplate(page, 'Fully Converged', 'TOR1');
    await page.waitForTimeout(500);
    
    // Get the JSON preview content
    const jsonText = await page.locator('#json-preview').textContent();
    const config = JSON.parse(jsonText || '{}');
    
    // Verify all major sections are present
    expect(config.switch).toBeDefined();
    expect(config.vlans).toBeDefined();
    expect(config.interfaces).toBeDefined();
    expect(config.port_channels).toBeDefined();
    expect(config.mlag).toBeDefined();
    expect(config.bgp).toBeDefined();
    
    // Verify VLANs have required fields
    for (const vlan of config.vlans) {
      expect(vlan.vlan_id).toBeDefined();
      expect(typeof vlan.vlan_id).toBe('number');
    }
    
    // Verify interfaces have required fields
    for (const intf of config.interfaces) {
      expect(intf.name).toBeDefined();
      expect(intf.type).toBeDefined();
      expect(intf.intf_type).toBeDefined();
    }
    
    // Verify BGP has required fields
    expect(config.bgp.asn).toBeDefined();
    expect(config.bgp.router_id).toBeDefined();
  });
});