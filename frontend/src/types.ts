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
// TOR PAIR CONFIGURATION (Phase 13)
// ============================================================================

/**
 * Per-switch overrides for TOR pair generation.
 * These are the only fields that differ between TOR1 and TOR2.
 */
export interface PerSwitchOverrides {
  /** Switch hostname (e.g., "azl-rack01-tor1") */
  hostname: string;
  /** Loopback IP address (e.g., "10.255.0.1/32") */
  loopback_ip?: string;
  /** SVI IPs for each VLAN - keyed by VLAN ID */
  svi_ips?: Record<number, string>;
  /** Uplink 1 IP (e.g., "10.100.0.1/30") - NO auto-derivation */
  uplink1_ip?: string;
  /** Uplink 2 IP (optional, e.g., "10.100.0.9/30") - NO auto-derivation */
  uplink2_ip?: string;
  /** iBGP port-channel IP (peer-link point-to-point) */
  ibgp_pc_ip?: string;
  /** MLAG keepalive source IP */
  keepalive_source_ip?: string;
  /** MLAG keepalive destination IP */
  keepalive_dest_ip?: string;
  /** BGP router ID (typically same as loopback) */
  bgp_router_id?: string;
  /** iBGP peer IP (the other ToR's loopback) */
  ibgp_peer_ip?: string;
}

/**
 * Shared configuration entered once for both ToR switches.
 * Pattern, vendor, VLANs, ports, MLAG domain, BGP ASN are shared.
 */
export interface SharedConfig {
  /** Base hostname for auto-naming (e.g., "azl-rack01" → "azl-rack01-tor1", "azl-rack01-tor2") */
  base_hostname?: string;
  /** Deployment pattern determines VLAN layout */
  deployment_pattern: DeploymentPattern;
  /** Switch vendor */
  vendor: Vendor;
  /** Switch model */
  model: string;
  /** Firmware version (derived from vendor) */
  firmware: Firmware;
  /** VLAN definitions (shared across both ToRs) */
  vlans: VLAN[];
  /** Interface definitions (shared, but storage VLANs may be split per role) */
  interfaces: Interface[];
  /** Port channel definitions */
  port_channels: PortChannel[];
  /** MLAG domain ID (shared) */
  mlag_domain_id?: number;
  /** MLAG peer-link port-channel ID */
  mlag_peer_link_id?: number;
  /** BGP ASN (shared) */
  bgp_asn?: number;
  /** BGP neighbors (shared) */
  bgp_neighbors?: BGPNeighbor[];
  /** Static routes (optional, shared) */
  static_routes?: StaticRoute[];
  /** Prefix lists (shared) */
  prefix_lists?: PrefixLists;
  /** Routing type selection */
  routing_type?: 'bgp' | 'static';
}

/**
 * Complete TOR pair configuration for the wizard.
 * Contains shared settings plus per-switch overrides.
 */
export interface TorPairConfig {
  shared: SharedConfig;
  tor1: PerSwitchOverrides;
  tor2: PerSwitchOverrides;
}

/**
 * Role-based default values for auto-derivation.
 * Reference: main branch test_cases (REDUNDANCY_PRIORITY_*, vlt.j2)
 */
export interface RoleDefaults {
  /** HSRP/VRRP priority for gateway redundancy */
  redundancy_priority: number;
  /** VLT/vPC priority for MLAG role */
  mlag_priority: number;
  /** MST priority for spanning tree */
  mst_priority: number;
}

/**
 * Storage VLAN assignment by role for switched pattern.
 * TOR1 gets S1 (711), TOR2 gets S2 (712).
 */
export type StorageVlanSymbol = 'S1' | 'S2' | 'S';

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface WizardState {
  currentStep: number;
  config: Partial<StandardConfig>;
}

/**
 * TOR Pair wizard state (Phase 13)
 */
export interface TorPairWizardState {
  currentStep: number;
  /** Active switch tab: 'A' (TOR1) or 'B' (TOR2) */
  activeSwitch: 'A' | 'B';
  /** TOR pair configuration */
  torPairConfig: TorPairConfig;
  /** Validation results per switch */
  validationResults: {
    tor1: ValidationResult;
    tor2: ValidationResult;
  };
}
