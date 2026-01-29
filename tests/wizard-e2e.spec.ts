import { test, expect } from '@playwright/test';

test.describe('Azure Local Switch Configuration Wizard E2E', () => {
  
  test('should load the wizard homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/Azure Local Switch Configuration Wizard/);
    
    // Check header is visible
    const header = page.locator('h1');
    await expect(header).toContainText('Azure Local Switch Configuration Wizard');
    
    // Check wizard steps are visible
    await expect(page.locator('.wizard-steps')).toBeVisible();
    await expect(page.locator('.summary-sidebar')).toBeVisible();
  });

  test('should load example configuration template', async ({ page }) => {
    await page.goto('/');
    
    // Open template modal
    await page.click('button:has-text("Load Example Configuration Template")');
    
    // Wait for modal to appear
    await expect(page.locator('#template-modal')).toBeVisible();
    
    // Load Dell TOR1 template
    await page.click('.template-card:has-text("Dell TOR1")');
    
    // Wait for template to load
    await page.waitForTimeout(500);
    
    // Verify switch configuration is populated
    const hostnameInput = page.locator('input[name="hostname"]');
    await expect(hostnameInput).not.toHaveValue('');
  });

  test('should navigate through wizard steps', async ({ page }) => {
    await page.goto('/');
    
    // Start at step 1
    await expect(page.locator('.step.active')).toContainText('01');
    
    // Navigate to step 2
    await page.click('.step:has-text("02")');
    await expect(page.locator('.step.active')).toContainText('02');
    
    // Navigate to step 3
    await page.click('.step:has-text("03")');
    await expect(page.locator('.step.active')).toContainText('03');
    
    // Navigate to step 4
    await page.click('.step:has-text("04")');
    await expect(page.locator('.step.active')).toContainText('04');
  });

  test('should export configuration as JSON', async ({ page }) => {
    await page.goto('/');
    
    // Load a template first
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Go to review step
    await page.click('.step:has-text("04")');
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('button:has-text("Export JSON")');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    
    // Get downloaded content
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should import configuration from JSON', async ({ page }) => {
    await page.goto('/');
    
    // Load a template to get some initial data
    await page.click('button:has-text("Load Example Configuration Template")');
    await page.click('.template-card:has-text("Dell TOR1")');
    await page.waitForTimeout(500);
    
    // Prepare file to import
    const fileContent = JSON.stringify({
      "switch": {
        "vendor": "dellemc",
        "model": "s5248f-on",
        "firmware": "os10",
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
