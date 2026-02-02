/**
 * TypeScript type definitions for Azure Local Network Switch Configuration
 * Synced with backend/schema/standard.json
 * 
 * @see backend/schema/standard.json for authoritative schema
 */

// ============================================================================
// METADATA TYPE
// ============================================================================

/**
 * Optional metadata for tracking configuration generation
 */
export interface ConfigMetadata {
  description?: string;
  pattern?: string;
  generated_by?: string;
  version?: string;
}

// ============================================================================
// VENDOR & HARDWARE TYPES
// ============================================================================

export type Vendor = 'cisco' | 'dellemc';
export type Firmware = 'nxos' | 'os10';
export type Role = 'TOR1' | 'TOR2' | 'BMC';
export type DeploymentPattern = 'fully_converged' | 'switched' | 'switchless';

// ============================================================================
// VLAN TYPES
// ============================================================================

export type VLANPurpose = 'parking' | 'management' | 'compute' | 'storage_1' | 'storage_2' | 'bmc' | 'native';
export type RedundancyType = 'vrrp' | 'hsrp';

export interface VLANRedundancy {
  type: RedundancyType;
  group: number;
  priority: number;
  virtual_ip: string;
  preempt?: boolean;
}

export interface VLANInterface {
  ip: string;
  cidr: number;
  mtu?: number;
  redundancy?: VLANRedundancy;
  dhcp_relay?: string[];
}

export interface VLAN {
  vlan_id: number;
  name: string;
  purpose?: VLANPurpose;
  shutdown?: boolean;
  interface?: VLANInterface;
}

// ============================================================================
// INTERFACE TYPES
// ============================================================================

export type InterfaceType = 'Access' | 'Trunk' | 'L3';
export type PhysicalInterfaceType = 'Ethernet' | 'loopback' | 'port-channel';

export interface ServicePolicy {
  qos_input?: string;
  qos_output?: string;
}

/**
 * Physical or logical interface configuration
 * Supports single interface (intf) or range (start_intf/end_intf)
 */
export interface Interface {
  name: string;
  type: InterfaceType;
  description?: string;
  /** Physical interface type - REQUIRED */
  intf_type: PhysicalInterfaceType;
  intf?: string;
  start_intf?: string;
  end_intf?: string;
  access_vlan?: string;
  /** Native/untagged VLAN ID for trunk ports */
  native_vlan?: string;
  tagged_vlans?: string;
  ipv4?: string;
  mtu?: number;
  shutdown?: boolean;
  qos?: boolean;
  service_policy?: ServicePolicy;
}

// ============================================================================
// PORT CHANNEL TYPES
// ============================================================================

/**
 * Port aggregation (LAG/MLAG) configuration
 */
export interface PortChannel {
  id: number;
  description: string;
  type: 'Trunk' | 'L3' | 'Access';
  ipv4?: string;
  native_vlan?: string;
  tagged_vlans?: string;
  members: string[];
  /** Mark as VPC/MLAG peer-link between TOR switches */
  vpc_peer_link?: boolean;
  /** VPC ID for host-facing port-channels (Cisco vPC) */
  vpc_id?: number;
}

// ============================================================================
// MLAG/VPC TYPES
// ============================================================================

export interface MLAGPeerKeepalive {
  source_ip: string;
  destination_ip: string;
  vrf?: string;
}

/**
 * Multi-Chassis LAG configuration (Dell VLT / Cisco vPC)
 */
export interface MLAG {
  domain_id: number;
  peer_keepalive: MLAGPeerKeepalive;
  delay_restore?: number;
  peer_gateway?: boolean;
  auto_recovery?: boolean;
}

// ============================================================================
// ROUTING TYPES
// ============================================================================

/**
 * Static route entry (alternative to BGP)
 */
export interface StaticRoute {
  /** Target network in CIDR notation (e.g., "10.0.0.0/8") */
  destination: string;
  /** Gateway IP address */
  next_hop: string;
  /** Optional route description */
  name?: string;
  /** Administrative distance (default: 1) */
  admin_distance?: number;
}

export interface PrefixListEntry {
  seq: number;
  action: 'permit' | 'deny';
  prefix: string;
  prefix_filter?: string;
}

export type PrefixLists = Record<string, PrefixListEntry[]>;

export interface BGPNeighborAF {
  prefix_list_in?: string;
  prefix_list_out?: string;
}

export interface BGPNeighbor {
  ip: string;
  description: string;
  remote_as: number;
  /** Address-family IPv4 unicast settings - REQUIRED */
  af_ipv4_unicast: BGPNeighborAF;
}

export interface BGP {
  asn: number;
  router_id: string;
  networks?: string[];
  neighbors: BGPNeighbor[];
}

// ============================================================================
// SWITCH CONFIGURATION
// ============================================================================

export interface SwitchConfig {
  vendor: Vendor;
  model: string;
  firmware: Firmware;
  hostname: string;
  role: Role;
  version?: string;
  /** Deployment pattern - REQUIRED for proper port layout */
  deployment_pattern: DeploymentPattern;
  /** Template set for config generation */
  template_set?: string;
}

// ============================================================================
// MAIN CONFIGURATION TYPE
// ============================================================================

/**
 * Complete switch configuration matching backend/schema/standard.json
 * 
 * Note: QoS is interface-level (interfaces[].qos), not global.
 * Note: Login/credentials are hardcoded in templates, not in JSON.
 */
export interface StandardConfig {
  /** Optional metadata for tracking generation */
  _metadata?: ConfigMetadata;
  switch: SwitchConfig;
  vlans?: VLAN[];
  interfaces?: Interface[];
  port_channels?: PortChannel[];
  mlag?: MLAG;
  /** Static routes - alternative to BGP for simple deployments */
  static_routes?: StaticRoute[];
  prefix_lists?: PrefixLists;
  bgp?: BGP;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface WizardState {
  currentStep: number;
  config: Partial<StandardConfig>;
}
