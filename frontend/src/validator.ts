/**
 * Configuration validation using Ajv and JSON Schema
 * 
 * Provides:
 * - Schema validation against standard.json
 * - Azure Local business rule validation (peer-link storage VLAN rules)
 * - IP address format validation helpers
 */

import Ajv from 'ajv';
import type { StandardConfig, ValidationResult, ValidationError, VLAN, PortChannel, DeploymentPattern } from './types';
import standardSchema from '../../backend/schema/standard.json';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(standardSchema);

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

/**
 * Validate configuration against JSON schema
 */
export function validateConfig(config: StandardConfig): ValidationResult {
  const valid = validate(config);
  
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors || []).map((err: any) => ({
    path: err.instancePath || err.schemaPath || '',
    message: err.message || 'Unknown validation error'
  }));

  return { valid: false, errors };
}

// ============================================================================
// AZURE LOCAL BUSINESS RULES
// ============================================================================

/**
 * Extract storage VLAN IDs from VLAN list
 * Storage VLANs have purpose: storage_1 or storage_2
 */
export function getStorageVlanIds(vlans: VLAN[]): number[] {
  return vlans
    .filter(v => v.purpose === 'storage_1' || v.purpose === 'storage_2')
    .map(v => v.vlan_id);
}

/**
 * Parse tagged_vlans string into array of VLAN IDs
 * Handles comma-separated format: "10,20,30"
 */
export function parseTaggedVlans(taggedVlans?: string): number[] {
  if (!taggedVlans) return [];
  return taggedVlans
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(v => !isNaN(v));
}

/**
 * Find the peer-link port-channel (vpc_peer_link: true)
 */
export function findPeerLink(portChannels: PortChannel[]): PortChannel | undefined {
  return portChannels.find(pc => pc.vpc_peer_link === true);
}

/**
 * Validate peer-link does not carry storage VLANs
 * 
 * AZURE LOCAL RULE: For "switched" deployment pattern, storage traffic
 * must NOT traverse the peer-link between TOR switches. This ensures
 * storage traffic stays within the direct server-to-switch path.
 * 
 * For "fully_converged" pattern, storage VLANs ARE allowed on peer-link.
 * 
 * @param vlans - All configured VLANs
 * @param portChannels - All port-channels including peer-link
 * @param deploymentPattern - Current deployment pattern
 * @returns Validation result with error if storage VLANs found on peer-link
 */
export function validatePeerLinkVlans(
  vlans: VLAN[],
  portChannels: PortChannel[],
  deploymentPattern: DeploymentPattern
): ValidationResult {
  // Only enforce for 'switched' pattern - fully_converged allows storage on peer-link
  if (deploymentPattern !== 'switched') {
    return { valid: true, errors: [] };
  }

  const peerLink = findPeerLink(portChannels);
  if (!peerLink) {
    // No peer-link configured - nothing to validate
    return { valid: true, errors: [] };
  }

  const storageVlanIds = getStorageVlanIds(vlans);
  if (storageVlanIds.length === 0) {
    // No storage VLANs configured - nothing to validate
    return { valid: true, errors: [] };
  }

  const peerLinkVlans = parseTaggedVlans(peerLink.tagged_vlans);
  const violatingVlans = storageVlanIds.filter(id => peerLinkVlans.includes(id));

  if (violatingVlans.length > 0) {
    return {
      valid: false,
      errors: [{
        path: '/port_channels/peer_link/tagged_vlans',
        message: `Peer-link must NOT carry storage VLANs for Switched deployment pattern. ` +
                 `Remove storage VLAN(s) ${violatingVlans.join(', ')} from peer-link. ` +
                 `Storage traffic should stay on direct server-to-switch paths.`
      }]
    };
  }

  return { valid: true, errors: [] };
}

// ============================================================================
// IP ADDRESS VALIDATION HELPERS
// ============================================================================

/**
 * Validate IPv4 address format
 */
export function isValidIPv4(ip?: string): boolean {
  if (!ip) return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part;
  });
}

/**
 * Validate CIDR notation
 */
export function isValidCIDR(cidr?: string): boolean {
  if (!cidr) return false;
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  if (!isValidIPv4(parts[0])) return false;
  const prefixStr = parts[1];
  if (!prefixStr) return false;
  const prefix = parseInt(prefixStr, 10);
  return !isNaN(prefix) && prefix >= 0 && prefix <= 32;
}
