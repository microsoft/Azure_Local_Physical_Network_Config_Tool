/**
 * Utility functions for the wizard
 */

import type { 
  Vendor, 
  Role, 
  RedundancyType, 
  RoleDefaults,
  SharedConfig,
  PerSwitchOverrides,
  StandardConfig,
  VLAN,
  DeploymentPattern
} from './types';
import JSZip from 'jszip';

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
 * Role-based defaults for TOR pair auto-derivation.
 * Reference: main branch test_cases (REDUNDANCY_PRIORITY_*, vlt.j2)
 * 
 * TOR1 = Active (higher priority), TOR2 = Standby (lower priority)
 */
export const TOR_PAIR_DEFAULTS: Record<'TOR1' | 'TOR2', RoleDefaults> = {
  'TOR1': {
    redundancy_priority: 150,  // HSRP/VRRP active
    mlag_priority: 1,          // VLT primary
    mst_priority: 8192
  },
  'TOR2': {
    redundancy_priority: 140,  // HSRP/VRRP standby (main branch: 140, not 100!)
    mlag_priority: 2,          // VLT secondary (main branch: 2, not 32667!)
    mst_priority: 16384
  }
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

// ============================================================================
// TOR PAIR GENERATION (Phase 13)
// ============================================================================

/**
 * Extract per-switch IP addresses from a StandardConfig.
 * Used when loading template pairs to populate TOR1/TOR2 UI fields.
 * 
 * @param config - A complete StandardConfig (e.g., from sample-tor1.json)
 * @returns PerSwitchOverrides containing hostname, loopback, uplinks, keepalive, SVI IPs
 */
export function extractPerSwitchOverrides(config: StandardConfig): PerSwitchOverrides {
  // Find loopback interface
  const loopback = config.interfaces?.find(i => i.intf_type === 'loopback');
  
  // Find L3 uplink interfaces (Ethernet type with IP)
  const uplinks = config.interfaces?.filter(i => 
    i.type === 'L3' && i.intf_type === 'Ethernet' && i.ipv4
  ) || [];
  
  // Find iBGP port-channel (L3, not peer-link)
  const ibgpPc = config.port_channels?.find(pc => 
    pc.type === 'L3' && !pc.vpc_peer_link && pc.ipv4
  );
  
  // Extract SVI IPs from VLANs
  const svi_ips: Record<number, string> = {};
  config.vlans?.forEach(vlan => {
    if (vlan.interface?.ip) {
      svi_ips[vlan.vlan_id] = vlan.interface.ip;
    }
  });
  
  return {
    hostname: config.switch?.hostname || '',
    loopback_ip: loopback?.ipv4,
    uplink1_ip: uplinks[0]?.ipv4,
    uplink2_ip: uplinks[1]?.ipv4,
    ibgp_pc_ip: ibgpPc?.ipv4,
    keepalive_source_ip: config.mlag?.peer_keepalive?.source_ip,
    keepalive_dest_ip: config.mlag?.peer_keepalive?.destination_ip,
    bgp_router_id: config.bgp?.router_id,
    svi_ips
  };
}

/**
 * Extract base hostname from a TOR hostname.
 * e.g., "sample-tor1" → "sample", "azl-rack01-tor2" → "azl-rack01"
 */
export function extractBaseHostname(hostname: string): string {
  return hostname.replace(/-tor[12]$/i, '');
}

/**
 * Build a StandardConfig for a specific TOR role from shared settings + overrides.
 * Applies auto-derivation rules based on role.
 * 
 * @param shared - Shared configuration (VLANs, ports, MLAG domain, BGP ASN, etc.)
 * @param overrides - Per-switch overrides (hostname, IPs)
 * @param role - Switch role ('TOR1' or 'TOR2')
 * @returns Complete StandardConfig for the specified role
 */
export function buildTorConfig(
  shared: SharedConfig,
  overrides: PerSwitchOverrides,
  role: 'TOR1' | 'TOR2'
): StandardConfig {
  const defaults = TOR_PAIR_DEFAULTS[role];
  const redundancyType = VENDOR_REDUNDANCY_TYPE[shared.vendor];
  
  // Filter VLANs based on pattern and role for switched pattern
  const filteredVlans = filterVlansForRole(shared.vlans, shared.deployment_pattern, role);
  
  // Apply redundancy settings to VLANs with SVI
  const vlansWithRedundancy = filteredVlans.map(vlan => {
    if (!vlan.interface) return vlan;
    
    // Get SVI IP from overrides or keep original
    const sviIp = overrides.svi_ips?.[vlan.vlan_id];
    
    return {
      ...vlan,
      interface: {
        ...vlan.interface,
        ip: sviIp || vlan.interface.ip,
        redundancy: vlan.interface.redundancy ? {
          ...vlan.interface.redundancy,
          type: redundancyType,
          priority: defaults.redundancy_priority
        } : undefined
      }
    };
  });
  
  // Build MLAG config with swapped keepalive for TOR2
  const mlag = shared.mlag_domain_id ? {
    domain_id: shared.mlag_domain_id,
    peer_keepalive: {
      source_ip: overrides.keepalive_source_ip || '',
      destination_ip: overrides.keepalive_dest_ip || '',
      vrf: 'management'
    },
    delay_restore: 300,
    peer_gateway: true,
    auto_recovery: true
  } : undefined;
  
  // Build BGP config
  const bgp = shared.bgp_asn ? {
    asn: shared.bgp_asn,
    router_id: overrides.bgp_router_id || overrides.loopback_ip?.replace('/32', '') || '',
    networks: overrides.loopback_ip ? [overrides.loopback_ip] : [],
    neighbors: shared.bgp_neighbors || []
  } : undefined;
  
  // Update interfaces with per-switch IPs (loopback and uplinks)
  const interfaces = shared.interfaces.map((iface) => {
    // Update loopback IP
    if (iface.intf_type === 'loopback' && overrides.loopback_ip) {
      return {
        ...iface,
        ipv4: overrides.loopback_ip
      };
    }
    
    // Update uplink IPs - match by interface name or position
    if (iface.type === 'L3' && iface.intf_type === 'Ethernet') {
      const isUplink1 = iface.name?.toLowerCase().includes('uplink1') || 
                        iface.description?.toLowerCase().includes('uplink1') ||
                        iface.intf === '1/1/47';
      const isUplink2 = iface.name?.toLowerCase().includes('uplink2') || 
                        iface.description?.toLowerCase().includes('uplink2') ||
                        iface.intf === '1/1/48';
      
      if (isUplink1 && overrides.uplink1_ip) {
        return { ...iface, ipv4: overrides.uplink1_ip };
      }
      if (isUplink2 && overrides.uplink2_ip) {
        return { ...iface, ipv4: overrides.uplink2_ip };
      }
    }
    
    return iface;
  });
  
  // Update port-channels with per-switch iBGP IP
  const portChannels = shared.port_channels?.map(pc => {
    // Check if this is the iBGP port-channel (by description or L3 type without peer-link)
    const isIbgpPc = pc.description?.toLowerCase().includes('ibgp') ||
                     (pc.type === 'L3' && !pc.vpc_peer_link);
    
    if (isIbgpPc && overrides.ibgp_pc_ip) {
      return { ...pc, ipv4: overrides.ibgp_pc_ip };
    }
    return pc;
  }) || [];
  
  return {
    _metadata: {
      description: `${role} configuration for ${shared.base_hostname || overrides.hostname}`,
      pattern: shared.deployment_pattern,
      generated_by: 'Azure Local Config Wizard',
      version: '1.0.0'
    },
    switch: {
      vendor: shared.vendor,
      model: shared.model,
      firmware: shared.firmware,
      hostname: overrides.hostname,
      role: role,
      deployment_pattern: shared.deployment_pattern
    },
    vlans: vlansWithRedundancy,
    interfaces: interfaces,
    port_channels: portChannels,
    mlag: mlag,
    bgp: bgp,
    static_routes: shared.static_routes,
    prefix_lists: shared.prefix_lists
  };
}

/**
 * Filter VLANs based on deployment pattern and role.
 * - Switched pattern: TOR1 gets S1 (711), TOR2 gets S2 (712)
 * - Fully converged: Both get all storage VLANs
 * - Switchless: No storage VLANs
 * 
 * @param vlans - All defined VLANs
 * @param pattern - Deployment pattern
 * @param role - Switch role
 * @returns Filtered VLANs for the specific role
 */
export function filterVlansForRole(
  vlans: VLAN[],
  pattern: DeploymentPattern,
  role: 'TOR1' | 'TOR2'
): VLAN[] {
  if (pattern === 'switchless') {
    // No storage VLANs in switchless pattern
    return vlans.filter(v => v.purpose !== 'storage_1' && v.purpose !== 'storage_2');
  }
  
  if (pattern === 'switched') {
    // Switched pattern: TOR1 gets storage_1 (S1/711), TOR2 gets storage_2 (S2/712)
    return vlans.filter(v => {
      if (v.purpose === 'storage_1') return role === 'TOR1';
      if (v.purpose === 'storage_2') return role === 'TOR2';
      return true;
    });
  }
  
  // Fully converged: both get all VLANs
  return vlans;
}

/**
 * Generate hostname from base name and role.
 * "azl-rack01" + "TOR1" → "azl-rack01-tor1"
 */
export function generateHostname(baseName: string, role: 'TOR1' | 'TOR2'): string {
  const suffix = role.toLowerCase();
  // If base name already ends with -tor1 or -tor2, replace it
  const cleanBase = baseName.replace(/-tor[12]$/i, '');
  return `${cleanBase}-${suffix}`;
}

/**
 * Swap keepalive IPs for TOR2 (TOR2's source = TOR1's dest, TOR2's dest = TOR1's source)
 */
export function swapKeepaliveIps(tor1Source: string, tor1Dest: string): { source: string; dest: string } {
  return {
    source: tor1Dest,
    dest: tor1Source
  };
}

/**
 * Generate and download a ZIP file containing TOR pair configs.
 * 
 * @param tor1Config - StandardConfig for TOR1
 * @param tor2Config - StandardConfig for TOR2
 * @param tor1Cfg - Rendered .cfg content for TOR1
 * @param tor2Cfg - Rendered .cfg content for TOR2
 * @param baseName - Base name for the ZIP file
 * @param pattern - Deployment pattern for filename
 */
export async function downloadTorPairZip(
  tor1Config: StandardConfig,
  tor2Config: StandardConfig,
  tor1Cfg: string,
  tor2Cfg: string,
  baseName: string,
  pattern: DeploymentPattern
): Promise<void> {
  const zip = new JSZip();
  
  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  
  // Create filenames
  const tor1JsonName = `${baseName}-tor1-config.json`;
  const tor2JsonName = `${baseName}-tor2-config.json`;
  const tor1CfgName = `${baseName}-tor1.cfg`;
  const tor2CfgName = `${baseName}-tor2.cfg`;
  
  // Add files to ZIP
  zip.file(tor1JsonName, JSON.stringify(tor1Config, null, 2));
  zip.file(tor2JsonName, JSON.stringify(tor2Config, null, 2));
  zip.file(tor1CfgName, tor1Cfg);
  zip.file(tor2CfgName, tor2Cfg);
  
  // Generate ZIP filename: {baseName}_{pattern}_{timestamp}.zip
  const zipFilename = `${baseName}_${pattern}_${timestamp}.zip`;
  
  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate that per-switch overrides are complete
 */
export function validatePerSwitchOverrides(overrides: PerSwitchOverrides, switchLabel: string): string[] {
  const errors: string[] = [];
  
  if (!overrides.hostname || overrides.hostname.trim() === '') {
    errors.push(`${switchLabel}: Hostname is required`);
  }
  
  // Hostname format validation
  if (overrides.hostname && !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(overrides.hostname)) {
    errors.push(`${switchLabel}: Hostname must start with a letter and contain only letters, numbers, and hyphens`);
  }
  
  return errors;
}
