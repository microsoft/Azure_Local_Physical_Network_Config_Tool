/**
 * TypeScript type definitions for Azure Local Network Switch Configuration
 * Generated from backend/schema/standard.json
 */

// Vendor and firmware types
export type Vendor = 'cisco' | 'dellemc';
export type Firmware = 'nxos' | 'os10';
export type Role = 'TOR1' | 'TOR2' | 'BMC';
export type DeploymentPattern = 'fully_converged' | 'switched' | 'switchless';

// VLAN types
export type VLANPurpose = 'parking' | 'management' | 'compute' | 'storage_1' | 'storage_2' | 'bmc';
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

// Interface types
export type InterfaceType = 'Access' | 'Trunk' | 'L3';
export type PhysicalInterfaceType = 'Ethernet' | 'loopback' | 'port-channel';

export interface ServicePolicy {
  qos_input?: string;
}

export interface Interface {
  name: string;
  type: InterfaceType;
  description?: string;
  intf_type?: PhysicalInterfaceType;
  intf?: string;
  start_intf?: string;
  end_intf?: string;
  access_vlan?: string;
  native_vlan?: string;
  tagged_vlans?: string;
  ipv4?: string;
  shutdown?: boolean;
  service_policy?: ServicePolicy;
}

// Port Channel types
export interface PortChannel {
  id: number;
  description: string;
  type: 'Trunk' | 'L3';
  ipv4?: string;
  native_vlan?: string;
  tagged_vlans?: string;
  members: string[];
  vpc_peer_link?: boolean;
}

// MLAG types
export interface MLAGPeerKeepalive {
  source_ip: string;
  destination_ip: string;
  vrf?: string;
}

export interface MLAG {
  domain_id: number;
  peer_keepalive: MLAGPeerKeepalive;
  delay_restore?: number;
  peer_gateway?: boolean;
  auto_recovery?: boolean;
}

// BGP types
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
  af_ipv4_unicast?: BGPNeighborAF;
}

export interface BGP {
  asn: number;
  router_id: string;
  networks?: string[];
  neighbors: BGPNeighbor[];
}

// Switch configuration
export interface SwitchConfig {
  vendor: Vendor;
  model: string;
  firmware: Firmware;
  hostname: string;
  role: Role;
  version?: string;
  deployment_pattern?: DeploymentPattern;
}

// Main configuration type
export interface StandardConfig {
  switch: SwitchConfig;
  vlans?: VLAN[];
  interfaces?: Interface[];
  port_channels?: PortChannel[];
  mlag?: MLAG;
  prefix_lists?: PrefixLists;
  bgp?: BGP;
  qos?: boolean;
}

// Validation result type
export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Wizard state type
export interface WizardState {
  currentStep: number;
  config: Partial<StandardConfig>;
}
