/**
 * Client-Side Config Renderer
 * 
 * Uses Nunjucks to render switch configurations directly in the browser.
 * No backend server required.
 */

import nunjucks from 'nunjucks';
import { TEMPLATES, getTemplate, hasTemplate } from './templates';
import { buildContext } from './context-builder';
import { StandardConfig } from './types';

/**
 * Custom Nunjucks loader that loads templates from our bundled TEMPLATES object
 */
const templateLoader = {
  getSource: function(name: string) {
    // Handle paths with or without leading slash
    const normalizedName = name.replace(/^\//, '');
    
    if (hasTemplate(normalizedName)) {
      return {
        src: getTemplate(normalizedName),
        path: normalizedName,
        noCache: false
      };
    }
    // Return a template that throws an error for missing templates
    return {
      src: `{% set error = "Template not found: ${normalizedName}" %}{{ error }}`,
      path: normalizedName,
      noCache: false
    };
  }
};

// Configure Nunjucks environment
// Use 'as any' to work around TypeScript type issues with custom loaders
const env = new nunjucks.Environment(templateLoader as any, {
  autoescape: false,  // Don't escape output (we're generating config, not HTML)
  trimBlocks: true,   // Remove first newline after block tags
  lstripBlocks: true  // Strip leading whitespace before block tags
});

/**
 * Result of config generation
 */
export interface GenerateResult {
  success: boolean;
  config?: string;
  filename?: string;
  error?: string;
}

/**
 * Determine the firmware path based on vendor
 */
function getFirmwarePath(vendor: string): string {
  const firmwareMap: Record<string, string> = {
    'dellemc': 'os10',
    'cisco': 'nxos',
    // Add more vendors here as needed
  };
  return firmwareMap[vendor.toLowerCase()] || vendor.toLowerCase();
}

/**
 * Generate switch configuration from JSON config
 * 
 * This is the main entry point for client-side config generation.
 * It validates the config, builds context, and renders the template.
 */
export function generateConfig(config: StandardConfig): GenerateResult {
  try {
    // Validate required fields
    if (!config.switch?.vendor) {
      return { success: false, error: 'Missing required field: switch.vendor' };
    }
    if (!config.switch?.hostname) {
      return { success: false, error: 'Missing required field: switch.hostname' };
    }
    
    const vendor = config.switch.vendor.toLowerCase();
    const firmware = getFirmwarePath(vendor);
    const hostname = config.switch.hostname;
    
    // Build the template path
    const templatePath = `${vendor}/${firmware}/full_config.j2`;
    
    if (!hasTemplate(templatePath)) {
      return { 
        success: false, 
        error: `Template not found: ${templatePath}. Supported vendors: dellemc (OS10), cisco (NX-OS)` 
      };
    }
    
    // Build context with helper flags
    const context = buildContext(config);
    
    // Render the template
    const renderedConfig = env.render(templatePath, context);
    
    // Clean up excessive blank lines (more than 2 consecutive)
    const cleanedConfig = renderedConfig.replace(/\n{3,}/g, '\n\n');
    
    return {
      success: true,
      config: cleanedConfig,
      filename: `${hostname}.cfg`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Template rendering failed: ${errorMessage}`
    };
  }
}

/**
 * Get list of supported vendors
 */
export function getSupportedVendors(): string[] {
  const vendors = new Set<string>();
  Object.keys(TEMPLATES).forEach(path => {
    const vendor = path.split('/')[0];
    if (vendor) {
      vendors.add(vendor);
    }
  });
  return Array.from(vendors);
}

/**
 * Check if a vendor is supported
 */
export function isVendorSupported(vendor: string): boolean {
  const normalizedVendor = vendor.toLowerCase();
  return Object.keys(TEMPLATES).some(path => 
    path.toLowerCase().startsWith(normalizedVendor + '/')
  );
}
