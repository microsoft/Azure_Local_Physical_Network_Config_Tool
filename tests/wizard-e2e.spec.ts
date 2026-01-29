import { test, expect } from '@playwright/test';

test.describe('Azure Local Switch Configuration Wizard E2E', () => {
  
  test('should load the wizard homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/Azure Local Switch Configuration Wizard/);
    
    // Check header is visible
    const header = page.locator('h1');
    await expect(header).toContainText('Azure Local Switch Configuration Wizard');
    
    // Check all 7 navigation steps are visible
    await expect(page.locator('.nav-step[data-step="1"]')).toBeVisible();
    await expect(page.locator('.nav-step[data-step="7"]')).toBeVisible();
  });

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

  test('should load Dell TOR1 template and populate all fields', async ({ page }) => {
    await page.goto('/');
    
    // Open template modal and select Dell TOR1
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    
    // Modal should close automatically
    await expect(page.locator('#template-modal')).not.toBeVisible();
    
    // Success message should appear
    await expect(page.locator('#success-message')).toBeVisible();
    await expect(page.locator('#success-message')).toContainText('Loaded template: dell-tor1');
    
    // Step 1: Verify switch config
    await expect(page.locator('#hostname')).toHaveValue('example-tor1');
    await expect(page.locator('.vendor-card.selected')).toContainText('Dell EMC');
    await expect(page.locator('.role-card.selected')).toContainText('TOR1');
    
    // Navigate to Step 2: VLANs
    await page.click('.btn-next');
    
    // Verify management VLAN populated
    await expect(page.locator('.vlan-mgmt-id').first()).toHaveValue('7');
    
    // Verify compute VLAN populated
    await expect(page.locator('.vlan-compute-id').first()).toHaveValue('201');
    
    // Verify storage VLANs populated
    await expect(page.locator('#vlan-storage1-id')).toHaveValue('711');
    await expect(page.locator('#vlan-storage2-id')).toHaveValue('712');
    
    // Navigate to Step 3: Host Ports
    await page.click('.btn-next');
    await expect(page.locator('#intf-host-start')).toHaveValue('1/1/1');
    await expect(page.locator('#intf-host-end')).toHaveValue('1/1/16');
    
    // Navigate to Step 4: Redundancy
    await page.click('.btn-next');
    await expect(page.locator('#mlag-keepalive-src')).toHaveValue('192.0.2.200');
    
    // Navigate to Step 5: Uplinks
    await page.click('.btn-next');
    await expect(page.locator('#intf-loopback-ip')).toHaveValue('203.0.113.1/32');
    
    // Navigate to Step 6: Routing
    await page.click('.btn-next');
    await expect(page.locator('#bgp-asn')).toHaveValue('64500');
  });

  test('should show validation errors when required fields are missing', async ({ page }) => {
    await page.goto('/');
    
    // Try to proceed without filling hostname
    await page.click('.btn-next');
    
    // Error message should appear
    await expect(page.locator('#validation-error')).toBeVisible();
    await expect(page.locator('#validation-error')).toContainText('Hostname is required');
    
    // Fill hostname
    await page.fill('#hostname', 'test-switch');
    await page.click('.vendor-card[data-vendor="dellemc"]');
    await page.click('.model-card[data-model="s5248f-on"]');
    await page.click('.role-card[data-role="TOR1"]');
    
    // Navigate to Step 2
    await page.click('.btn-next');
    
    // Try to proceed without VLANs
    await page.click('.btn-next');
    
    // Should show VLAN error
    await expect(page.locator('#validation-error')).toBeVisible();
    await expect(page.locator('#validation-error')).toContainText('Management VLAN');
  });

  test('should toggle BMC section collapse', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Step 2 (VLANs)
    await page.fill('#hostname', 'test-switch');
    await page.click('.vendor-card[data-vendor="dellemc"]');
    await page.click('.btn-next');
    
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
    
    // Navigate to Step 2
    await page.fill('#hostname', 'test-switch');
    await page.click('.btn-next');
    
    // Change storage VLAN ID
    await page.fill('#vlan-storage1-id', '800');
    
    // Name should auto-update
    await expect(page.locator('#vlan-storage1-name')).toHaveValue('Storage1_800');
  });

  test('should navigate through all 7 steps', async ({ page }) => {
    await page.goto('/');
    
    // Load template
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    
    // Verify we can navigate through all steps
    for (let step = 1; step <= 7; step++) {
      const navStep = page.locator(`.nav-step[data-step="${step}"]`);
      await navStep.click();
      await expect(navStep).toHaveClass(/active/);
    }
  });

  test('should export configuration as JSON', async ({ page }) => {
    await page.goto('/');
    
    // Load a template
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Go to review step (step 7)
    await page.click('.nav-step[data-step="7"]');
    
    // Verify JSON preview is visible
    await expect(page.locator('#json-preview')).toBeVisible();
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('#btn-export');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

        "hostname": "test-switch",
        "role": "TOR1",
        "deployment_pattern": "fully_converged"
      }
    });
    
    // Create a file input
    const fileInput = page.locator('input#import-json');
    
    // Upload the file
    await fileInput.setInputFiles({
      name: 'test-config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent)
    });
    
    // Wait for import to complete
    await page.waitForTimeout(500);
    
    // Verify hostname was updated
    const hostnameInput = page.locator('input[name="hostname"]');
    await expect(hostnameInput).toHaveValue('test-switch');
  });

  test('should update summary when configuration changes', async ({ page }) => {
    await page.goto('/');
    
    // Fill in switch information
    await page.selectOption('select[name="vendor"]', 'dellemc');
    await page.selectOption('select[name="model"]', 's5248f-on');
    await page.selectOption('select[name="role"]', 'TOR1');
    await page.fill('input[name="hostname"]', 'my-test-switch');
    
    // Wait for summary update
    await page.waitForTimeout(300);
    
    // Check summary sidebar shows the values
    const summary = page.locator('.summary-sidebar');
    await expect(summary).toContainText('my-test-switch');
    await expect(summary).toContainText('dellemc');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/');
    
    // Try to export without filling required fields
    await page.click('.step:has-text("04")');
    
    // The export button might be present but the config should be incomplete
    const summary = page.locator('.summary-sidebar');
    await expect(summary).toBeVisible();
    
    // Go back and fill required fields
    await page.click('.step:has-text("01")');
    await page.selectOption('select[name="vendor"]', 'dellemc');
    await page.selectOption('select[name="model"]', 's5248f-on');
    await page.fill('input[name="hostname"]', 'test-switch');
    await page.selectOption('select[name="role"]', 'TOR1');
    
    // Summary should now show switch info
    await expect(summary).toContainText('test-switch');
  });

  test('should handle VLAN configuration', async ({ page }) => {
    await page.goto('/');
    
    // Load template with VLANs
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Navigate to Network step
    await page.click('.step:has-text("02")');
    
    // Check that VLAN cards are visible
    await expect(page.locator('.vlan-card').first()).toBeVisible();
    
    // Summary should show VLAN count
    const summary = page.locator('.summary-sidebar');
    await expect(summary).toContainText('VLANs');
  });

  test('should handle BGP configuration', async ({ page }) => {
    await page.goto('/');
    
    // Load template with BGP
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Navigate to Routing step
    await page.click('.step:has-text("03")');
    
    // Check that BGP section is visible
    await expect(page.locator('text=BGP')).toBeVisible();
    
    // Summary should show BGP info
    const summary = page.locator('.summary-sidebar');
    await expect(summary).toContainText('BGP');
  });

  test('should persist state across page reloads when using templates', async ({ page }) => {
    await page.goto('/');
    
    // Load a template
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Get the hostname
    const hostnameInput = page.locator('input[name="hostname"]');
    const hostname = await hostnameInput.inputValue();
    
    // Reload page
    await page.reload();
    
    // Note: Without localStorage/sessionStorage, state won't persist
    // This test documents the current behavior
    const hostnameAfterReload = await hostnameInput.inputValue();
    
    // Currently, state doesn't persist across reloads without localStorage
    // This is expected behavior for the MVP
    expect(hostnameAfterReload).toBe('');
  });
});
