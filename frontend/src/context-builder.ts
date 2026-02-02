/**
 * Context Builder
 * 
 * Prepares template rendering context with helper flags and computed values.
 * TypeScript port of backend/src/context.py
 */

import { StandardConfig, VLAN, Interface } from './types';

/**
 * Template rendering context with all helper flags
 */
export interface RenderContext extends StandardConfig {
  // Section existence flags
  has_bgp: boolean;
  has_mlag: boolean;
  has_static_routes: boolean;
  has_prefix_lists: boolean;
  has_vlans: boolean;
  has_interfaces: boolean;
  has_port_channels: boolean;
  
  // QoS flag
  has_qos_interfaces: boolean;
  
  // Role-based helpers
  is_tor1: boolean;
  is_tor2: boolean;
  is_bmc: boolean;
  
  // Deployment pattern helpers
  is_fully_converged: boolean;
  is_switched: boolean;
  is_switchless: boolean;
  
  // Filtered VLAN lists
  storage_vlans: VLAN[];
  management_vlans: VLAN[];
  compute_vlans: VLAN[];
  
  // Convenience strings
  vlan_ids_string: string;
  storage_vlan_ids_string: string;
}

/**
 * Build template context from switch configuration
 * 
 * Adds helper flags and computed values for Jinja2/Nunjucks templates.
 * These helpers simplify template logic and enable conditional rendering.
 */
export function buildContext(config: StandardConfig): RenderContext {
  const context = { ...config } as RenderContext;
  
  // =================================================================
  // SECTION EXISTENCE FLAGS
  // =================================================================
  context.has_bgp = config.bgp !== undefined && config.bgp !== null;
  context.has_mlag = config.mlag !== undefined && config.mlag !== null;
  context.has_static_routes = (config.static_routes?.length ?? 0) > 0;
  context.has_prefix_lists = config.prefix_lists !== undefined && 
    Object.keys(config.prefix_lists || {}).length > 0;
  context.has_vlans = (config.vlans?.length ?? 0) > 0;
  context.has_interfaces = (config.interfaces?.length ?? 0) > 0;
  context.has_port_channels = (config.port_channels?.length ?? 0) > 0;
  
  // =================================================================
  // QoS - Interface-level, renders global config if any interface needs it
  // =================================================================
  const interfaces = config.interfaces || [];
  context.has_qos_interfaces = interfaces.some((intf: Interface) => intf.qos === true);
  
  // =================================================================
  // ROLE-BASED HELPERS
  // =================================================================
  const role = (config.switch?.role || '').toUpperCase();
  context.is_tor1 = role === 'TOR1';
  context.is_tor2 = role === 'TOR2';
  context.is_bmc = role === 'BMC';
  
  // =================================================================
  // DEPLOYMENT PATTERN HELPERS
  // =================================================================
  const pattern = config.switch?.deployment_pattern || 'fully_converged';
  context.is_fully_converged = pattern === 'fully_converged';
  context.is_switched = pattern === 'switched';
  context.is_switchless = pattern === 'switchless';
  
  // =================================================================
  // FILTERED VLAN LISTS
  // =================================================================
  const vlans = config.vlans || [];
  context.storage_vlans = getStorageVlans(vlans);
  context.management_vlans = getVlansByPurpose(vlans, 'management');
  context.compute_vlans = getVlansByPurpose(vlans, 'compute');
  
  // =================================================================
  // CONVENIENCE STRINGS
  // =================================================================
  context.vlan_ids_string = getVlanIdsString(vlans);
  context.storage_vlan_ids_string = getVlanIdsString(context.storage_vlans);
  
  return context;
}

/**
 * Filter VLANs with storage_1 or storage_2 purpose
 */
function getStorageVlans(vlans: VLAN[]): VLAN[] {
  return vlans.filter(v => v.purpose === 'storage_1' || v.purpose === 'storage_2');
}

/**
 * Filter VLANs by purpose
 */
function getVlansByPurpose(vlans: VLAN[], purpose: string): VLAN[] {
  return vlans.filter(v => v.purpose === purpose);
}

/**
 * Get comma-separated string of VLAN IDs (e.g., '10,20,30')
 */
function getVlanIdsString(vlans: VLAN[]): string {
  return vlans
    .map(v => v.vlan_id)
    .filter(id => id !== undefined)
    .join(',');
}
