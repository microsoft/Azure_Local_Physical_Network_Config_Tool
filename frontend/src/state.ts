/**
 * Wizard state management
 * Manages the multi-step wizard state and provides typed getters/setters
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
  DeploymentPattern
} from './types';

export type WizardPhase = 1 | 2 | 3 | 'review';
export type Phase2Substep = '2.1' | '2.2' | '2.3' | '2.4';

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
