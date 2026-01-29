/**
 * Configuration validation using Ajv and JSON Schema
 */

import Ajv from 'ajv';
import type { StandardConfig, ValidationResult, ValidationError } from './types';
import standardSchema from '../../backend/schema/standard.json';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(standardSchema);

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
