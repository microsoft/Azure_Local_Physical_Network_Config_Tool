/**
 * Wizard state management
 * Manages the multi-step wizard state and provides typed getters/setters
 * 
 * Phase 13: Added TOR pair state management for dual-switch workflow
 */

import type { 
  SwitchConfig, 
  VLAN, 
  Interface, 
  PortChannel, 
  MLAG, 
  BGP,
  PrefixLists,
  StandardConfig,
  DeploymentPattern,
  SharedConfig,
  PerSwitchOverrides,
  TorPairConfig,
  ValidationResult,
  Vendor,
  Firmware
} from './types';

export type WizardPhase = 1 | 2 | 3 | 'review';
export type Phase2Substep = '2.1' | '2.2' | '2.3' | '2.4';

// ============================================================================
// LEGACY WIZARD STATE (single switch - for backward compatibility)
// ============================================================================

export interface WizardState {
  currentPhase: WizardPhase;
  currentSubstep: Phase2Substep | null;
  selectedPattern: DeploymentPattern | null;
  switch: Partial<SwitchConfig>;
  vlans: VLAN[];
  interfaces: Interface[];
  portChannels: PortChannel[];
  mlag: Partial<MLAG>;
  bgp: Partial<BGP>;
  prefix_lists: PrefixLists;
}

// ============================================================================
// TOR PAIR WIZARD STATE (Phase 13)
// ============================================================================

export interface TorPairWizardState {
  currentPhase: WizardPhase;
  currentSubstep: Phase2Substep | null;
  /** Active switch tab for per-switch IP entry: 'A' (TOR1) or 'B' (TOR2) */
  activeSwitch: 'A' | 'B';
  /** Shared configuration (pattern, vendor, VLANs, ports, MLAG domain, BGP ASN) */
  shared: SharedConfig;
  /** TOR1 overrides (hostname, IPs) */
  tor1: PerSwitchOverrides;
  /** TOR2 overrides (hostname, IPs) */
  tor2: PerSwitchOverrides;
  /** Validation results per switch */
  validationResults: {
    tor1: ValidationResult;
    tor2: ValidationResult;
  };
}

// Initialize default state
const initialState: WizardState = {
  currentPhase: 1,
  currentSubstep: null,
  selectedPattern: null,
  switch: {},
  vlans: [],
  interfaces: [],
  portChannels: [],
  mlag: {},
  bgp: {},
  prefix_lists: {}
};

// Global state instance
let state: WizardState = { ...initialState };

/**
 * Get current wizard state
 */
export function getState(): WizardState {
  return state;
}

/**
 * Set entire wizard state
 */
export function setState(newState: WizardState): void {
  state = newState;
}

/**
 * Reset state to initial values
 */
export function resetState(): void {
  state = { ...initialState };
}

/**
 * Get current step
 */
export function getCurrentPhase(): WizardPhase {
  return state.currentPhase;
}

/**
 * Set current step
 */
export function setCurrentPhase(phase: WizardPhase): void {
  state.currentPhase = phase;
}

/**
 * Get switch config
 */
export function getSwitchConfig(): Partial<SwitchConfig> {
  return state.switch;
}

/**
 * Update switch config (merge)
 */
export function updateSwitchConfig(config: Partial<SwitchConfig>): void {
  state.switch = { ...state.switch, ...config };
}

/**
 * Get VLANs
 */
export function getVlans(): VLAN[] {
  return state.vlans;
}

/**
 * Set VLANs
 */
export function setVlans(vlans: VLAN[]): void {
  state.vlans = vlans;
}

/**
 * Add VLAN
 */
export function addVlan(vlan: VLAN): void {
  state.vlans.push(vlan);
}

/**
 * Remove VLAN by ID
 */
export function removeVlan(vlanId: number): void {
  state.vlans = state.vlans.filter(v => v.vlan_id !== vlanId);
}

/**
 * Get interfaces
 */
export function getInterfaces(): Interface[] {
  return state.interfaces;
}

/**
 * Set interfaces
 */
export function setInterfaces(interfaces: Interface[]): void {
  state.interfaces = interfaces;
}

/**
 * Add interface
 */
export function addInterface(iface: Interface): void {
  state.interfaces.push(iface);
}

/**
 * Get port channels
 */
export function getPortChannels(): PortChannel[] {
  return state.portChannels;
}

/**
 * Set port channels
 */
export function setPortChannels(channels: PortChannel[]): void {
  state.portChannels = channels;
}

/**
 * Add port channel
 */
export function addPortChannel(channel: PortChannel): void {
  state.portChannels.push(channel);
}

/**
 * Get MLAG config
 */
export function getMlagConfig(): Partial<MLAG> {
  return state.mlag;
}

/**
 * Update MLAG config (merge)
 */
export function updateMlagConfig(config: Partial<MLAG>): void {
  state.mlag = { ...state.mlag, ...config };
}

/**
 * Get BGP config
 */
export function getBgpConfig(): Partial<BGP> {
  return state.bgp;
}

/**
 * Update BGP config (merge)
 */
export function updateBgpConfig(config: Partial<BGP>): void {
  state.bgp = { ...state.bgp, ...config };
}

/**
 * Get prefix lists
 */
export function getPrefixLists(): PrefixLists {
  return state.prefix_lists;
}

/**
 * Set prefix lists
 */
export function setPrefixLists(lists: PrefixLists): void {
  state.prefix_lists = lists;
}

/**
 * Export state as StandardConfig
 */
export function exportToStandardConfig(): StandardConfig {
  return {
    switch: state.switch as SwitchConfig,
    vlans: state.vlans,
    interfaces: state.interfaces,
    port_channels: state.portChannels,
    mlag: Object.keys(state.mlag).length > 0 ? state.mlag as MLAG : undefined,
    bgp: Object.keys(state.bgp).length > 0 ? state.bgp as BGP : undefined,
    prefix_lists: Object.keys(state.prefix_lists).length > 0 ? state.prefix_lists : undefined
  };
}

/**
 * Import StandardConfig into state
 */
export function importFromStandardConfig(config: StandardConfig): void {
  state.switch = config.switch;
  state.vlans = config.vlans || [];
  state.interfaces = config.interfaces || [];
  state.portChannels = config.port_channels || [];
  state.mlag = config.mlag || {};
  state.bgp = config.bgp || {};
  state.prefix_lists = config.prefix_lists || {};
}

// ============================================================================
// TOR PAIR STATE MANAGEMENT (Phase 13)
// ============================================================================

// Initial TOR pair state
const initialTorPairState: TorPairWizardState = {
  currentPhase: 1,
  currentSubstep: null,
  activeSwitch: 'A',
  shared: {
    deployment_pattern: '' as DeploymentPattern,
    vendor: '' as Vendor,
    model: '',
    firmware: '' as Firmware,
    vlans: [],
    interfaces: [],
    port_channels: []
  },
  tor1: {
    hostname: ''
  },
  tor2: {
    hostname: ''
  },
  validationResults: {
    tor1: { valid: true, errors: [] },
    tor2: { valid: true, errors: [] }
  }
};

// Global TOR pair state instance
let torPairState: TorPairWizardState = { ...initialTorPairState };

/**
 * Get current TOR pair wizard state
 */
export function getTorPairState(): TorPairWizardState {
  return torPairState;
}

/**
 * Set entire TOR pair wizard state
 */
export function setTorPairState(newState: TorPairWizardState): void {
  torPairState = newState;
}

/**
 * Reset TOR pair state to initial values
 */
export function resetTorPairState(): void {
  torPairState = { 
    ...initialTorPairState,
    shared: { ...initialTorPairState.shared },
    tor1: { ...initialTorPairState.tor1 },
    tor2: { ...initialTorPairState.tor2 },
    validationResults: {
      tor1: { valid: true, errors: [] },
      tor2: { valid: true, errors: [] }
    }
  };
}

/**
 * Get active switch tab ('A' for TOR1, 'B' for TOR2)
 */
export function getActiveSwitch(): 'A' | 'B' {
  return torPairState.activeSwitch;
}

/**
 * Set active switch tab
 */
export function setActiveSwitch(tab: 'A' | 'B'): void {
  torPairState.activeSwitch = tab;
}

/**
 * Get shared config
 */
export function getSharedConfig(): SharedConfig {
  return torPairState.shared;
}

/**
 * Update shared config (merge)
 */
export function updateSharedConfig(config: Partial<SharedConfig>): void {
  torPairState.shared = { ...torPairState.shared, ...config };
}

/**
 * Get TOR1 overrides
 */
export function getTor1Overrides(): PerSwitchOverrides {
  return torPairState.tor1;
}

/**
 * Update TOR1 overrides (merge)
 */
export function updateTor1Overrides(overrides: Partial<PerSwitchOverrides>): void {
  torPairState.tor1 = { ...torPairState.tor1, ...overrides };
}

/**
 * Get TOR2 overrides
 */
export function getTor2Overrides(): PerSwitchOverrides {
  return torPairState.tor2;
}

/**
 * Update TOR2 overrides (merge)
 */
export function updateTor2Overrides(overrides: Partial<PerSwitchOverrides>): void {
  torPairState.tor2 = { ...torPairState.tor2, ...overrides };
}

/**
 * Get overrides for active switch
 */
export function getActiveSwitchOverrides(): PerSwitchOverrides {
  return torPairState.activeSwitch === 'A' ? torPairState.tor1 : torPairState.tor2;
}

/**
 * Update overrides for active switch (merge)
 */
export function updateActiveSwitchOverrides(overrides: Partial<PerSwitchOverrides>): void {
  if (torPairState.activeSwitch === 'A') {
    updateTor1Overrides(overrides);
  } else {
    updateTor2Overrides(overrides);
  }
}

/**
 * Set validation results for both switches
 */
export function setTorValidationResults(
  tor1Result: ValidationResult,
  tor2Result: ValidationResult
): void {
  torPairState.validationResults = {
    tor1: tor1Result,
    tor2: tor2Result
  };
}

/**
 * Get validation results
 */
export function getTorValidationResults(): { tor1: ValidationResult; tor2: ValidationResult } {
  return torPairState.validationResults;
}

/**
 * Export TOR pair state as TorPairConfig
 */
export function exportToTorPairConfig(): TorPairConfig {
  return {
    shared: torPairState.shared,
    tor1: torPairState.tor1,
    tor2: torPairState.tor2
  };
}

/**
 * Import TorPairConfig into state
 */
export function importFromTorPairConfig(config: TorPairConfig): void {
  torPairState.shared = config.shared;
  torPairState.tor1 = config.tor1;
  torPairState.tor2 = config.tor2;
}
