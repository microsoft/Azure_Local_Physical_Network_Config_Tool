import { test, expect } from '@playwright/test';

/**
 * Azure Local Switch Configuration Wizard - E2E Tests
 * Tests the 3-phase pattern-first wizard flow
 * 
 * Phase Structure:
 * - Phase 1: Pattern & Switch (1.1 Pattern → 1.2 Hardware → 1.3 Role → 1.4 Hostname)
 * - Phase 2: Network (2.1 VLANs → 2.2 Ports → 2.3 Redundancy → 2.4 Uplinks)
 * - Phase 3: Routing (BGP or Static)
 * - Review & Export
 */

test.describe('Azure Local Switch Configuration Wizard E2E', () => {

  test.describe('Homepage & Navigation', () => {
    
    test('should load the wizard homepage with 3-phase navigation', async ({ page }) => {
      await page.goto('/');
      
      // Check title
      await expect(page).toHaveTitle(/Azure Local Switch Configuration Wizard/);
      
      // Check header is visible
      const header = page.locator('h1');
      await expect(header).toContainText('Azure Local Switch Configuration Wizard');
      
      // Check 3-phase navigation is visible (not 7-step)
      await expect(page.locator('.nav-phase[data-phase="1"]')).toBeVisible();
      await expect(page.locator('.nav-phase[data-phase="2"]')).toBeVisible();
      await expect(page.locator('.nav-phase[data-phase="3"]')).toBeVisible();
      await expect(page.locator('.nav-phase[data-phase="review"]')).toBeVisible();
      
      // Phase 1 should be active by default
      await expect(page.locator('.nav-phase[data-phase="1"]')).toHaveClass(/active/);
    });

    test('should show Phase 2 sub-steps in navigation when Phase 2 is active', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Phase 2
      await page.click('.nav-phase[data-phase="2"]');
      
      // Phase 2 should have sub-steps visible when active
      const phase2 = page.locator('.nav-phase[data-phase="2"]');
      await expect(phase2).toBeVisible();
      await expect(phase2).toHaveClass(/active/);
      
      // Check sub-steps are now visible (3 substeps after Uplinks moved to Phase 3)
      await expect(phase2.locator('.sub-step[data-step="2.1"]')).toBeVisible();
      await expect(phase2.locator('.sub-step[data-step="2.2"]')).toBeVisible();
      await expect(phase2.locator('.sub-step[data-step="2.3"]')).toBeVisible();
      // 2.4 Uplinks no longer exists - moved to Phase 3
    });
  });

  test.describe('Pattern Selection (Phase 1.1)', () => {
    
    test('should display 3 deployment pattern cards', async ({ page }) => {
      await page.goto('/');
      
      // Check all pattern cards exist
      await expect(page.locator('.pattern-card[data-pattern="switchless"]')).toBeVisible();
      await expect(page.locator('.pattern-card[data-pattern="switched"]')).toBeVisible();
      await expect(page.locator('.pattern-card[data-pattern="fully_converged"]')).toBeVisible();
    });

    test('should show pattern sidebar after selection', async ({ page }) => {
      await page.goto('/');
      
      // Sidebar should be hidden initially
      await expect(page.locator('#pattern-sidebar')).not.toBeVisible();
      
      // Select a pattern - click on the h4 text to avoid image
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      
      // Sidebar should now be visible
      await expect(page.locator('#pattern-sidebar')).toBeVisible();
      await expect(page.locator('#sidebar-pattern-name')).toContainText('Fully Converged');
    });

    test('should mark pattern card as selected', async ({ page }) => {
      await page.goto('/');
      
      // Click on switchless pattern - click on the h4 text to avoid image
      await page.locator('.pattern-card[data-pattern="switchless"] h4').click();
      await expect(page.locator('.pattern-card[data-pattern="switchless"]')).toHaveClass(/selected/);
      
      // Click on a different pattern
      await page.locator('.pattern-card[data-pattern="switched"] h4').click();
      await expect(page.locator('.pattern-card[data-pattern="switched"]')).toHaveClass(/selected/);
      await expect(page.locator('.pattern-card[data-pattern="switchless"]')).not.toHaveClass(/selected/);
    });

    test('should reveal hardware section after pattern selection', async ({ page }) => {
      await page.goto('/');
      
      // Select a pattern - click on the h4 text to avoid image
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      
      // Hardware section should be visible
      await expect(page.locator('.hardware-selection')).toBeVisible();
      await expect(page.locator('#vendor-select')).toBeVisible();
    });
  });

  test.describe('Hardware Selection (Phase 1.2)', () => {
    
    test('should populate model dropdown on vendor selection', async ({ page }) => {
      await page.goto('/');
      
      // Select pattern first
      await page.click('.pattern-card[data-pattern="fully_converged"]');
      
      // Model dropdown should be disabled initially
      await expect(page.locator('#model-select')).toBeDisabled();
      
      // Select vendor
      await page.selectOption('#vendor-select', 'cisco');
      
      // Model dropdown should now be enabled
      await expect(page.locator('#model-select')).not.toBeDisabled();
      
      // Should have Cisco models
      const modelOptions = await page.locator('#model-select option').allTextContents();
      expect(modelOptions.some(opt => opt.includes('Nexus'))).toBeTruthy();
    });

    test('should show role section after model selection', async ({ page }) => {
      await page.goto('/');
      
      // Complete pattern and hardware selection
      await page.click('.pattern-card[data-pattern="fully_converged"]');
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5248f-on');
      
      // Role section should be visible
      await expect(page.locator('#role-selection-section')).toBeVisible();
      await expect(page.locator('.role-card[data-role="TOR1"]')).toBeVisible();
      await expect(page.locator('.role-card[data-role="TOR2"]')).toBeVisible();
    });
  });

  test.describe('Role Selection (Phase 1.3)', () => {
    
    test('should auto-generate hostname based on role', async ({ page }) => {
      await page.goto('/');
      
      // Complete previous steps - click on h4 to avoid image lightbox
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5248f-on');
      
      // Select TOR1 role
      await page.click('.role-card[data-role="TOR1"]');
      
      // Wait for hostname to be auto-generated
      await page.waitForTimeout(200);
      
      // Hostname should contain tor1
      await expect(page.locator('#hostname')).toHaveValue(/tor1/i);
    });

    test('should mark role card as selected', async ({ page }) => {
      await page.goto('/');
      
      // Complete previous steps - click on h4 to avoid image lightbox
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5248f-on');
      
      // Select TOR2 role
      await page.click('.role-card[data-role="TOR2"]');
      
      await expect(page.locator('.role-card[data-role="TOR2"]')).toHaveClass(/selected/);
    });
  });

  test.describe('Template Loading', () => {
    
    test('should open and close template modal', async ({ page }) => {
      await page.goto('/');
      
      // Open template modal
      await page.click('button:has-text("Load Example Configuration Template")');
      
      // Verify modal is visible
      await expect(page.locator('#template-modal')).toBeVisible();
      
      // Close modal
      await page.click('.modal-close');
      
      // Verify modal is hidden
      await expect(page.locator('#template-modal')).not.toBeVisible();
    });

    test('should display templates organized by pattern', async ({ page }) => {
      await page.goto('/');
      
      // Open template modal
      await page.click('button:has-text("Load Example Configuration Template")');
      
      // Check pattern categories exist
      await expect(page.locator('.template-category:has-text("Fully Converged")')).toBeVisible();
      await expect(page.locator('.template-category:has-text("Switched")')).toBeVisible();
      await expect(page.locator('.template-category:has-text("Switchless")')).toBeVisible();
    });

    test('should load fully-converged/sample-tor1 template', async ({ page }) => {
      await page.goto('/');
      
      // Open template modal and select template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      
      // Wait for template to load
      await page.waitForTimeout(500);
      
      // Modal should close automatically
      await expect(page.locator('#template-modal')).not.toBeVisible();
      
      // Success message should appear
      await expect(page.locator('#success-message')).toBeVisible();
      
      // Pattern should be selected
      await expect(page.locator('#pattern-sidebar')).toBeVisible();
      
      // Hostname should be populated
      await expect(page.locator('#hostname')).toHaveValue('sample-tor1');
    });

    test('should load switched pattern template with correct VLANs', async ({ page }) => {
      await page.goto('/');
      
      // Open template modal
      await page.click('button:has-text("Load Example Configuration Template")');
      
      // Find and click the Switched TOR1 template
      const switchedSection = page.locator('.template-category:has-text("Switched") + .template-grid');
      await switchedSection.locator('.template-card:has-text("TOR1")').click();
      
      // Wait for template to load
      await page.waitForTimeout(500);
      
      // Navigate to VLANs step
      await page.click('.nav-phase[data-phase="2"]');
      
      // Check storage VLAN 1 is populated (TOR1 in switched pattern has S1)
      await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
    });
  });

  test.describe('Phase 2: Network Configuration', () => {
    
    test('should navigate through Phase 2 substeps', async ({ page }) => {
      await page.goto('/');
      
      // Load a template to populate data
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Phase 2
      await page.click('.nav-phase[data-phase="2"]');
      
      // Should start at substep 2.1 (VLANs)
      await expect(page.locator('.substep[data-substep="2.1"]')).toHaveClass(/active/);
      
      // Click next to go to 2.2
      await page.click('button:has-text("Next: Host Ports")');
      await expect(page.locator('.substep[data-substep="2.2"]')).toHaveClass(/active/);
      
      // Click next to go to 2.3 (Redundancy is now last substep in Phase 2)
      await page.click('button:has-text("Next: Redundancy")');
      await expect(page.locator('.substep[data-substep="2.3"]')).toHaveClass(/active/);
      
      // Click next to go to Phase 3 (Routing - which now includes Uplinks)
      await page.click('button:has-text("Next: Routing")');
      await expect(page.locator('#phase3')).toHaveClass(/active/);
    });

    test('should toggle BMC section collapse', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Phase 2 (VLANs)
      await page.click('.nav-phase[data-phase="2"]');
      
      // BMC section should be collapsed by default
      const bmcContent = page.locator('#vlan-bmc-section .collapsible-content');
      await expect(bmcContent).not.toBeVisible();
      
      // Click to expand
      await page.click('#vlan-bmc-section .collapsible-header');
      await expect(bmcContent).toBeVisible();
      
      // Click to collapse
      await page.click('#vlan-bmc-section .collapsible-header');
      await expect(bmcContent).not.toBeVisible();
    });

    test('should auto-update storage VLAN names', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Phase 2 (VLANs)
      await page.click('.nav-phase[data-phase="2"]');
      
      // Change storage VLAN ID
      await page.fill('#vlan-storage1-id', '800');
      
      // Trigger change event
      await page.locator('#vlan-storage1-id').dispatchEvent('change');
      
      // Name should auto-update
      await expect(page.locator('#vlan-storage1-name')).toHaveValue('Storage1_800');
    });
  });

  test.describe('Phase 3: Routing Configuration', () => {
    
    test('should display BGP and Static routing options', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Phase 3
      await page.click('.nav-phase[data-phase="3"]');
      
      // Check routing options exist
      await expect(page.locator('.routing-card[data-routing="bgp"]')).toBeVisible();
      await expect(page.locator('.routing-card[data-routing="static"]')).toBeVisible();
      
      // BGP should be selected by default
      await expect(page.locator('.routing-card[data-routing="bgp"]')).toHaveClass(/selected/);
    });

    test('should add BGP neighbor', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Phase 3
      await page.click('.nav-phase[data-phase="3"]');
      
      // Count initial neighbors
      const initialCount = await page.locator('.neighbor-entry').count();
      
      // Add a neighbor
      await page.click('#btn-add-neighbor');
      
      // Should have one more neighbor entry
      await expect(page.locator('.neighbor-entry')).toHaveCount(initialCount + 1);
    });
  });

  test.describe('Review & Export', () => {
    
    test('should navigate to review and show JSON preview', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Review
      await page.click('.nav-phase[data-phase="review"]');
      
      // Verify JSON preview is visible
      await expect(page.locator('#json-preview')).toBeVisible();
      
      // Verify export button exists
      await expect(page.locator('#btn-export')).toBeVisible();
    });

    test('should export configuration as JSON', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Review
      await page.click('.nav-phase[data-phase="review"]');
      
      // Set up download handler
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button
      await page.click('#btn-export');
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify filename
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    });

    test('should copy JSON to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Review
      await page.click('.nav-phase[data-phase="review"]');
      
      // Wait for any previous success message to fade
      await page.waitForTimeout(300);
      
      // Click copy button
      await page.click('#btn-copy');
      
      // Wait for success message to update
      await page.waitForTimeout(500);
      
      // Success message should appear with "copied" text
      await expect(page.locator('#success-message')).toBeVisible();
    });

    test('should start over and reset configuration', async ({ page }) => {
      await page.goto('/');
      
      // Load a template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Review
      await page.click('.nav-phase[data-phase="review"]');
      
      // Handle confirmation dialog
      page.on('dialog', dialog => dialog.accept());
      
      // Click start over button
      await page.click('#btn-reset');
      
      // Page should reload (hostname should be empty)
      await page.waitForTimeout(500);
      await expect(page.locator('#hostname')).toHaveValue('');
    });
  });

  test.describe('Pattern-First Flow (Complete)', () => {
    
    test('should complete entire wizard flow: fully_converged', async ({ page }) => {
      await page.goto('/');
      
      // Phase 1.1: Select Pattern - click on h4 to avoid image
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      await expect(page.locator('#pattern-sidebar')).toBeVisible();
      
      // Phase 1.2: Select Hardware
      await page.selectOption('#vendor-select', 'cisco');
      await page.selectOption('#model-select', '93180yc-fx3');
      
      // Phase 1.3: Select Role
      await page.click('.role-card[data-role="TOR1"]');
      
      // Phase 1.4: Verify hostname auto-generated
      await page.waitForTimeout(200);
      await expect(page.locator('#hostname')).toHaveValue(/tor1/i);
      
      // Go to Phase 2
      await page.click('#phase1-next-btn');
      await expect(page.locator('#phase2')).toHaveClass(/active/);
    });

    test('should complete entire wizard flow: switchless', async ({ page }) => {
      await page.goto('/');
      
      // Phase 1.1: Select Switchless Pattern - click on h4 to avoid image
      await page.locator('.pattern-card[data-pattern="switchless"] h4').click();
      
      // Verify sidebar shows correct pattern
      await expect(page.locator('#sidebar-pattern-name')).toContainText('Switchless');
      
      // Phase 1.2: Select Hardware
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5248f-on');
      
      // Phase 1.3: Select Role
      await page.click('.role-card[data-role="TOR1"]');
      
      // Go to Phase 2
      await page.click('#phase1-next-btn');
      
      // Navigate to Host Ports (2.2)
      await page.click('.sub-nav-btn[data-substep="2.2"]');
      
      // Switchless should show only Management + Compute ports
      await expect(page.locator('#port-section-switchless')).toBeVisible();
      await expect(page.locator('#port-section-converged')).not.toBeVisible();
    });

    test('should complete entire wizard flow: switched', async ({ page }) => {
      await page.goto('/');
      
      // Phase 1.1: Select Switched Pattern - click on h4 to avoid image
      await page.locator('.pattern-card[data-pattern="switched"] h4').click();
      
      // Verify sidebar shows correct pattern
      await expect(page.locator('#sidebar-pattern-name')).toContainText('Switched');
      
      // Phase 1.2: Select Hardware
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5232f-on');
      
      // Phase 1.3: Select Role
      await page.click('.role-card[data-role="TOR2"]');
      
      // Go to Phase 2
      await page.click('#phase1-next-btn');
      
      // Navigate to Host Ports (2.2)
      await page.click('.sub-nav-btn[data-substep="2.2"]');
      
      // Switched should show separate mgmt/compute and storage ports
      await expect(page.locator('#port-section-mgmt-compute')).toBeVisible();
      await expect(page.locator('#port-section-converged')).not.toBeVisible();
    });
  });

  test.describe('Pattern-Specific VLAN Visibility', () => {
    
    test('switchless pattern should hide storage VLANs', async ({ page }) => {
      await page.goto('/');
      
      // Load switchless template
      await page.click('button:has-text("Load Example Configuration Template")');
      
      // Find Switchless section and click template
      const switchlessSection = page.locator('.template-category:has-text("Switchless") + .template-grid');
      await switchlessSection.locator('.template-card:has-text("TOR1")').click();
      await page.waitForTimeout(500);
      
      // Navigate to VLANs
      await page.click('.nav-phase[data-phase="2"]');
      
      // Storage VLANs should be empty in switchless pattern
      await expect(page.locator('#vlan-storage1-id')).toHaveValue('');
    });

    test('fully converged pattern should show both storage VLANs', async ({ page }) => {
      await page.goto('/');
      
      // Load fully-converged template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to VLANs
      await page.click('.nav-phase[data-phase="2"]');
      
      // Both storage VLANs should be populated
      await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
      await expect(page.locator('#vlan-storage2-id')).toHaveValue('712');
    });

    test('switched pattern TOR1 should show only Storage 1 ports', async ({ page }) => {
      await page.goto('/');
      
      // Select Switched Pattern
      await page.locator('.pattern-card[data-pattern="switched"] h4').click();
      
      // Select Hardware
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5232f-on');
      
      // Select TOR1 role
      await page.click('.role-card[data-role="TOR1"]');
      
      // Go to Phase 2
      await page.click('#phase1-next-btn');
      
      // Navigate to Host Ports (2.2)
      await page.click('.sub-nav-btn[data-substep="2.2"]');
      
      // TOR1 should show Storage 1 ports only (for VLAN 711)
      await expect(page.locator('#port-section-storage1')).toBeVisible();
      await expect(page.locator('#port-section-storage2')).not.toBeVisible();
      await expect(page.locator('#port-section-mgmt-compute')).toBeVisible();
    });

    test('switched pattern TOR2 should show only Storage 2 ports', async ({ page }) => {
      await page.goto('/');
      
      // Select Switched Pattern
      await page.locator('.pattern-card[data-pattern="switched"] h4').click();
      
      // Select Hardware
      await page.selectOption('#vendor-select', 'dellemc');
      await page.selectOption('#model-select', 's5232f-on');
      
      // Select TOR2 role
      await page.click('.role-card[data-role="TOR2"]');
      
      // Go to Phase 2
      await page.click('#phase1-next-btn');
      
      // Navigate to Host Ports (2.2)
      await page.click('.sub-nav-btn[data-substep="2.2"]');
      
      // TOR2 should show Storage 2 ports only (for VLAN 712)
      await expect(page.locator('#port-section-storage2')).toBeVisible();
      await expect(page.locator('#port-section-storage1')).not.toBeVisible();
      await expect(page.locator('#port-section-mgmt-compute')).toBeVisible();
    });
  });

  test.describe('Critical Rule: Peer-Link Storage Exclusion', () => {
    
    test('peer-link should never have storage VLANs (fully_converged)', async ({ page }) => {
      await page.goto('/');
      
      // Load fully-converged template
      await page.click('button:has-text("Load Example Configuration Template")');
      await page.click('.template-card:has-text("TOR1")');
      await page.waitForTimeout(500);
      
      // Navigate to Review
      await page.click('.nav-phase[data-phase="review"]');
      
      // Get JSON preview content
      const jsonText = await page.locator('#json-preview').textContent();
      const config = JSON.parse(jsonText || '{}');
      
      // Find peer-link port-channel
      const peerLink = config.port_channels?.find((pc: any) => pc.vpc_peer_link === true);
      
      // Peer-link tagged_vlans should be "7,201" (no storage 711, 712)
      expect(peerLink?.tagged_vlans).toBe('7,201');
    });
  });

  test.describe('Lightbox Image Expansion', () => {
    
    test('should expand pattern image in lightbox', async ({ page }) => {
      await page.goto('/');
      
      // Select a pattern to show sidebar - click on h4 to avoid triggering lightbox
      await page.locator('.pattern-card[data-pattern="fully_converged"] h4').click();
      
      // Lightbox should be hidden initially
      await expect(page.locator('#pattern-lightbox')).not.toBeVisible();
      
      // Click sidebar image to expand
      await page.click('#sidebar-pattern-img');
      
      // Lightbox should be visible
      await expect(page.locator('#pattern-lightbox')).toBeVisible();
      
      // Click lightbox to close
      await page.click('#pattern-lightbox');
      await expect(page.locator('#pattern-lightbox')).not.toBeVisible();
    });
  });

  test.describe('JSON Import', () => {
    
    test('should import JSON configuration file', async ({ page }) => {
      await page.goto('/');
      
      // Create test config
      const testConfig = {
        switch: {
          vendor: 'dellemc',
          model: 's5248f-on',
          firmware: 'os10',
          hostname: 'imported-switch',
          role: 'TOR1',
          deployment_pattern: 'fully_converged'
        },
        vlans: [
          { vlan_id: 7, name: 'Mgmt_7', purpose: 'management' }
        ]
      };
      
      // Create a file input
      const fileInput = page.locator('input#import-json');
      
      // Upload the file
      await fileInput.setInputFiles({
        name: 'test-config.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(testConfig))
      });
      
      // Wait for import to complete
      await page.waitForTimeout(500);
      
      // Verify hostname was updated
      await expect(page.locator('#hostname')).toHaveValue('imported-switch');
      
      // Verify pattern was selected
      await expect(page.locator('#pattern-sidebar')).toBeVisible();
    });
  });
});
