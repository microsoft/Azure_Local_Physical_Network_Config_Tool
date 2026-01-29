/**
 * Azure Local Network Config Wizard
 * Schema validation (synced from backend/schema/standard.json)
 */

// Schema definition (subset for frontend validation)
const SCHEMA = {
    switch: {
        required: ['vendor', 'model', 'hostname', 'role', 'firmware'],
        vendors: ['cisco', 'dellemc'],
        roles: ['TOR1', 'TOR2', 'BMC'],
        firmwares: ['nxos', 'os10'],
        deploymentPatterns: ['fully_converged', 'switched', 'switchless']
    },
    vlans: {
        minVlanId: 2,
        maxVlanId: 4094,
        purposes: ['management', 'compute', 'storage_1', 'storage_2', 'native', 'parking'],
        redundancyTypes: ['hsrp', 'vrrp']
    },
    interfaces: {
        types: ['Access', 'Trunk', 'L3'],
        intfTypes: ['Ethernet', 'loopback']
    },
    portChannels: {
        minId: 1,
        maxId: 4096,
        types: ['Trunk', 'L3', 'Access']
    },
    bgp: {
        minAsn: 1,
        maxAsn: 4294967295
    }
};

/**
 * Validate a configuration object against the schema
 * @param {Object} config - The configuration to validate
 * @returns {Array} - Array of error messages (empty if valid)
 */
function validateConfig(config) {
    const errors = [];
    
    // Validate switch section
    if (!config.switch) {
        errors.push('Missing required "switch" section');
        return errors;
    }
    
    // Required switch fields
    SCHEMA.switch.required.forEach(field => {
        if (!config.switch[field]) {
            errors.push(`Missing required switch field: ${field}`);
        }
    });
    
    // Vendor validation
    if (config.switch.vendor && !SCHEMA.switch.vendors.includes(config.switch.vendor)) {
        errors.push(`Invalid vendor: ${config.switch.vendor}. Must be one of: ${SCHEMA.switch.vendors.join(', ')}`);
    }
    
    // Role validation
    if (config.switch.role && !SCHEMA.switch.roles.includes(config.switch.role)) {
        errors.push(`Invalid role: ${config.switch.role}. Must be one of: ${SCHEMA.switch.roles.join(', ')}`);
    }
    
    // Firmware validation
    if (config.switch.firmware && !SCHEMA.switch.firmwares.includes(config.switch.firmware)) {
        errors.push(`Invalid firmware: ${config.switch.firmware}. Must be one of: ${SCHEMA.switch.firmwares.join(', ')}`);
    }
    
    // Hostname validation
    if (config.switch.hostname) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(config.switch.hostname)) {
            errors.push('Invalid hostname format');
        }
        if (config.switch.hostname.length > 64) {
            errors.push('Hostname exceeds 64 characters');
        }
    }
    
    // Validate VLANs
    if (config.vlans && Array.isArray(config.vlans)) {
        const vlanIds = new Set();
        
        config.vlans.forEach((vlan, index) => {
            if (!vlan.vlan_id) {
                errors.push(`VLAN at index ${index}: missing vlan_id`);
            } else {
                if (vlan.vlan_id < SCHEMA.vlans.minVlanId || vlan.vlan_id > SCHEMA.vlans.maxVlanId) {
                    errors.push(`VLAN ${vlan.vlan_id}: ID must be between ${SCHEMA.vlans.minVlanId} and ${SCHEMA.vlans.maxVlanId}`);
                }
                if (vlanIds.has(vlan.vlan_id)) {
                    errors.push(`VLAN ${vlan.vlan_id}: duplicate VLAN ID`);
                }
                vlanIds.add(vlan.vlan_id);
            }
            
            if (!vlan.name) {
                errors.push(`VLAN at index ${index}: missing name`);
            }
            
            if (vlan.purpose && !SCHEMA.vlans.purposes.includes(vlan.purpose)) {
                errors.push(`VLAN ${vlan.vlan_id}: invalid purpose "${vlan.purpose}"`);
            }
        });
    }
    
    // Validate interfaces
    if (config.interfaces && Array.isArray(config.interfaces)) {
        config.interfaces.forEach((intf, index) => {
            if (!intf.name) {
                errors.push(`Interface at index ${index}: missing name`);
            }
            if (!intf.type || !SCHEMA.interfaces.types.includes(intf.type)) {
                errors.push(`Interface ${intf.name || index}: invalid type "${intf.type}"`);
            }
            if (!intf.intf_type || !SCHEMA.interfaces.intfTypes.includes(intf.intf_type)) {
                errors.push(`Interface ${intf.name || index}: invalid intf_type "${intf.intf_type}"`);
            }
            
            // Type-specific validations
            if (intf.type === 'Access' && !intf.access_vlan) {
                errors.push(`Interface ${intf.name || index}: Access type requires access_vlan`);
            }
            if (intf.type === 'Trunk' && !intf.native_vlan) {
                errors.push(`Interface ${intf.name || index}: Trunk type requires native_vlan`);
            }
            if (intf.type === 'L3' && !intf.ipv4) {
                errors.push(`Interface ${intf.name || index}: L3 type requires ipv4`);
            }
        });
    }
    
    // Validate port channels
    if (config.port_channels && Array.isArray(config.port_channels)) {
        config.port_channels.forEach((pc, index) => {
            if (!pc.id) {
                errors.push(`Port-channel at index ${index}: missing id`);
            } else if (pc.id < SCHEMA.portChannels.minId || pc.id > SCHEMA.portChannels.maxId) {
                errors.push(`Port-channel ${pc.id}: ID must be between ${SCHEMA.portChannels.minId} and ${SCHEMA.portChannels.maxId}`);
            }
            
            if (!pc.type || !SCHEMA.portChannels.types.includes(pc.type)) {
                errors.push(`Port-channel ${pc.id || index}: invalid type "${pc.type}"`);
            }
            
            if (!pc.members || !Array.isArray(pc.members) || pc.members.length === 0) {
                errors.push(`Port-channel ${pc.id || index}: requires at least one member`);
            }
        });
    }
    
    // Validate MLAG (required for TOR1/TOR2)
    if (config.switch.role && ['TOR1', 'TOR2'].includes(config.switch.role)) {
        if (!config.mlag) {
            errors.push('MLAG configuration required for TOR switches');
        } else if (!config.mlag.peer_keepalive) {
            errors.push('MLAG peer_keepalive configuration required');
        } else {
            if (!config.mlag.peer_keepalive.source_ip) {
                errors.push('MLAG peer_keepalive.source_ip required');
            }
            if (!config.mlag.peer_keepalive.destination_ip) {
                errors.push('MLAG peer_keepalive.destination_ip required');
            }
        }
        
        // Check for peer-link port-channel
        if (config.port_channels) {
            const hasPeerLink = config.port_channels.some(pc => pc.vpc_peer_link);
            if (!hasPeerLink) {
                errors.push('MLAG requires a port-channel with vpc_peer_link: true');
            }
        }
    }
    
    // Validate BGP
    if (config.bgp) {
        if (!config.bgp.asn) {
            errors.push('BGP requires asn');
        } else if (config.bgp.asn < SCHEMA.bgp.minAsn || config.bgp.asn > SCHEMA.bgp.maxAsn) {
            errors.push(`BGP ASN must be between ${SCHEMA.bgp.minAsn} and ${SCHEMA.bgp.maxAsn}`);
        }
        
        if (!config.bgp.router_id) {
            errors.push('BGP requires router_id');
        }
        
        if (!config.bgp.neighbors || !Array.isArray(config.bgp.neighbors) || config.bgp.neighbors.length === 0) {
            errors.push('BGP requires at least one neighbor');
        } else {
            config.bgp.neighbors.forEach((neighbor, index) => {
                if (!neighbor.ip) {
                    errors.push(`BGP neighbor at index ${index}: missing ip`);
                }
                if (!neighbor.remote_as) {
                    errors.push(`BGP neighbor ${neighbor.ip || index}: missing remote_as`);
                }
            });
        }
        
        // Cross-reference: router_id should match loopback
        if (config.bgp.router_id && config.interfaces) {
            const loopback = config.interfaces.find(i => i.intf_type === 'loopback');
            if (loopback && loopback.ipv4) {
                const loopbackIp = loopback.ipv4.split('/')[0];
                if (loopbackIp !== config.bgp.router_id) {
                    errors.push(`BGP router_id (${config.bgp.router_id}) should match Loopback0 IP (${loopbackIp})`);
                }
            }
        }
    }
    
    // Validate cross-references: VLANs referenced in interfaces must exist
    if (config.interfaces && config.vlans) {
        const vlanIds = new Set(config.vlans.map(v => String(v.vlan_id)));
        
        config.interfaces.forEach(intf => {
            if (intf.access_vlan && !vlanIds.has(intf.access_vlan)) {
                errors.push(`Interface ${intf.name}: references non-existent VLAN ${intf.access_vlan}`);
            }
            if (intf.native_vlan && !vlanIds.has(intf.native_vlan)) {
                // Allow common native VLANs like 99 that might not be in the list
                if (!['99', '1'].includes(intf.native_vlan)) {
                    errors.push(`Interface ${intf.name}: references non-existent native VLAN ${intf.native_vlan}`);
                }
            }
        });
    }
    
    return errors;
}

/**
 * Check if a value is a valid IPv4 address
 * @param {string} ip - IP address to validate
 * @returns {boolean}
 */
function isValidIPv4(ip) {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
        const num = parseInt(part, 10);
        return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part;
    });
}

/**
 * Check if a value is a valid CIDR notation
 * @param {string} cidr - CIDR notation (e.g., "10.0.0.1/24")
 * @returns {boolean}
 */
function isValidCIDR(cidr) {
    if (!cidr) return false;
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;
    if (!isValidIPv4(parts[0])) return false;
    const prefix = parseInt(parts[1], 10);
    return !isNaN(prefix) && prefix >= 0 && prefix <= 32;
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateConfig, isValidIPv4, isValidCIDR, SCHEMA };
}
