/**
 * Utility functions for the wizard
 */

import type { Vendor, Role, RedundancyType } from './types';

// Display name mappings
export const DISPLAY_NAMES = {
  vendors: {
    'dellemc': 'Dell EMC',
    'cisco': 'Cisco'
  },
  models: {
    's5248f-on': 'S5248F-ON',
    's5232f-on': 'S5232F-ON',
    '93180yc-fx': '93180YC-FX',
    '9336c-fx2': '9336C-FX2'
  },
  roles: {
    'TOR1': 'TOR1 (Primary)',
    'TOR2': 'TOR2 (Secondary)',
    'BMC': 'BMC (Management)'
  },
  patterns: {
    'fully_converged': 'Fully Converged',
    'switched': 'Storage Switched',
    'switchless': 'Switchless'
  },
  routingTypes: {
    'bgp': 'BGP (Dynamic)',
    'static': 'Static Routes'
  },
  vlanPurposes: {
    'parking': 'Parking (Unused)',
    'management': 'Management',
    'compute': 'Compute',
    'storage_1': 'Storage 1',
    'storage_2': 'Storage 2',
    'bmc': 'BMC'
  }
} as const;

// Vendor firmware mappings
export const VENDOR_FIRMWARE_MAP: Record<Vendor, string> = {
  'dellemc': 'os10',
  'cisco': 'nxos'
};

// Vendor redundancy type mappings
export const VENDOR_REDUNDANCY_TYPE: Record<Vendor, RedundancyType> = {
  'dellemc': 'vrrp',
  'cisco': 'hsrp'
};

// Role-based defaults
export const ROLE_DEFAULTS: Record<Role, { hsrp_priority: number | null; mlag_role_priority: number | null; mst_priority: number }> = {
  'TOR1': { hsrp_priority: 150, mlag_role_priority: 1, mst_priority: 8192 },
  'TOR2': { hsrp_priority: 100, mlag_role_priority: 32667, mst_priority: 16384 },
  'BMC': { hsrp_priority: null, mlag_role_priority: null, mst_priority: 32768 }
};

/**
 * Get elements by selector
 */
export function getElement<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

/**
 * Get all elements by selector
 */
export function getElements<T extends HTMLElement>(selector: string): NodeListOf<T> {
  return document.querySelectorAll<T>(selector);
}

/**
 * Get input value safely
 */
export function getInputValue(selector: string): string {
  const element = getElement<HTMLInputElement>(selector);
  return element?.value?.trim() || '';
}

/**
 * Set input value safely
 */
export function setInputValue(selector: string, value: string): void {
  const element = getElement<HTMLInputElement>(selector);
  if (element) {
    element.value = value;
  }
}

/**
 * Show/hide element
 */
export function toggleElement(selector: string, show: boolean): void {
  const element = getElement(selector);
  if (element) {
    element.style.display = show ? '' : 'none';
  }
}

/**
 * Download data as JSON file
 */
export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Parse integer safely
 */
export function parseIntSafe(value: string | undefined, defaultValue = 0): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Format JSON for display
 */
export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
