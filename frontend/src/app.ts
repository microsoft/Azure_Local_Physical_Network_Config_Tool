/**
 * Azure Local Switch Configuration Wizard - Main Application
 * TypeScript conversion from app.js
 */

import type {
  StandardConfig,
  VLAN,
  Interface,
  PortChannel,
  BGPNeighbor,
  Vendor,
  Role,
  VLANPurpose,
  RedundancyType,
  Firmware,
  DeploymentPattern
} from './types';
import {
  DISPLAY_NAMES,
  VENDOR_FIRMWARE_MAP,
  VENDOR_REDUNDANCY_TYPE,
  ROLE_DEFAULTS,
  getElement,
  getElements,
  getInputValue,
  setInputValue,
  toggleElement,
  downloadJSON,
  copyToClipboard,
  parseIntSafe,
  formatJSON
} from './utils';

// ============================================================================
// TYPES
// ============================================================================

interface WizardState {
  currentStep: number;
  totalSteps: number;
  config: StandardConfig & {
    routing_type?: 'bgp' | 'static';
    static_routes?: Array<{
      destination: string;
      next_hop: string;
      name?: string;
    }>;
  };
}

interface VLANConfig {
  label: string;
  purpose: VLANPurpose;
  defaultVlanId: (idx: number) => number;
  namePrefix: string;
  switchIpPlaceholder: string | ((idx: number) => string);
  gatewayPlaceholder: string | ((idx: number) => string);
  cssClass: string;
  counter: number;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state: WizardState = {
  currentStep: 1,
  totalSteps: 7,
  config: {
    switch: {
      vendor: '' as Vendor,
      model: '',
      firmware: '' as Firmware,
      hostname: '',
      role: '' as Role,
      deployment_pattern: '' as DeploymentPattern
    },
    vlans: [],
    interfaces: [],
    port_channels: [],
    mlag: undefined,
    routing_type: 'bgp',
    bgp: undefined,
    prefix_lists: {},
    static_routes: []
  }
};

// MLAG constants
const MLAG_PEER_LINK_ID = 101;
const MLAG_NATIVE_VLAN = '99';
const MLAG_PEER_LINK_MEMBERS = ['1/1/49', '1/1/50', '1/1/51', '1/1/52'];

const VLAN_CONFIGS: Record<'management' | 'compute', VLANConfig> = {
  management: {
    label: 'Management',
    purpose: 'management',
    defaultVlanId: (idx) => 7 + idx,
    namePrefix: 'Infra',
    switchIpPlaceholder: (idx) => `100.69.176.${idx + 2}/24`,
    gatewayPlaceholder: '100.69.176.1/24',
    cssClass: 'mgmt',
    counter: 1
  },
  compute: {
    label: 'Compute',
    purpose: 'compute',
    defaultVlanId: (idx) => 201 + idx,
    namePrefix: 'Compute',
    switchIpPlaceholder: (idx) => `10.${idx}.0.2/24`,
    gatewayPlaceholder: (idx) => `10.${idx}.0.1/24`,
    cssClass: 'compute',
    counter: 1
  }
};

// ============================================================================
// PATTERN-FIRST FUNCTIONS
// ============================================================================

/**
 * Select deployment pattern - Phase 1.1
 */
export function selectPattern(pattern: DeploymentPattern): void {
  // Update state
  state.config.switch.deployment_pattern = pattern;
  
  // Update UI - mark selected
  getElements('.pattern-card').forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.pattern === pattern) {
      card.classList.add('selected');
    }
  });
  
  // Show sidebar
  showPatternSidebar(pattern);
  
  // Reveal hardware selection section
  const hardwareSection = getElement('.hardware-selection');
  if (hardwareSection) {
    hardwareSection.style.display = 'block';
  }

  // Sync host port sections with selected pattern
  updateHostPortsSections();
  
  // Enable next button when all Phase 1 fields are filled
  updatePhase1NextButton();
  
  // Update config summary sidebar
  updateConfigSummary();
}

/**
 * Show persistent pattern sidebar
 */
function showPatternSidebar(pattern: DeploymentPattern): void {
  const sidebar = getElement('#pattern-sidebar');
  const img = getElement<HTMLImageElement>('#sidebar-pattern-img');
  const name = getElement('#sidebar-pattern-name');
  
  if (!sidebar || !img || !name) return;
  
  const patterns = {
    switchless: { name: '🔌 Switchless', img: 'media/pattern-switchless.png' },
    switched: { name: '💾 Switched', img: 'media/pattern-switched.png' },
    fully_converged: { name: '🔄 Fully Converged', img: 'media/pattern-fully-converged.png' }
  };
  
  const selected = patterns[pattern];
  img.src = selected.img;
  img.alt = selected.name;
  name.textContent = selected.name;
  sidebar.style.display = 'block';
}

/**
 * Expand pattern image in lightbox
 */
export function expandPatternImage(): void {
  const sidebarImg = getElement<HTMLImageElement>('#sidebar-pattern-img');
  const lightbox = getElement('#pattern-lightbox');
  const lightboxImg = getElement<HTMLImageElement>('#lightbox-img');
  
  if (!sidebarImg || !lightbox || !lightboxImg) return;
  
  lightboxImg.src = sidebarImg.src;
  lightboxImg.alt = sidebarImg.alt;
  lightbox.style.display = 'flex';
}

/**
 * Expand pattern preview image from selection cards
 */
export function expandPatternPreview(src: string, alt: string): void {
  const lightbox = getElement('#pattern-lightbox');
  const lightboxImg = getElement<HTMLImageElement>('#lightbox-img');
  
  if (!lightbox || !lightboxImg) return;
  
  lightboxImg.src = src;
  lightboxImg.alt = alt;
  lightbox.style.display = 'flex';
}

/**
 * Close lightbox
 */
export function closeLightbox(): void {
  const lightbox = getElement('#pattern-lightbox');
  if (lightbox) lightbox.style.display = 'none';
}

/**
 * Change pattern (return to Phase 1.1)
 */
export function changePattern(): void {
  if (confirm('Changing the pattern will reset your configuration. Continue?')) {
    showPhase(1);
    // Reset pattern selection
    getElements('.pattern-card').forEach(card => card.classList.remove('selected'));
    // Hide sidebar
    const sidebar = getElement('#pattern-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    // Hide later sections
    getElement('.hardware-selection')?.setAttribute('style', 'display: none');
    getElement('#role-selection-section')?.setAttribute('style', 'display: none');
    getElement('#hostname-section')?.setAttribute('style', 'display: none');
  }
}

/**
 * Vendor change handler for dropdown
 */
export function onVendorChange(): void {
  const vendorSelect = getElement<HTMLSelectElement>('#vendor-select');
  const modelSelect = getElement<HTMLSelectElement>('#model-select');
  
  if (!vendorSelect || !modelSelect) return;
  
  const vendor = vendorSelect.value as Vendor;
  
  // Clear and populate model dropdown
  modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
  
  const models: Record<Vendor, Array<{value: string; label: string}>> = {
    cisco: [
      { value: '93180yc-fx3', label: 'Nexus 93180YC-FX3' },
      { value: '9336c-fx2', label: 'Nexus 9336C-FX2' }
    ],
    dellemc: [
      { value: 's5248f-on', label: 'S5248F-ON' },
      { value: 's5232f-on', label: 'S5232F-ON' }
    ]
  };
  
  if (vendor && models[vendor]) {
    modelSelect.disabled = false;
    models[vendor].forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      modelSelect.appendChild(option);
    });
    
    // Update state
    state.config.switch.vendor = vendor;
    state.config.switch.firmware = VENDOR_FIRMWARE_MAP[vendor] as Firmware;
    
    // Update config summary
    updateConfigSummary();
  } else {
    modelSelect.disabled = true;
  }
  
  updatePhase1NextButton();
}

/**
 * Handle model selection change
 */
export function onModelChange(): void {
  const modelSelect = getElement<HTMLSelectElement>('#model-select');
  if (!modelSelect) {
    console.error('Model select not found');
    return;
  }
  
  console.log('onModelChange called, model value:', modelSelect.value);
  
  state.config.switch.model = modelSelect.value;
  
  // Show role selection AND hostname section when model is selected
  if (modelSelect.value) {
    const roleSection = getElement('#role-selection-section');
    console.log('Role section found:', !!roleSection);
    if (roleSection) {
      roleSection.style.display = 'block';
      console.log('Role section visible');
    }
    
    // Also show hostname section
    const hostnameSection = getElement('#hostname-section');
    if (hostnameSection) {
      hostnameSection.style.display = 'block';
      console.log('Hostname section visible');
    }
    
    // Update config summary
    updateConfigSummary();
  }
  
  updatePhase1NextButton();
}

/**
 * Role selection handler
 */
export function selectRole(role: Role): void {
  console.log('selectRole called with:', role);
  
  // Update state
  state.config.switch.role = role;
  
  // Update UI
  getElements('.role-card').forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.role === role) {
      card.classList.add('selected');
    }
  });
  
  // Auto-generate hostname
  const hostname = `sample-${role.toLowerCase()}`;
  
  const hostnameInput = getElement<HTMLInputElement>('#hostname');
  if (hostnameInput) {
    hostnameInput.value = hostname;
    state.config.switch.hostname = hostname;
    // Re-apply in next tick to override any stale value
    setTimeout(() => {
      hostnameInput.value = hostname;
      state.config.switch.hostname = hostname;
    }, 0);
  }
  
  // Show hostname section
  const hostnameSection = getElement('#hostname-section');
  console.log('Hostname section found:', !!hostnameSection);
  if (hostnameSection) {
    hostnameSection.style.display = 'block';
    console.log('Hostname section display set to block');
  } else {
    console.error('Hostname section element not found!');
  }

  updateHostPortsSections();
  
  updatePhase1NextButton();
  
  // Update config summary
  updateConfigSummary();
}

/**
 * Update hostname in state when user edits it
 */
export function updateHostname(): void {
  const hostnameInput = getElement<HTMLInputElement>('#hostname');
  if (hostnameInput) {
    state.config.switch.hostname = hostnameInput.value;
    updatePhase1NextButton();
    updateConfigSummary();
  }
}

/**
 * Update Phase 1 next button state
 */
function updatePhase1NextButton(): void {
  const nextBtn = getElement<HTMLButtonElement>('#phase1-next-btn');
  if (!nextBtn) return;
  
  const pattern = state.config.switch.deployment_pattern;
  const vendor = state.config.switch.vendor;
  const model = state.config.switch.model;
  const role = state.config.switch.role;
  const hostname = getElement<HTMLInputElement>('#hostname')?.value;
  
  const allFilled = pattern && vendor && model && role && hostname;
  nextBtn.disabled = !allFilled;
  
  if (allFilled) {
    nextBtn.style.opacity = '1';
    nextBtn.style.cursor = 'pointer';
  } else {
    nextBtn.style.opacity = '0.5';
    nextBtn.style.cursor = 'not-allowed';
  }
}

/**
 * Get VLANs allowed for a pattern
 */
export function getPatternVlans(pattern: DeploymentPattern, role?: Role): VLANPurpose[] {
  switch (pattern) {
    case 'switchless':
      return ['management', 'compute'];
    case 'switched':
      return role === 'TOR1' 
        ? ['management', 'compute', 'storage_1'] 
        : ['management', 'compute', 'storage_2'];
    case 'fully_converged':
      return ['management', 'compute', 'storage_1', 'storage_2'];
    default:
      return ['management', 'compute'];
  }
}

/**
 * Get host port tagged VLANs string for pattern
 */
export function getPatternHostVlans(pattern: DeploymentPattern, role?: Role): string {
  // These are the default VLAN IDs - user can override
  switch (pattern) {
    case 'switchless':
      return '7,201';
    case 'switched':
      return role === 'TOR1' ? '7,201,711' : '7,201,712';
    case 'fully_converged':
      return '7,201,711,712';
    default:
      return '7,201';
  }
}

// ============================================================================
// CONFIGURATION SUMMARY SIDEBAR
// ============================================================================

/**
 * Update the configuration summary sidebar with current state
 * Called whenever state changes
 */
export function updateConfigSummary(): void {
  const config = state.config;
  
  // Switch section
  const patternDisplay = config.switch.deployment_pattern?.replace('_', ' ') || '—';
  setTextContent('#sum-pattern', patternDisplay ? capitalize(patternDisplay) : '—');
  setTextContent('#sum-vendor', config.switch.vendor ? DISPLAY_NAMES.vendors[config.switch.vendor] || config.switch.vendor : '—');
  setTextContent('#sum-model', config.switch.model?.toUpperCase() || '—');
  setTextContent('#sum-role', config.switch.role || '—');
  setTextContent('#sum-hostname', config.switch.hostname || '—');
  
  // VLANs section
  const vlans = config.vlans || [];
  const mgmtVlan = vlans.find(v => v.purpose === 'management');
  const computeVlan = vlans.find(v => v.purpose === 'compute');
  const storage1Vlan = vlans.find(v => v.purpose === 'storage_1');
  const storage2Vlan = vlans.find(v => v.purpose === 'storage_2');
  
  setTextContent('#sum-vlan-mgmt', mgmtVlan ? `${mgmtVlan.vlan_id}` : '—');
  setTextContent('#sum-vlan-compute', computeVlan ? `${computeVlan.vlan_id}` : '—');
  setTextContent('#sum-vlan-storage1', storage1Vlan ? `${storage1Vlan.vlan_id}` : '—');
  setTextContent('#sum-vlan-storage2', storage2Vlan ? `${storage2Vlan.vlan_id}` : '—');
  
  // Host Ports section
  const hostTrunk = (config.interfaces || []).find(i => 
    i.name?.includes('Host') || i.name?.includes('Converged') || i.name?.includes('Trunk')
  );
  if (hostTrunk) {
    const range = hostTrunk.start_intf && hostTrunk.end_intf 
      ? `${hostTrunk.start_intf}-${hostTrunk.end_intf}` 
      : hostTrunk.intf || '—';
    setTextContent('#sum-port-range', range);
    setTextContent('#sum-tagged-vlans', hostTrunk.tagged_vlans || '—');
  } else {
    setTextContent('#sum-port-range', '—');
    setTextContent('#sum-tagged-vlans', '—');
  }
  
  // Redundancy section
  const peerLink = (config.port_channels || []).find(pc => pc.vpc_peer_link);
  if (peerLink) {
    setTextContent('#sum-peerlink', `PC${peerLink.id}`);
  } else {
    setTextContent('#sum-peerlink', '—');
  }
  
  const mlag = config.mlag;
  if (mlag?.peer_keepalive) {
    setTextContent('#sum-keepalive', `${mlag.peer_keepalive.source_ip || '—'}`);
  } else {
    setTextContent('#sum-keepalive', '—');
  }
  
  // Routing section
  const routingType = config.routing_type || 'bgp';
  setTextContent('#sum-routing-type', routingType.toUpperCase());
  
  if (config.bgp) {
    setTextContent('#sum-asn', config.bgp.asn ? String(config.bgp.asn) : '—');
    setTextContent('#sum-router-id', config.bgp.router_id || '—');
    const neighborCount = config.bgp.neighbors?.length || 0;
    setTextContent('#sum-neighbors', neighborCount > 0 ? `${neighborCount} configured` : '—');
  } else {
    setTextContent('#sum-asn', '—');
    setTextContent('#sum-router-id', '—');
    setTextContent('#sum-neighbors', '—');
  }
  
  // Update progress
  updateProgressIndicator();
}

/**
 * Helper to set text content safely
 */
function setTextContent(selector: string, text: string): void {
  const elem = getElement(selector);
  if (elem) elem.textContent = text;
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Update the progress indicator
 */
function updateProgressIndicator(): void {
  const config = state.config;
  let completed = 0;
  const total = 10; // Total checkpoints
  
  // Phase 1 checks - must have actual non-empty values
  if (config.switch.deployment_pattern && config.switch.deployment_pattern !== '') completed++;
  if (config.switch.vendor && config.switch.vendor !== '') completed++;
  if (config.switch.model && config.switch.model !== '') completed++;
  if (config.switch.role && config.switch.role !== '') completed++;
  if (config.switch.hostname && config.switch.hostname !== '') completed++;
  
  // Phase 2 checks
  if (config.vlans && config.vlans.length > 0) completed++;
  if (config.interfaces && config.interfaces.length > 0) completed++;
  if (config.port_channels && config.port_channels.length > 0) completed++;
  
  // Phase 3 checks - must have actual values
  if (config.bgp?.asn || (config.static_routes && config.static_routes.length > 0)) completed++;
  if ((config.bgp?.neighbors && config.bgp.neighbors.length > 0) || (config.static_routes && config.static_routes.length > 0)) completed++;
  
  const percentage = Math.round((completed / total) * 100);
  
  const fill = getElement('#progress-fill');
  const text = getElement('#progress-text');
  
  if (fill) (fill as HTMLElement).style.width = `${percentage}%`;
  if (text) text.textContent = `${percentage}%`;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeWizard(): void {
  try {
    console.log('Initializing wizard...');
    renderTemplateList();
    
    // Phase1 already has 'active' class in HTML, just update the navigation
    updatePhaseNavigationUI(1);
    
    // Initialize config summary
    updateConfigSummary();
    
    console.log('Wizard initialized successfully');
  } catch (error) {
    console.error('Error initializing wizard:', error);
  }
}

// ============================================================================
// LEGACY CARD SELECTION (unused in pattern-first approach)
// Kept for reference - cards now use onclick handlers in HTML
// ============================================================================

/* function initializeCardSelections(): void {
  initializeCardGroup('.vendor-card', 'vendor', (value) => {
    state.config.switch.vendor = value as Vendor;
    state.config.switch.firmware = VENDOR_FIRMWARE_MAP[value as Vendor] as Firmware;
    updateModelCards();
  }, 'dellemc');

  initializeCardGroup('.model-card', 'model', (value) => {
    state.config.switch.model = value;
  });
  updateModelCards();

  initializeCardGroup('.role-card', 'role', (value) => {
    state.config.switch.role = value as Role;
    updateRoleBasedSections();
  }, 'TOR1');

  initializeCardGroup('.pattern-card', 'pattern', (value) => {
    state.config.switch.deployment_pattern = value as DeploymentPattern;
  }, 'fully_converged');

  initializeCardGroup('.routing-card', 'routing', (value) => {
    state.config.routing_type = value as 'bgp' | 'static';
    updateRoutingSection();
  }, 'bgp');
}

function initializeCardGroup(
  selector: string,
  dataAttr: string,
  onChange: ((value: string) => void) | null,
  defaultValue: string | null = null
): void {
  const cards = getElements<HTMLElement>(selector);
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const value = card.dataset[dataAttr];
      if (onChange && value) onChange(value);
    });
  });

  if (defaultValue) {
    const defaultCard = getElement<HTMLElement>(`${selector}[data-${dataAttr}="${defaultValue}"]`);
    if (defaultCard) {
      defaultCard.classList.add('selected');
      if (onChange) onChange(defaultValue);
    }
  }
} */

export function setupEventListeners(): void {
  const importInput = getElement<HTMLInputElement>('#import-json');
  if (importInput) {
    importInput.addEventListener('change', handleFileImport);
  }

  getElements('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });
  getElements('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => prevStep());
  });

  // Phase navigation tabs
  getElements('.nav-phase').forEach(phase => {
    phase.addEventListener('click', () => {
      const phaseId = phase.dataset.phase;
      if (!phaseId) return;
      if (phaseId === 'review') {
        showPhase('review');
        populateReviewStep();
        return;
      }
      const numericPhase = parseInt(phaseId, 10);
      if (!Number.isNaN(numericPhase)) {
        showPhase(numericPhase);
      }
    });
  });

  // Phase 2 substep tabs
  getElements<HTMLButtonElement>('.sub-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const substep = btn.dataset.substep;
      if (substep) {
        showPhase(2, substep);
      }
    });
  });

  getElements('.nav-step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step || '1');
      // Allow clicking on previous steps, current step, or Review (step 7)
      if (stepNum <= state.currentStep || stepNum === 7) {
        showStep(stepNum);
      }
    });
  });

  const addMgmtBtn = getElement('#btn-add-mgmt');
  if (addMgmtBtn) {
    addMgmtBtn.addEventListener('click', () => addDynamicVlan('management'));
  }

  const addComputeBtn = getElement('#btn-add-compute');
  if (addComputeBtn) {
    addComputeBtn.addEventListener('click', () => addDynamicVlan('compute'));
  }

  const addNeighborBtn = getElement('#btn-add-neighbor');
  if (addNeighborBtn) {
    addNeighborBtn.addEventListener('click', addBgpNeighbor);
  }

  const addRouteBtn = getElement('#btn-add-route');
  if (addRouteBtn) {
    addRouteBtn.addEventListener('click', addStaticRoute);
  }

  const exportBtn = getElement('#btn-export');
  if (exportBtn) exportBtn.addEventListener('click', exportJSONFile);

  const copyBtn = getElement('#btn-copy');
  if (copyBtn) copyBtn.addEventListener('click', copyJSON);

  const resetBtn = getElement('#btn-reset');
  if (resetBtn) resetBtn.addEventListener('click', startOver);

  const loopbackInput = getElement<HTMLInputElement>('#intf-loopback-ip');
  if (loopbackInput) {
    loopbackInput.addEventListener('input', (e) => {
      const routerIdField = getElement<HTMLInputElement>('#bgp-router-id');
      if (routerIdField && e.target instanceof HTMLInputElement) {
        const ip = e.target.value.split('/')[0];
        routerIdField.value = ip || '';
      }
    });
  }

  // Routing type toggle (BGP/Static)
  getElements<HTMLElement>('.routing-card').forEach(card => {
    card.addEventListener('click', () => {
      // Remove selected from all routing cards
      getElements('.routing-card').forEach(c => c.classList.remove('selected'));
      // Add selected to clicked card
      card.classList.add('selected');
      // Update state and toggle sections
      const routingType = card.dataset.routing as 'bgp' | 'static';
      if (routingType) {
        state.config.routing_type = routingType;
        updateRoutingSection();
      }
    });
  });

  // Delegate remove button clicks for dynamic entries
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('btn-remove-neighbor')) {
      const entry = target.closest('.neighbor-entry');
      if (entry) entry.remove();
    }
  });
}

// ============================================================================
// TEMPLATE LOADING
// ============================================================================

export function showTemplateModal(): void {
  const modal = getElement('#template-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

export function closeTemplateModal(): void {
  const modal = getElement('#template-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

export async function loadTemplate(templateName: string): Promise<void> {
  closeTemplateModal(); // Close modal immediately
  
  try {
    // templateName is now like "fully-converged/sample-tor1" 
    const response = await fetch(resolveTemplateUrl(templateName));
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }
    const config = await response.json() as Partial<StandardConfig>;
    loadConfig(config);
    showSuccessMessage(`Loaded template: ${templateName.split('/').pop()}`);
  } catch (error) {
    showValidationError(`Failed to load template: ${(error as Error).message}`);
  }
}

export function toggleCollapsible(header: HTMLElement): void {
  const content = header.nextElementSibling as HTMLElement;
  if (content && content.classList.contains('collapsible-content')) {
    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    header.classList.toggle('expanded');
  }
}

export function updateStorageVlanName(storageNum: number): void {
  const vlanIdInput = getElement<HTMLInputElement>(`#vlan-storage${storageNum}-id`);
  const nameInput = getElement<HTMLInputElement>(`#vlan-storage${storageNum}-name`);
  
  if (vlanIdInput && nameInput && vlanIdInput.value) {
    nameInput.value = `Storage${storageNum}_${vlanIdInput.value}`;
    nameInput.style.color = '#666';
  }
}

// ============================================================================
// NAVIGATION (Phase-based)
// ============================================================================

/**
 * Show a specific phase
 */
export function showPhase(phase: number | string, substep?: string): void {
  try {
    console.log('showPhase called with:', phase, substep);
    
    // Hide all phases
    const phases = getElements('.phase');
    console.log('Found phases:', phases.length);
    phases.forEach(p => p.classList.remove('active'));
    
    // Show target phase
    const phaseId = phase === 'review' ? 'review' : `phase${phase}`;
    const targetPhase = getElement(`#${phaseId}`);
    console.log('Target phase:', phaseId, 'found:', !!targetPhase);
    
    if (targetPhase) {
      targetPhase.classList.add('active');
      
      // For Phase 2, handle substeps
      if (phase === 2 && substep) {
        showSubstep(substep);
      } else if (phase === 2) {
        showSubstep('2.1'); // Default to first substep
      }
      
      updatePhaseNavigationUI(phase);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      console.error('Could not find phase element:', phaseId);
    }
  } catch (error) {
    console.error('Error in showPhase:', error);
  }
}

/**
 * Show substep within Phase 2
 */
function showSubstep(substep: string): void {
  // Hide all substeps
  getElements('.substep').forEach(s => s.classList.remove('active'));
  
  // Show target substep
  getElements(`.substep[data-substep="${substep}"]`).forEach(s => {
    s.classList.add('active');
  });
  
  // Update sub-navigation
  getElements('.sub-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.substep === substep) {
      btn.classList.add('active');
    }
  });

  if (substep === '2.2') {
    updateHostPortsSections();
  }
}

/**
 * Navigate to next phase or substep
 */
export function nextPhase(): void {
  const currentPhase = getCurrentPhase();
  
  if (currentPhase === 1) {
    // Phase 1 → Phase 2.1
    showPhase(2, '2.1');
  } else if (currentPhase === 2) {
    // Phase 2 → Phase 3
    showPhase(3);
  } else if (currentPhase === 3) {
    // Phase 3 → Review
    showPhase('review');
    populateReviewStep();
  }
}

/**
 * Navigate to next substep within Phase 2
 */
export function nextSubstep(): void {
  const substeps = ['2.1', '2.2', '2.3'];
  const currentSubstep = getCurrentSubstep();
  const currentIndex = substeps.indexOf(currentSubstep);
  
  if (currentIndex >= 0 && currentIndex < substeps.length - 1) {
    const nextSubstep = substeps[currentIndex + 1];
    if (nextSubstep) showSubstep(nextSubstep);
  } else if (currentIndex === substeps.length - 1) {
    // Last substep → go to Phase 3
    nextPhase();
  }
}

/**
 * Navigate to previous substep or phase
 */
export function previousSubstep(): void {
  const substeps = ['2.1', '2.2', '2.3'];
  const currentSubstep = getCurrentSubstep();
  const currentIndex = substeps.indexOf(currentSubstep);
  
  if (currentIndex > 0) {
    const prevSubstep = substeps[currentIndex - 1];
    if (prevSubstep) showSubstep(prevSubstep);
  } else {
    // First substep → go back to Phase 1
    previousPhase();
  }
}

/**
 * Navigate to previous phase
 */
export function previousPhase(): void {
  const currentPhase = getCurrentPhase();
  
  if (currentPhase === 2) {
    showPhase(1);
  } else if (currentPhase === 3) {
    showPhase(2, '2.3'); // Go to last substep of Phase 2 (Redundancy)
  } else if (currentPhase === 'review') {
    showPhase(3);
  }
}

/**
 * Get current active phase
 */
function getCurrentPhase(): number | string {
  const activePhase = getElement('.phase.active');
  if (!activePhase) return 1;
  
  const id = activePhase.id;
  if (id === 'review') return 'review';
  if (id === 'phase1') return 1;
  if (id === 'phase2') return 2;
  if (id === 'phase3') return 3;
  return 1;
}

/**
 * Get current active substep
 */
function getCurrentSubstep(): string {
  const activeSubstep = getElement('.substep.active');
  return activeSubstep?.dataset.substep || '2.1';
}

/**
 * Update phase navigation UI
 */
function updatePhaseNavigationUI(activePhase: number | string): void {
  try {
    const navPhases = getElements('.nav-phase');
    console.log('Updating navigation UI for phase:', activePhase, 'found nav elements:', navPhases.length);
    
    navPhases.forEach(phase => {
      phase.classList.remove('active');
      const phaseData = phase.dataset.phase;
      
      if (phaseData === String(activePhase)) {
        phase.classList.add('active');
        console.log('Activated nav phase:', phaseData);
      }
    });
  } catch (error) {
    console.error('Error updating phase navigation UI:', error);
  }
}

// ============================================================================
// LEGACY NAVIGATION (to be removed/refactored)
// ============================================================================

function showStep(stepNum: number): void {
  getElements('.step').forEach(s => s.classList.remove('active'));
  const targetStep = getElement(`#step${stepNum}`);
  if (targetStep) {
    targetStep.classList.add('active');
    state.currentStep = stepNum;
    updateNavigationUI();
    
    if (stepNum === 3) updateHostPortsSections();
    if (stepNum === 7) populateReviewStep();
  }
}

function nextStep(): void {
  if (validateCurrentStep()) {
    collectStepData();
    // Mark current step as completed before moving
    const steps = getElements('.nav-step');
    const currentStepElem = steps[state.currentStep - 1];
    if (currentStepElem) {
      currentStepElem.classList.add('completed');
    }
    if (state.currentStep < state.totalSteps) {
      showStep(state.currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

function prevStep(): void {
  if (state.currentStep > 1) {
    showStep(state.currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateNavigationUI(): void {
  getElements('.nav-step').forEach(step => {
    const stepNum = parseInt(step.dataset.step || '0');
    step.classList.remove('active');
    // Only add active to current step, but preserve completed class
    if (stepNum === state.currentStep) {
      step.classList.add('active');
    } else if (stepNum < state.currentStep) {
      step.classList.add('completed');
    }
  });
}

function updateHostPortsSections(): void {
  const deploymentPattern = state.config.switch.deployment_pattern || 'fully_converged';
  const role = state.config.switch.role || 'TOR1';
  const storagePurposes = ['storage_1', 'storage_2'];
  const displayElem = getElement('#deployment-pattern-display');
  if (displayElem) {
    displayElem.textContent = deploymentPattern.replace('_', ' ').toUpperCase();
  }

  // Hide all port sections first
  const sections = [
    '#port-section-converged',
    '#port-section-mgmt-compute',
    '#port-section-storage1',
    '#port-section-storage2',
    '#port-section-switchless'
  ];
  sections.forEach(id => {
    const elem = getElement(id);
    if (elem) (elem as HTMLElement).style.display = 'none';
  });

  // Show appropriate sections and update VLAN lists
  if (deploymentPattern === 'fully_converged') {
    const section = getElement('#port-section-converged');
    if (section) (section as HTMLElement).style.display = '';
    updateVlanDisplay('#converged-vlans-display', ['management', 'compute', ...storagePurposes]);
  } else if (deploymentPattern === 'switched') {
    // Switched pattern: Management+Compute ports for all TORs
    const section = getElement('#port-section-mgmt-compute');
    if (section) (section as HTMLElement).style.display = '';
    updateVlanDisplay('#mgmt-compute-vlans-display', ['management', 'compute']);
    
    // Switched pattern: Show only the relevant storage section based on TOR role
    // TOR1 → Storage 1 (VLAN 711), TOR2 → Storage 2 (VLAN 712)
    if (role === 'TOR1') {
      const storage1Section = getElement('#port-section-storage1');
      if (storage1Section) (storage1Section as HTMLElement).style.display = '';
      updateVlanDisplay('#storage1-vlans-display', ['storage_1']);
    } else if (role === 'TOR2') {
      const storage2Section = getElement('#port-section-storage2');
      if (storage2Section) (storage2Section as HTMLElement).style.display = '';
      updateVlanDisplay('#storage2-vlans-display', ['storage_2']);
    }
  } else if (deploymentPattern === 'switchless') {
    const section = getElement('#port-section-switchless');
    if (section) (section as HTMLElement).style.display = '';
    updateVlanDisplay('#switchless-vlans-display', ['management', 'compute']);
  }
}

function updateVlanDisplay(containerId: string, purposes: string[]): void {
  // Determine which fields to populate based on the container
  let nativeFieldId = '';
  let taggedFieldId = '';
  let hintId = '';
  let useNativeVlan99 = false; // Only for storage trunk ports, use dummy VLAN 99
  
  if (containerId === '#converged-vlans-display') {
    nativeFieldId = '#intf-converged-native';
    taggedFieldId = '#intf-converged-tagged';
    hintId = '#converged-vlans-hint';
  } else if (containerId === '#mgmt-compute-vlans-display') {
    nativeFieldId = '#intf-mgmt-compute-native';
    taggedFieldId = '#intf-mgmt-compute-tagged';
    hintId = '#mgmt-compute-vlans-hint';
    // Host trunk uses management VLAN as native (NOT 99)
  } else if (containerId === '#storage1-vlans-display') {
    nativeFieldId = '#intf-storage1-native';
    taggedFieldId = '#intf-storage1-tagged';
    hintId = '#storage1-vlans-hint';
    useNativeVlan99 = true; // Storage trunk uses dummy VLAN 99
  } else if (containerId === '#storage2-vlans-display') {
    nativeFieldId = '#intf-storage2-native';
    taggedFieldId = '#intf-storage2-tagged';
    hintId = '#storage2-vlans-hint';
    useNativeVlan99 = true; // Storage trunk uses dummy VLAN 99
  } else if (containerId === '#switchless-vlans-display') {
    nativeFieldId = '#intf-switchless-native';
    taggedFieldId = '#intf-switchless-tagged';
    hintId = '#switchless-vlans-hint';
  }

  // Get VLANs from state matching the specified purposes
  const vlans = (state.config.vlans || [])
    .filter(v => !v.shutdown && purposes.some(p => v.purpose?.includes(p)));

  const mgmtVlan = vlans.find(v => v.purpose === 'management');
  const vlanIds = vlans.map(v => v.vlan_id).join(',');
  const vlanNames = vlans.map(v => `${v.vlan_id} (${v.name})`).join(', ');

  // Populate native VLAN
  if (nativeFieldId) {
    const nativeField = getElement<HTMLInputElement>(nativeFieldId);
    if (nativeField) {
      if (useNativeVlan99) {
        // Switched pattern: use dummy VLAN 99
        nativeField.value = '99';
        nativeField.placeholder = '99';
      } else if (mgmtVlan) {
        // Other patterns: use management VLAN
        nativeField.value = String(mgmtVlan.vlan_id);
        nativeField.placeholder = String(mgmtVlan.vlan_id);
      }
    }
  }

  // Populate tagged VLANs
  if (taggedFieldId) {
    const taggedField = getElement<HTMLInputElement>(taggedFieldId);
    if (taggedField) {
      // For storage VLANs, use defaults if not configured
      if (purposes.includes('storage_1') && !vlanIds) {
        taggedField.value = '711';
        taggedField.placeholder = '711';
      } else if (purposes.includes('storage_2') && !vlanIds) {
        taggedField.value = '712';
        taggedField.placeholder = '712';
      } else {
        taggedField.value = vlanIds;
        taggedField.placeholder = vlanIds || 'No VLANs configured';
      }
    }
  }

  // Update hint with human-readable names
  if (hintId) {
    const hint = getElement(hintId);
    if (hint) {
      if (vlans.length === 0) {
        // Show default hint for storage VLANs
        if (purposes.includes('storage_1')) {
          hint.textContent = '711 (Storage1_711)';
          (hint as HTMLElement).style.color = '#4CAF50';
        } else if (purposes.includes('storage_2')) {
          hint.textContent = '712 (Storage2_712)';
          (hint as HTMLElement).style.color = '#4CAF50';
        } else {
          hint.textContent = 'Complete Step 2 to configure VLANs';
          (hint as HTMLElement).style.color = '#999';
        }
      } else {
        hint.textContent = vlanNames;
        (hint as HTMLElement).style.color = '#4CAF50';
      }
    }
  }
}

function markCompletedSteps(): void {
  // Mark steps as completed based on populated data in state
  const steps = getElements('.nav-step');
  
  // Step 1: Switch info (always completed if vendor/model set)
  if (state.config.switch.vendor && state.config.switch.model) {
    steps[0]?.classList.add('completed');
  }
  
  // Step 2: VLANs (completed if vlans exist)
  if (state.config.vlans && state.config.vlans.length > 0) {
    steps[1]?.classList.add('completed');
  }
  
  // Step 3: Host Ports (completed if trunk interfaces exist that aren't peer-links)
  if (state.config.interfaces && state.config.interfaces.some(i => i.type === 'Trunk')) {
    steps[2]?.classList.add('completed');
  }
  
  // Step 4: Redundancy (completed if mlag or port_channels exist)
  if (state.config.mlag || (state.config.port_channels && state.config.port_channels.length > 0)) {
    steps[3]?.classList.add('completed');
  }
  
  // Step 5: Uplinks (completed if loopback interface exists)
  if (state.config.interfaces && state.config.interfaces.some(i => i.intf_type === 'loopback')) {
    steps[4]?.classList.add('completed');
  }
  
  // Step 6: Routing (completed if bgp or static_routes exist)
  if (state.config.bgp || (state.config.static_routes && state.config.static_routes.length > 0)) {
    steps[5]?.classList.add('completed');
  }
  
  // Step 7: Review (mark as completed if we have enough data)
  if (steps[0]?.classList.contains('completed') && steps[1]?.classList.contains('completed')) {
    steps[6]?.classList.add('completed');
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

export function updateModelCards(): void {
  const vendor = state.config.switch.vendor;
  getElements('.model-card').forEach(card => {
    if (card.dataset.vendor === vendor) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
      card.classList.remove('selected');
    }
  });

  const firstVisible = getElement(`.model-card[data-vendor="${vendor}"]`);
  if (firstVisible && !getElement('.model-card.selected[style=""]')) {
    firstVisible.classList.add('selected');
    state.config.switch.model = firstVisible.dataset.model || '';
  }
}

export function updateRoleBasedSections(): void {
  const role = state.config.switch.role;
  
  toggleElement('#section-mlag', role !== 'BMC');
  toggleElement('#section-ibgp-pc', role !== 'BMC');
  toggleElement('#section-bmc-vlan', role === 'BMC');
}

export function updateRoutingSection(): void {
  const routingType = state.config.routing_type || 'bgp';
  const bgpSection = getElement('#bgp-section');
  const staticSection = getElement('#static-section');
  
  if (bgpSection) {
    (bgpSection as HTMLElement).style.display = routingType === 'bgp' ? '' : 'none';
  }
  if (staticSection) {
    (staticSection as HTMLElement).style.display = routingType === 'static' ? '' : 'none';
  }
}

// ============================================================================
// DATA COLLECTION
// ============================================================================

function collectStepData(): void {
  switch (state.currentStep) {
    case 1:
      collectSwitchData();
      break;
    case 2:
      collectVlanData();
      break;
    case 3:
      collectHostPortsData();
      break;
    case 4:
      collectRedundancyData();
      break;
    case 5:
      collectUplinksData();
      break;
    case 6:
      collectRoutingData();
      break;
  }
}

function collectSwitchData(): void {
  state.config.switch.hostname = getInputValue('#hostname');
  state.config.switch.firmware = VENDOR_FIRMWARE_MAP[state.config.switch.vendor] as Firmware;
}

function collectVlanData(): void {
  const vlans: VLAN[] = [];
  const vendor = state.config.switch.vendor;
  const role = state.config.switch.role;
  const redundancyType = VENDOR_REDUNDANCY_TYPE[vendor];

  const parkingId = parseIntSafe(getInputValue('#vlan-parking-id'));
  if (parkingId) {
    vlans.push({
      vlan_id: parkingId,
      name: 'UNUSED_VLAN',
      shutdown: true
    });
  }

  collectVlansByType('management', vlans, redundancyType, role);
  collectVlansByType('compute', vlans, redundancyType, role);

  const storage1Id = parseIntSafe(getInputValue('#vlan-storage1-id'));
  if (storage1Id) {
    const storage1Name = getInputValue('#vlan-storage1-name');
    vlans.push({
      vlan_id: storage1Id,
      name: storage1Name || `Storage1_${storage1Id}`,
      purpose: 'storage_1'
    });
  }

  const storage2Id = parseIntSafe(getInputValue('#vlan-storage2-id'));
  if (storage2Id) {
    const storage2Name = getInputValue('#vlan-storage2-name');
    vlans.push({
      vlan_id: storage2Id,
      name: storage2Name || `Storage2_${storage2Id}`,
      purpose: 'storage_2'
    });
  }

  if (role === 'BMC') {
    const bmcId = parseIntSafe(getInputValue('#vlan-bmc-id'));
    if (bmcId) {
      const bmcName = getInputValue('#vlan-bmc-name');
      const bmcVlan: VLAN = {
        vlan_id: bmcId,
        name: bmcName || `BMC_${bmcId}`,
        purpose: 'bmc'
      };
      
      const bmcIp = getInputValue('#vlan-bmc-ip');
      if (bmcIp) {
        bmcVlan.interface = {
          ip: bmcIp,
          cidr: parseIntSafe(getInputValue('#vlan-bmc-cidr'), 26),
          mtu: 9216
        };
      }
      vlans.push(bmcVlan);
    }
  }

  state.config.vlans = vlans;
}

function collectVlansByType(
  type: 'management' | 'compute',
  vlans: VLAN[],
  redundancyType: RedundancyType,
  role: Role
): void {
  const config = VLAN_CONFIGS[type];
  if (!config) return;

  const cards = getElements<HTMLElement>(`[data-vlan-type="${type}"]`);
  const cssClass = config.cssClass;

  cards.forEach((card) => {
    const vlanIdInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-id`);
    const vlanId = vlanIdInput ? parseInt(vlanIdInput.value) : 0;
    if (!vlanId) return;

    const customNameInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-name`);
    const customName = customNameInput?.value || '';
    
    const vlan: VLAN = {
      vlan_id: vlanId,
      name: customName || `${config.namePrefix}_${vlanId}`,
      purpose: config.purpose
    };
    
    const ipInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-ip`);
    const ipValue = ipInput?.value || '';
    if (ipValue) {
      const parts = ipValue.includes('/') ? ipValue.split('/') : [ipValue, '24'];
      const ip = parts[0] || '';
      const cidr = parts[1] || '24';
      vlan.interface = {
        ip: ip,
        cidr: parseInt(cidr, 10) || 24,
        mtu: 9216
      };
      
      const gatewayInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-gateway`);
      const gatewayValue = gatewayInput?.value || '';
      if (gatewayValue && role !== 'BMC' && vlan.interface) {
        const gwIp = (gatewayValue.includes('/') ? gatewayValue.split('/')[0] : gatewayValue) || '';
        vlan.interface.redundancy = {
          type: redundancyType,
          virtual_ip: gwIp,
          preempt: true,
          group: vlanId,
          priority: ROLE_DEFAULTS[role].hsrp_priority || 100
        };
      }

      const dhcpInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-dhcp`);
      const dhcpRelay = dhcpInput?.value || '';
      if (dhcpRelay && vlan.interface) {
        vlan.interface.dhcp_relay = dhcpRelay.split(',').map(s => s.trim());
      }
    }
    
    vlans.push(vlan);
  });
}

function collectHostPortsData(): void {
  const interfaces: Interface[] = [];
  const deploymentPattern = state.config.switch.deployment_pattern;
  const role = state.config.switch.role || 'TOR1';
  
  const mgmtVlan = (state.config.vlans || []).find(v => v.purpose === 'management');
  const nativeVlan = mgmtVlan ? String(mgmtVlan.vlan_id) : '7';

  const allVlans = (state.config.vlans || [])
    .filter(v => !v.shutdown)
    .map(v => v.vlan_id)
    .join(',');

  const mgmtComputeVlans = (state.config.vlans || [])
    .filter(v => !v.shutdown && (v.purpose === 'management' || v.purpose === 'compute'))
    .map(v => v.vlan_id)
    .join(',');

  if (deploymentPattern === 'fully_converged') {
    // Fully converged: All VLANs on same ports
    const start = getInputValue('#intf-converged-start');
    const end = getInputValue('#intf-converged-end');
    const qos = getElement<HTMLInputElement>('#intf-converged-qos');
    const nativeVlanInput = getInputValue('#intf-converged-native');
    const taggedVlansInput = getInputValue('#intf-converged-tagged');
    
    if (start && end) {
      interfaces.push({
        name: 'HyperConverged_To_Hosts',
        type: 'Trunk',
        intf_type: 'Ethernet',
        start_intf: start,
        end_intf: end,
        native_vlan: nativeVlanInput || nativeVlan,
        tagged_vlans: taggedVlansInput || allVlans,
        qos: qos?.checked || false
      } as Interface);
    }
  } else if (deploymentPattern === 'switched') {
    // Storage switched: Separate mgmt/compute and storage ports
    const mgmtStart = getInputValue('#intf-mgmt-compute-start');
    const mgmtEnd = getInputValue('#intf-mgmt-compute-end');
    const mgmtNativeInput = getInputValue('#intf-mgmt-compute-native');
    const mgmtTaggedInput = getInputValue('#intf-mgmt-compute-tagged');
    
    if (mgmtStart && mgmtEnd) {
      interfaces.push({
        name: 'Host_Trunk',
        type: 'Trunk',
        intf_type: 'Ethernet',
        start_intf: mgmtStart,
        end_intf: mgmtEnd,
        native_vlan: mgmtNativeInput || nativeVlan, // Use management VLAN as native
        tagged_vlans: mgmtTaggedInput || mgmtComputeVlans
      } as Interface);
    }

    // Storage Trunk: Only collect for the appropriate TOR role
    // TOR1 → Storage 1 (VLAN 711), TOR2 → Storage 2 (VLAN 712)
    if (role === 'TOR1') {
      const storage1Start = getInputValue('#intf-storage1-start');
      const storage1End = getInputValue('#intf-storage1-end');
      const storage1NativeInput = getInputValue('#intf-storage1-native');
      const storage1TaggedInput = getInputValue('#intf-storage1-tagged');
      
      if (storage1Start && storage1End) {
        const storage1Qos = getElement<HTMLInputElement>('#intf-storage1-qos');
        interfaces.push({
          name: 'Storage_Trunk',
          type: 'Trunk',
          intf_type: 'Ethernet',
          start_intf: storage1Start,
          end_intf: storage1End,
          native_vlan: storage1NativeInput || '99', // Storage trunk uses dummy VLAN 99
          tagged_vlans: storage1TaggedInput || '711',
          qos: storage1Qos?.checked || false
        } as Interface);
      }
    } else if (role === 'TOR2') {
      const storage2Start = getInputValue('#intf-storage2-start');
      const storage2End = getInputValue('#intf-storage2-end');
      const storage2NativeInput = getInputValue('#intf-storage2-native');
      const storage2TaggedInput = getInputValue('#intf-storage2-tagged');
      
      if (storage2Start && storage2End) {
        const storage2Qos = getElement<HTMLInputElement>('#intf-storage2-qos');
        interfaces.push({
          name: 'Storage_Trunk',
          type: 'Trunk',
          intf_type: 'Ethernet',
          start_intf: storage2Start,
          end_intf: storage2End,
          native_vlan: storage2NativeInput || '99', // Storage trunk uses dummy VLAN 99
          tagged_vlans: storage2TaggedInput || '712',
          qos: storage2Qos?.checked || false
        } as Interface);
      }
    }
  } else if (deploymentPattern === 'switchless') {
    // Switchless: Only mgmt/compute ports (no storage network)
    const start = getInputValue('#intf-switchless-start');
    const end = getInputValue('#intf-switchless-end');
    const nativeVlanInput = getInputValue('#intf-switchless-native');
    const taggedVlansInput = getInputValue('#intf-switchless-tagged');
    
    if (start && end) {
      interfaces.push({
        name: 'Host_Trunk',
        type: 'Trunk',
        intf_type: 'Ethernet',
        start_intf: start,
        end_intf: end,
        native_vlan: nativeVlanInput || nativeVlan,
        tagged_vlans: taggedVlansInput || mgmtComputeVlans
      } as Interface);
    }
  }

  state.config.interfaces = interfaces;
}

function collectRedundancyData(): void {
  const role = state.config.switch.role;
  const portChannels: PortChannel[] = [];
  
  const taggedVlans = (state.config.vlans || [])
    .filter(v => !v.shutdown)
    .map(v => v.vlan_id)
    .join(',');

  if (role !== 'BMC') {
    const ibgpPcId = parseIntSafe(getInputValue('#pc-ibgp-id'));
    const ibgpPcIp = getInputValue('#pc-ibgp-ip');
    const ibgpMembers = getInputValue('#pc-ibgp-members');
    if (ibgpPcId && ibgpPcIp) {
      portChannels.push({
        id: ibgpPcId,
        description: 'iBGP_Peer_Link_To_TOR2',
        type: 'L3',
        ipv4: ibgpPcIp,
        members: ibgpMembers ? ibgpMembers.split(',').map(s => s.trim()) : []
      });
    }

    // MLAG Peer-Link Port-Channel (editable)
    const peerLinkId = parseIntSafe(getInputValue('#mlag-peerlink-id'), MLAG_PEER_LINK_ID);
    const peerLinkMembersInput = getInputValue('#mlag-peerlink-members');
    const peerLinkMembers = peerLinkMembersInput
      ? peerLinkMembersInput.split(',').map(s => s.trim()).filter(Boolean)
      : MLAG_PEER_LINK_MEMBERS;

    portChannels.push({
      id: peerLinkId,
      description: 'MLAG_Peer_Link_To_TOR2',
      type: 'Trunk',
      native_vlan: MLAG_NATIVE_VLAN,
      tagged_vlans: taggedVlans,
      vpc_peer_link: true,
      members: peerLinkMembers
    });

    const keepaliveSrc = getInputValue('#mlag-keepalive-src');
    const keepaliveDst = getInputValue('#mlag-keepalive-dst');
    if (keepaliveSrc && keepaliveDst) {
      state.config.mlag = {
        domain_id: parseIntSafe(getInputValue('#mlag-domain-id'), 1),
        peer_keepalive: {
          source_ip: keepaliveSrc,
          destination_ip: keepaliveDst
        }
      };
    }
  } else {
    state.config.mlag = undefined;
  }

  state.config.port_channels = portChannels;
}

function collectUplinksData(): void {
  const interfaces = state.config.interfaces || [];
  
  const loopbackIp = getInputValue('#intf-loopback-ip');
  if (loopbackIp) {
    interfaces.push({
      name: 'Loopback0',
      type: 'L3',
      intf_type: 'loopback',
      intf: 'loopback0',
      ipv4: loopbackIp
    });
  }

  const uplink1Port = getInputValue('#intf-uplink1-port');
  const uplink1Ip = getInputValue('#intf-uplink1-ip');
  if (uplink1Port && uplink1Ip) {
    interfaces.push({
      name: 'P2P_Border1',
      type: 'L3',
      intf_type: 'Ethernet',
      intf: uplink1Port,
      ipv4: uplink1Ip
    });
  }

  const uplink2Port = getInputValue('#intf-uplink2-port');
  const uplink2Ip = getInputValue('#intf-uplink2-ip');
  if (uplink2Port && uplink2Ip) {
    interfaces.push({
      name: 'P2P_Border2',
      type: 'L3',
      intf_type: 'Ethernet',
      intf: uplink2Port,
      ipv4: uplink2Ip
    });
  }

  state.config.interfaces = interfaces;
}

// Legacy function removed - now split into separate functions

function collectRoutingData(): void {
  if (state.config.routing_type === 'bgp') {
    collectBgpData();
    state.config.static_routes = [];
  } else {
    collectStaticRoutesData();
    state.config.bgp = undefined;
    state.config.prefix_lists = {};
  }
}

function collectBgpData(): void {
  const asn = parseIntSafe(getInputValue('#bgp-asn'));
  const loopbackIp = getInputValue('#intf-loopback-ip');
  const routerId = loopbackIp ? loopbackIp.split('/')[0] || '' : '';

  const networks: string[] = [];
  if (loopbackIp) networks.push(loopbackIp);
  
  const uplink1Ip = getInputValue('#intf-uplink1-ip');
  if (uplink1Ip) networks.push(uplink1Ip);

  const neighbors: BGPNeighbor[] = [];
  getElements('.neighbor-entry').forEach(entry => {
    const ipInput = entry.querySelector<HTMLInputElement>('.bgp-neighbor-ip');
    const descInput = entry.querySelector<HTMLInputElement>('.bgp-neighbor-desc');
    const asnInput = entry.querySelector<HTMLInputElement>('.bgp-neighbor-asn');
    
    const ip = ipInput?.value || '';
    const desc = descInput?.value || '';
    const remoteAsn = asnInput ? parseInt(asnInput.value) : 0;
    
    if (ip && remoteAsn) {
      neighbors.push({
        ip: ip,
        description: desc || `TO_${ip}`,
        remote_as: remoteAsn,
        af_ipv4_unicast: {
          prefix_list_in: 'DefaultRoute'
        }
      });
    }
  });

  state.config.bgp = {
    asn: asn,
    router_id: routerId,
    networks: networks,
    neighbors: neighbors
  };

  state.config.prefix_lists = {
    DefaultRoute: [
      { seq: 10, action: 'permit', prefix: '0.0.0.0/0' },
      { seq: 50, action: 'deny', prefix: '0.0.0.0/0', prefix_filter: 'le 32' }
    ]
  };
}

function collectStaticRoutesData(): void {
  const routes: Array<{ destination: string; next_hop: string; name?: string }> = [];
  
  const defaultEnabled = getElement<HTMLInputElement>('#static-default-enabled');
  if (defaultEnabled?.checked) {
    const nexthop = getInputValue('#static-default-nexthop');
    if (nexthop) {
      routes.push({
        destination: '0.0.0.0/0',
        next_hop: nexthop,
        name: 'Default_Route'
      });
    }
  }

  getElements('.static-route-entry').forEach(entry => {
    const destInput = entry.querySelector<HTMLInputElement>('.route-dest');
    const nexthopInput = entry.querySelector<HTMLInputElement>('.route-nexthop');
    const nameInput = entry.querySelector<HTMLInputElement>('.route-name');
    
    const dest = destInput?.value;
    const nexthop = nexthopInput?.value;
    const name = nameInput?.value;
    
    if (dest && nexthop) {
      routes.push({
        destination: dest,
        next_hop: nexthop,
        name: name || `Route_to_${dest}`
      });
    }
  });

  state.config.static_routes = routes;
}

// ============================================================================
// DYNAMIC UI ELEMENTS
// ============================================================================

export function addDynamicVlan(type: 'management' | 'compute', data: VLAN | null = null): void {
  const config = VLAN_CONFIGS[type];
  if (!config) return;

  const containerId = type === 'management' ? 'mgmt-vlans-container' : 'compute-vlans-container';
  const container = getElement(`#${containerId}`);
  if (!container) return;

  const index = config.counter++;
  const vlanId = config.defaultVlanId(index);
  
  const card = document.createElement('div');
  card.className = 'vlan-card dynamic-vlan';
  card.dataset.vlanType = type;
  card.dataset.vlanIndex = String(index);

  card.innerHTML = createVlanCardHTML(config, index, vlanId);
  container.appendChild(card);

  if (data) {
    populateVlanCard(card, config, data);
  }
}

function createVlanCardHTML(config: VLANConfig, index: number, vlanId: number): string {
  const switchIp = typeof config.switchIpPlaceholder === 'function' 
    ? config.switchIpPlaceholder(index) 
    : config.switchIpPlaceholder;
  
  const gateway = typeof config.gatewayPlaceholder === 'function'
    ? config.gatewayPlaceholder(index)
    : config.gatewayPlaceholder;

  return `
    <div class="card-header">
      <h4>${config.label} VLAN #${index + 1}</h4>
      <button type="button" class="btn-remove-vlan" data-remove-vlan="true">× Remove</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>VLAN ID <span class="required">*</span></label>
        <input type="number" class="vlan-${config.cssClass}-id" value="${vlanId}" placeholder="${vlanId}" min="2" max="4094" data-css-class="${config.cssClass}" data-name-prefix="${config.namePrefix}">
      </div>
      <div class="form-group">
        <label>VLAN Name</label>
        <input type="text" class="vlan-${config.cssClass}-name" value="${config.namePrefix}_${vlanId}" placeholder="${config.namePrefix}_${vlanId}" style="color: #666;">
        <small>Optional - defaults to ${config.namePrefix}_{vlan_id}</small>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Switch IP</label>
        <input type="text" class="vlan-${config.cssClass}-ip" placeholder="${switchIp}">
      </div>
      <div class="form-group">
        <label>Gateway VIP (HSRP/VRRP)</label>
        <input type="text" class="vlan-${config.cssClass}-gateway" placeholder="${gateway}">
      </div>
    </div>
    <div class="form-group">
      <label>DHCP Relay (optional, comma-separated)</label>
      <input type="text" class="vlan-${config.cssClass}-dhcp" placeholder="100.71.85.107,100.71.85.108">
    </div>
  `;
}

function populateVlanCard(card: HTMLElement, config: VLANConfig, data: VLAN): void {
  const cssClass = config.cssClass;

  const idInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-id`);
  const nameInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-name`);
  const ipInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-ip`);
  const gatewayInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-gateway`);
  const dhcpInput = card.querySelector<HTMLInputElement>(`.vlan-${cssClass}-dhcp`);

  if (idInput && data.vlan_id) {
    idInput.value = String(data.vlan_id);
    idInput.placeholder = String(data.vlan_id);
  }

  if (nameInput) {
    const defaultName = `${config.namePrefix}_${data.vlan_id || ''}`;
    const customName = data.name || defaultName;
    nameInput.value = customName;
    nameInput.placeholder = defaultName;
    nameInput.style.color = data.name ? '#333' : '#666';
  }

  if (ipInput && data.interface?.ip) {
    const cidr = data.interface?.cidr || 24;
    ipInput.value = `${data.interface.ip}/${cidr}`;
  }

  if (gatewayInput && data.interface?.redundancy?.virtual_ip) {
    const cidr = data.interface?.cidr || 24;
    gatewayInput.value = `${data.interface.redundancy.virtual_ip}/${cidr}`;
  }

  if (dhcpInput && data.interface?.dhcp_relay) {
    dhcpInput.value = data.interface.dhcp_relay.join(',');
  }
}

export function setupVlanCardDelegation(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.removeVlan === 'true') {
      removeDynamicVlan(target);
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains('vlan-mgmt-id') || target.classList.contains('vlan-compute-id')) {
      updateVlanName(target);
    }
  });
}

function removeDynamicVlan(btn: HTMLElement): void {
  const card = btn.closest('.vlan-card');
  if (card && confirm('Remove this VLAN?')) {
    card.remove();
  }
}

export function updateVlanName(idInput: HTMLInputElement, type?: string, prefix?: string): void {
  const vlanId = idInput.value;
  if (!vlanId) return;
  
  const cssClass = type || idInput.dataset.cssClass;
  const namePrefix = prefix || idInput.dataset.namePrefix;
  if (!cssClass || !namePrefix) return;
  
  const card = idInput.closest('.vlan-card');
  const nameInput = card?.querySelector<HTMLInputElement>(`.vlan-${cssClass}-name`);
  
  if (nameInput) {
    const newName = `${namePrefix}_${vlanId}`;
    nameInput.placeholder = newName;
    
    const currentValue = nameInput.value.trim();
    const isAutoGenerated = !currentValue || /^(Infra|Compute)_\d+$/.test(currentValue);
    
    if (isAutoGenerated) {
      nameInput.value = newName;
      nameInput.style.color = '#666';
    }
  }
}

function addBgpNeighbor(): void {
  const container = getElement('#bgp-neighbors');
  if (!container) return;

  const neighborCount = container.querySelectorAll('.neighbor-entry').length + 1;
  const defaultDesc = neighborCount === 1 ? 'TO_BORDER1' : `TO_BORDER${neighborCount}`;

  const entry = document.createElement('div');
  entry.className = 'neighbor-entry';
  entry.innerHTML = `
    <div class="neighbor-header">
      <span class="neighbor-title">Neighbor ${neighborCount}</span>
      <button type="button" class="btn-remove-neighbor" title="Remove this neighbor">✕</button>
    </div>
    <div class="neighbor-fields">
      <div class="form-group">
        <label>Neighbor IP <span class="required">*</span></label>
        <input type="text" class="bgp-neighbor-ip" placeholder="198.51.100.5">
      </div>
      <div class="form-group">
        <label>Remote ASN <span class="required">*</span></label>
        <input type="number" class="bgp-neighbor-asn" placeholder="65010">
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" class="bgp-neighbor-desc" placeholder="${defaultDesc}">
      </div>
    </div>
  `;
  container.appendChild(entry);
}

// ============================================================================
// TEMPLATE LIST RENDERING (dynamic)
// ============================================================================

const EXAMPLE_TEMPLATES = import.meta.glob('../examples/**/*.json', { eager: true, query: '?url', import: 'default' });

type TemplateCard = {
  key: string;
  pattern: string;
  name: string;
};

function getTemplateCards(): TemplateCard[] {
  return Object.keys(EXAMPLE_TEMPLATES).map((path) => {
    const rel = path.split('/examples/')[1] || path.split('examples/')[1] || '';
    const [pattern, filename] = rel.split('/');
    const name = (filename || '').replace(/\.json$/i, '');
    return {
      key: `${pattern}/${name}`,
      pattern: pattern || '',
      name
    };
  }).filter(card => card.pattern && card.name);
}

function resolveTemplateUrl(templateName: string): string {
  const matchKey = Object.keys(EXAMPLE_TEMPLATES).find((key) =>
    key.endsWith(`/examples/${templateName}.json`) || key.endsWith(`examples/${templateName}.json`)
  );
  if (matchKey) return EXAMPLE_TEMPLATES[matchKey] as string;
  return `${import.meta.env.BASE_URL}examples/${templateName}.json`;
}

function getPatternLabel(pattern: string): string {
  switch (pattern) {
    case 'fully-converged':
      return '🔄 Fully Converged';
    case 'switched':
      return '💾 Switched';
    case 'switchless':
      return '🔌 Switchless';
    default:
      return pattern;
  }
}

function getTemplateTitle(name: string): string {
  if (name.includes('tor1')) return '🔵 TOR1 (Primary)';
  if (name.includes('tor2')) return '🟢 TOR2 (Secondary)';
  return name;
}

function getTemplateDescription(pattern: string, name: string): string {
  if (pattern === 'switchless') return 'Management + Compute only (no storage)';
  if (pattern === 'switched' && name.includes('tor1')) return 'Storage on dedicated ports (S1 only)';
  if (pattern === 'switched' && name.includes('tor2')) return 'Storage on dedicated ports (S2 only)';
  if (pattern === 'fully-converged' && name.includes('tor1')) return 'All VLANs (M, C, S1, S2) on shared ports';
  if (pattern === 'fully-converged' && name.includes('tor2')) return 'Paired with TOR1 for high availability';
  return 'Pre-configured example template';
}

function getTemplateTags(pattern: string): string[] {
  const tags = [] as string[];
  if (pattern === 'fully-converged') tags.push('Fully Converged');
  if (pattern === 'switched') tags.push('Switched');
  if (pattern === 'switchless') tags.push('Switchless');
  tags.push('BGP');
  if (pattern !== 'switchless') tags.push('MLAG');
  return tags;
}

function renderTemplateList(): void {
  const container = getElement('#template-list');
  if (!container) return;

  const cards = getTemplateCards();
  const patterns = ['fully-converged', 'switched', 'switchless'];

  container.innerHTML = '';

  patterns.forEach(pattern => {
    const patternCards = cards.filter(card => card.pattern === pattern);
    if (patternCards.length === 0) return;

    const title = document.createElement('h3');
    title.className = 'template-category';
    title.textContent = getPatternLabel(pattern);
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'template-grid';

    patternCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'template-card';
      cardEl.addEventListener('click', () => loadTemplate(card.key));

      const h4 = document.createElement('h4');
      h4.textContent = getTemplateTitle(card.name);

      const desc = document.createElement('p');
      desc.textContent = getTemplateDescription(pattern, card.name);

      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'template-tags';
      getTemplateTags(pattern).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        tagsWrap.appendChild(span);
      });

      cardEl.appendChild(h4);
      cardEl.appendChild(desc);
      cardEl.appendChild(tagsWrap);
      grid.appendChild(cardEl);
    });

    container.appendChild(grid);
  });
}

function addStaticRoute(): void {
  const container = getElement('#static-routes-container');
  if (!container) return;

  const entry = document.createElement('div');
  entry.className = 'static-route-entry';
  entry.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Destination (CIDR)</label>
        <input type="text" class="route-dest" placeholder="10.0.0.0/24">
      </div>
      <div class="form-group">
        <label>Next Hop IP</label>
        <input type="text" class="route-nexthop" placeholder="192.168.1.1">
      </div>
      <div class="form-group">
        <label>Name (optional)</label>
        <input type="text" class="route-name" placeholder="To_Datacenter">
      </div>
      <button type="button" class="btn-remove" data-remove-entry="route">Remove</button>
    </div>
  `;
  container.appendChild(entry);
}

export function setupRouteDelegation(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.removeEntry) {
      const entry = target.closest('.neighbor-entry, .static-route-entry');
      if (entry) {
        entry.remove();
      }
    }
  });
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateCurrentStep(): boolean {
  clearValidationErrors();
  
  switch (state.currentStep) {
    case 1:
      return validateSwitchStep();
    case 2:
      return validateVlanStep();
    case 3:
      return validateHostPortsStep();
    case 4:
      return validateRedundancyStep();
    case 5:
      return validateUplinksStep();
    case 6:
      return validateRoutingStep();
    default:
      return true;
  }
}

function validateSwitchStep(): boolean {
  const hostname = getInputValue('#hostname');
  if (!hostname) {
    showValidationError('⚠️ Hostname is required');
    return false;
  }
  
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(hostname)) {
    showValidationError('⚠️ Invalid hostname format. Use letters, numbers, dots, hyphens, and underscores only.');
    return false;
  }
  
  return true;
}

function validateVlanStep(): boolean {
  if ((state.config.vlans || []).length === 0) {
    showValidationError('⚠️ At least one VLAN is required. Please add a Management or Compute VLAN.');
    return false;
  }
  
  const hasManagement = state.config.vlans?.some(v => v.purpose === 'management');
  if (!hasManagement) {
    showValidationError('⚠️ At least one Management VLAN is required for switch management.');
    return false;
  }
  
  return true;
}

function validateHostPortsStep(): boolean {
  const deploymentPattern = state.config.switch.deployment_pattern || 'fully_converged';
  let hostStart = '';
  let hostEnd = '';
  
  // Check appropriate fields based on deployment pattern
  if (deploymentPattern === 'fully_converged') {
    hostStart = getInputValue('#intf-converged-start');
    hostEnd = getInputValue('#intf-converged-end');
  } else if (deploymentPattern === 'switched') {
    hostStart = getInputValue('#intf-mgmt-compute-start');
    hostEnd = getInputValue('#intf-mgmt-compute-end');
  } else if (deploymentPattern === 'switchless') {
    hostStart = getInputValue('#intf-switchless-start');
    hostEnd = getInputValue('#intf-switchless-end');
  }
  
  if (!hostStart || !hostEnd) {
    showValidationError('⚠️ Host port range is required. Specify both start and end ports.');
    return false;
  }
  
  return true;
}

function validateRedundancyStep(): boolean {
  const role = state.config.switch.role;
  
  // BMC switches skip MLAG validation
  if (role === 'BMC') {
    return true;
  }
  
  const keepaliveSrc = getInputValue('#mlag-keepalive-src');
  const keepaliveDst = getInputValue('#mlag-keepalive-dst');
  
  if (!keepaliveSrc || !keepaliveDst) {
    showValidationError('⚠️ MLAG keepalive IPs are required for TOR switches. Specify both source and destination IPs.');
    return false;
  }
  
  return true;
}

function validateUplinksStep(): boolean {
  const loopbackIp = getInputValue('#intf-loopback-ip');
  
  if (!loopbackIp) {
    showValidationError('⚠️ Loopback IP is required for BGP router-id.');
    return false;
  }
  
  if (!loopbackIp.includes('/32')) {
    showValidationError('⚠️ Loopback IP must be /32 (e.g., 203.0.113.1/32)');
    return false;
  }
  
  return true;
}

function validateRoutingStep(): boolean {
  if (state.config.routing_type === 'bgp') {
    const asn = getInputValue('#bgp-asn');
    if (!asn) {
      showValidationError('⚠️ BGP ASN is required for BGP routing.');
      return false;
    }
  }
  
  return true;
}

function showValidationError(message: string): void {
  const errorDiv = getElement('#validation-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Scroll to error message
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

function clearValidationErrors(): void {
  const errorDiv = getElement('#validation-error');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function showSuccessMessage(message: string): void {
  const successDiv = getElement('#success-message');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }
}

// ============================================================================
// REVIEW & EXPORT
// ============================================================================

function populateReviewStep(): void {
  const summary = getElement('#config-summary');
  if (summary) {
    const vendorDisplay = DISPLAY_NAMES.vendors[state.config.switch.vendor];
    const modelDisplay = DISPLAY_NAMES.models[state.config.switch.model as keyof typeof DISPLAY_NAMES.models] || state.config.switch.model;
    const patternDisplay = DISPLAY_NAMES.patterns[state.config.switch.deployment_pattern as keyof typeof DISPLAY_NAMES.patterns];
    const routingSummary = state.config.routing_type === 'bgp'
      ? `BGP ASN ${state.config.bgp?.asn || 'N/A'}`
      : `Static Routes (${state.config.static_routes?.length || 0})`;
    
    summary.innerHTML = `
      <div class="summary-grid">
        <div class="summary-card">
          <h4>Switch</h4>
          <div class="summary-row">
            <span class="summary-label">Hostname</span>
            <span class="summary-value">${state.config.switch.hostname || 'Not set'}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Vendor / Model</span>
            <span class="summary-value">${vendorDisplay} ${modelDisplay}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Role</span>
            <span class="summary-value">${state.config.switch.role || 'Not set'}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Firmware</span>
            <span class="summary-value">${state.config.switch.firmware || 'Not set'}</span>
          </div>
        </div>

        <div class="summary-card">
          <h4>Pattern</h4>
          <div class="summary-row">
            <span class="summary-label">Deployment</span>
            <span class="summary-value">${patternDisplay || 'Not set'}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">VLANs</span>
            <span class="summary-value">${state.config.vlans?.length || 0} configured</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Interfaces</span>
            <span class="summary-value">${state.config.interfaces?.length || 0} configured</span>
          </div>
        </div>

        <div class="summary-card">
          <h4>Redundancy</h4>
          <div class="summary-row">
            <span class="summary-label">Port Channels</span>
            <span class="summary-value">${state.config.port_channels?.length || 0} configured</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">MLAG</span>
            <span class="summary-value">${state.config.mlag ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>

        <div class="summary-card">
          <h4>Routing</h4>
          <div class="summary-row">
            <span class="summary-label">Type</span>
            <span class="summary-value">${state.config.routing_type === 'bgp' ? 'BGP' : 'Static'}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Details</span>
            <span class="summary-value">${routingSummary}</span>
          </div>
        </div>
      </div>
    `;
  }

  const jsonPreview = getElement('#json-preview');
  if (jsonPreview) {
    const exportConfig = buildExportConfig();
    jsonPreview.textContent = formatJSON(exportConfig);
  }
}

function buildExportConfig(): Partial<StandardConfig> {
  const config: any = {
    switch: state.config.switch
  };

  if (state.config.vlans && state.config.vlans.length > 0) {
    config.vlans = state.config.vlans;
  }

  if (state.config.interfaces && state.config.interfaces.length > 0) {
    config.interfaces = state.config.interfaces;
  }

  if (state.config.port_channels && state.config.port_channels.length > 0) {
    config.port_channels = state.config.port_channels;
  }

  if (state.config.mlag) {
    config.mlag = state.config.mlag;
  }

  if (state.config.routing_type === 'bgp' && state.config.bgp) {
    if (state.config.prefix_lists && Object.keys(state.config.prefix_lists).length > 0) {
      config.prefix_lists = state.config.prefix_lists;
    }
    config.bgp = state.config.bgp;
  } else if (state.config.static_routes && state.config.static_routes.length > 0) {
    config.static_routes = state.config.static_routes;
  }

  return config;
}

function exportJSONFile(): void {
  const config = buildExportConfig();
  const filename = `${state.config.switch.hostname || 'switch'}-config.json`;
  downloadJSON(config, filename);
  showSuccessMessage('Configuration exported successfully!');
}

async function copyJSON(): Promise<void> {
  const config = buildExportConfig();
  const success = await copyToClipboard(formatJSON(config));
  if (success) {
    showSuccessMessage('Configuration copied to clipboard!');
  } else {
    showValidationError('Failed to copy to clipboard');
  }
}

export function startOver(): void {
  if (confirm('Are you sure you want to reset all configuration?')) {
    location.reload();
  }
}

// ============================================================================
// IMPORT
// ============================================================================

function handleFileImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = e.target?.result;
      if (typeof result === 'string') {
        const imported = JSON.parse(result);
        loadConfig(imported);
        showSuccessMessage('Configuration imported successfully!');
      }
    } catch (err) {
      showValidationError('Failed to parse JSON file: ' + (err as Error).message);
    }
  };
  reader.readAsText(file);
}

function loadConfig(config: Partial<StandardConfig>): void {
  console.log('Loading config:', config);
  
  // Phase 1: Switch config
  if (config.switch) {
    state.config.switch = { ...state.config.switch, ...config.switch };
    
    // Load pattern first (new pattern-first approach)
    if (config.switch.deployment_pattern) {
      console.log('Loading pattern:', config.switch.deployment_pattern);
      selectPattern(config.switch.deployment_pattern);
    }
    
    // Load vendor
    if (config.switch.vendor) {
      console.log('Loading vendor:', config.switch.vendor);
      const vendorSelect = getElement<HTMLSelectElement>('#vendor-select');
      if (vendorSelect) {
        vendorSelect.value = config.switch.vendor;
        onVendorChange(); // This will populate model dropdown
      }
    }
    
    // Load model
    if (config.switch.model) {
      console.log('Loading model:', config.switch.model);
      const modelValue = config.switch.model;
      setTimeout(() => {
        const modelSelect = getElement<HTMLSelectElement>('#model-select');
        if (modelSelect) {
          modelSelect.value = modelValue;
          onModelChange(); // This will show role section
        }
      }, 100);
    }
    
    // Load role
    if (config.switch.role) {
      console.log('Loading role:', config.switch.role);
      const roleValue = config.switch.role;
      setTimeout(() => {
        selectRole(roleValue);
      }, 200);
    }
    
    // Load hostname
    if (config.switch.hostname) {
      console.log('Loading hostname:', config.switch.hostname);
      const hostnameValue = config.switch.hostname;
      setTimeout(() => {
        setInputValue('#hostname', hostnameValue);
        state.config.switch.hostname = hostnameValue;
      }, 300);
    }
  }

  // Step 2: VLANs
  if (Array.isArray(config.vlans)) {
    state.config.vlans = config.vlans; // Update state
    populateVlansFromConfig(config.vlans);
    
    // Populate storage VLANs
    const storage1 = config.vlans.find(v => v.purpose === 'storage_1');
    if (storage1) {
      setInputValue('#vlan-storage1-id', String(storage1.vlan_id));
      setInputValue('#vlan-storage1-name', storage1.name || `Storage1_${storage1.vlan_id}`);
    }
    
    const storage2 = config.vlans.find(v => v.purpose === 'storage_2');
    if (storage2) {
      setInputValue('#vlan-storage2-id', String(storage2.vlan_id));
      setInputValue('#vlan-storage2-name', storage2.name || `Storage2_${storage2.vlan_id}`);
    }
  }

  updateHostPortsSections();

  // Step 3: Host ports - adapt to deployment pattern
  if (Array.isArray(config.interfaces)) {
    state.config.interfaces = config.interfaces; // Update state
    const deploymentPattern = config.switch?.deployment_pattern || 'fully_converged';
    
    if (deploymentPattern === 'fully_converged') {
      const hostInterface = config.interfaces.find(i => i.type === 'Trunk' && i.start_intf);
      if (hostInterface) {
        setInputValue('#intf-converged-start', hostInterface.start_intf || '');
        setInputValue('#intf-converged-end', hostInterface.end_intf || '');
        setInputValue('#intf-converged-native', hostInterface.native_vlan || '');
        setInputValue('#intf-converged-tagged', hostInterface.tagged_vlans || '');
        const qosCheckbox = getElement<HTMLInputElement>('#intf-converged-qos');
        if (qosCheckbox) qosCheckbox.checked = hostInterface.qos || false;
      }
    } else if (deploymentPattern === 'switched') {
      const mgmtInterface = config.interfaces.find(i => i.name?.includes('Management') || i.name?.includes('Compute'));
      if (mgmtInterface) {
        setInputValue('#intf-mgmt-compute-start', mgmtInterface.start_intf || '');
        setInputValue('#intf-mgmt-compute-end', mgmtInterface.end_intf || '');
        setInputValue('#intf-mgmt-compute-native', mgmtInterface.native_vlan || '');
        setInputValue('#intf-mgmt-compute-tagged', mgmtInterface.tagged_vlans || '');
      }
      
      const storageInterface = config.interfaces.find(i => i.name?.includes('Storage'));
      if (storageInterface) {
        setInputValue('#intf-storage-start', storageInterface.start_intf || '');
        setInputValue('#intf-storage-end', storageInterface.end_intf || '');
        setInputValue('#intf-storage-native', storageInterface.native_vlan || '');
        setInputValue('#intf-storage-tagged', storageInterface.tagged_vlans || '');
        const storageQos = getElement<HTMLInputElement>('#intf-storage-qos');
        if (storageQos) storageQos.checked = storageInterface.qos || false;
      }
    } else if (deploymentPattern === 'switchless') {
      const hostInterface = config.interfaces.find(i => i.type === 'Trunk' && i.start_intf);
      if (hostInterface) {
        setInputValue('#intf-switchless-start', hostInterface.start_intf || '');
        setInputValue('#intf-switchless-end', hostInterface.end_intf || '');
        setInputValue('#intf-switchless-native', hostInterface.native_vlan || '');
        setInputValue('#intf-switchless-tagged', hostInterface.tagged_vlans || '');
      }
    }
    
    // Step 5: Uplinks and loopback (same interfaces array)
    const loopback = config.interfaces.find(i => i.intf_type === 'loopback');
    if (loopback) {
      setInputValue('#intf-loopback-ip', loopback.ipv4 || '');
    }

    const uplinks = config.interfaces.filter(i => i.type === 'L3' && i.intf_type === 'Ethernet');
    if (uplinks[0]) {
      setInputValue('#intf-uplink1-port', uplinks[0].intf || '');
      setInputValue('#intf-uplink1-ip', uplinks[0].ipv4 || '');
    }
    if (uplinks[1]) {
      setInputValue('#intf-uplink2-port', uplinks[1].intf || '');
      setInputValue('#intf-uplink2-ip', uplinks[1].ipv4 || '');
    }
  }

  // Step 4: Redundancy (peer-link editable fields)
  if (Array.isArray(config.port_channels)) {
    const peerLink = config.port_channels.find(pc => pc.vpc_peer_link);
    if (peerLink) {
      setInputValue('#mlag-peerlink-id', String(peerLink.id));
      if (peerLink.members && peerLink.members.length > 0) {
        setInputValue('#mlag-peerlink-members', peerLink.members.join(','));
      }
    }
  }

  // Step 4: Redundancy (MLAG)
  if (config.mlag) {
    state.config.mlag = config.mlag; // Update state
    if (config.mlag.peer_keepalive) {
      setInputValue('#mlag-keepalive-src', config.mlag.peer_keepalive.source_ip || '');
      setInputValue('#mlag-keepalive-dst', config.mlag.peer_keepalive.destination_ip || '');
    }
    setInputValue('#mlag-domain-id', String(config.mlag.domain_id || 1));
  }

  if (Array.isArray(config.port_channels)) {
    state.config.port_channels = config.port_channels; // Update state
    const ibgpPc = config.port_channels.find(pc => pc.type === 'L3' && !pc.vpc_peer_link);
    if (ibgpPc) {
      setInputValue('#pc-ibgp-id', String(ibgpPc.id || 50));
      setInputValue('#pc-ibgp-ip', ibgpPc.ipv4 || '');
      setInputValue('#pc-ibgp-members', (ibgpPc.members || []).join(','));
    }
  }

  // Step 6: Routing (BGP)
  if (config.bgp) {
    state.config.bgp = config.bgp; // Update state
    setInputValue('#bgp-asn', String(config.bgp.asn || ''));
    setInputValue('#bgp-router-id', config.bgp.router_id || '');
    
    // Load BGP neighbors
    const neighborsContainer = getElement('#bgp-neighbors');
    if (neighborsContainer && config.bgp.neighbors) {
      neighborsContainer.innerHTML = '';
      config.bgp.neighbors.forEach(neighbor => {
        addBgpNeighbor();
        const entries = getElements('.neighbor-entry');
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const ipInput = lastEntry.querySelector<HTMLInputElement>('.bgp-neighbor-ip');
          const descInput = lastEntry.querySelector<HTMLInputElement>('.bgp-neighbor-desc');
          const asnInput = lastEntry.querySelector<HTMLInputElement>('.bgp-neighbor-asn');
          if (ipInput) ipInput.value = neighbor.ip || '';
          if (descInput) descInput.value = neighbor.description || '';
          if (asnInput) asnInput.value = String(neighbor.remote_as || '');
        }
      });
    }
  }
  
  // Update prefix lists if present
  if (config.prefix_lists) {
    state.config.prefix_lists = config.prefix_lists;
  }

  // Mark all steps with populated data as completed
  markCompletedSteps();
  updatePhaseCompletionFromConfig();
  
  // Update config summary sidebar
  updateConfigSummary();
  
  showPhase(1);
}

function updatePhaseCompletionFromConfig(): void {
  const hasSwitch = Boolean(
    state.config.switch.vendor &&
    state.config.switch.model &&
    state.config.switch.role &&
    state.config.switch.hostname
  );
  const hasNetwork = Array.isArray(state.config.vlans) && state.config.vlans.length > 0;
  const hasRouting = Boolean(
    (state.config.bgp && Object.keys(state.config.bgp).length > 0) ||
    (state.config.static_routes && state.config.static_routes.length > 0)
  );
  const hasReview = hasSwitch && hasNetwork;

  const phases = getElements('.nav-phase');
  phases.forEach(phase => {
    const phaseId = phase.dataset.phase;
    phase.classList.remove('completed');
    if (phaseId === '1' && hasSwitch) phase.classList.add('completed');
    if (phaseId === '2' && hasNetwork) phase.classList.add('completed');
    if (phaseId === '3' && hasRouting) phase.classList.add('completed');
    if (phaseId === 'review' && hasReview) phase.classList.add('completed');
  });
}

export function selectCard(selector: string, dataAttr: string, value: string): void {
  const card = getElement(`${selector}[data-${dataAttr}="${value}"]`);
  if (card) {
    card.click();
  }
}

function resetVlanContainers(): void {
  const mgmtContainer = getElement('#mgmt-vlans-container');
  const computeContainer = getElement('#compute-vlans-container');

  if (mgmtContainer) mgmtContainer.innerHTML = '';
  if (computeContainer) computeContainer.innerHTML = '';

  VLAN_CONFIGS.management.counter = 0;
  VLAN_CONFIGS.compute.counter = 0;
}

function populateVlansFromConfig(vlans: VLAN[]): void {
  resetVlanContainers();

  const management = vlans.filter(v => v.purpose === 'management');
  const compute = vlans.filter(v => v.purpose === 'compute');
  const parking = vlans.find(v => v.shutdown === true || v.purpose === 'parking');

  if (parking) {
    setInputValue('#vlan-parking-id', String(parking.vlan_id));
  }

  if (management.length === 0) {
    addDynamicVlan('management');
  } else {
    management.forEach(vlan => addDynamicVlan('management', vlan));
  }

  if (compute.length === 0) {
    addDynamicVlan('compute');
  } else {
    compute.forEach(vlan => addDynamicVlan('compute', vlan));
  }
}
