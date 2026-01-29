/**
 * Azure Local Switch Configuration Wizard
 * Frontend JavaScript - Aligned with Design Doc
 * 
 * IMPORTANT: Display names (UI labels) are separate from values (JSON keys)
 * This allows UI text changes without affecting backend code.
 */

// ============================================================================
// CONSTANTS - Display Names vs Values (Detached)
// ============================================================================

const DISPLAY_NAMES = {
    vendors: {
        'dellemc': 'Dell EMC',
        'cisco': 'Cisco'
    },
    models: {
        's5248f-on': 'S5248F-ON',
        's5232f-on': 'S5232F-ON',
        '93180yc-fx': '93180YC-FX',
        '9336c-fx2': '9336C-FX2'
    },
    roles: {
        'TOR1': 'TOR1 (Primary)',
        'TOR2': 'TOR2 (Secondary)',
        'BMC': 'BMC (Management)'
    },
    patterns: {
        'fully_converged': 'Fully Converged',
        'switched': 'Storage Switched',
        'switchless': 'Switchless'
    },
    routingTypes: {
        'bgp': 'BGP (Dynamic)',
        'static': 'Static Routes'
    },
    vlanPurposes: {
        'parking': 'Parking (Unused)',
        'management': 'Management',
        'compute': 'Compute',
        'storage_1': 'Storage 1',
        'storage_2': 'Storage 2',
        'bmc': 'BMC'
    }
};

// Auto-derived values based on vendor
const VENDOR_FIRMWARE_MAP = {
    'dellemc': 'os10',
    'cisco': 'nxos'
};

// HSRP/VRRP type based on vendor
const VENDOR_REDUNDANCY_TYPE = {
    'dellemc': 'vrrp',
    'cisco': 'hsrp'
};

// Role-based derived values (from Design Doc)
const ROLE_DEFAULTS = {
    'TOR1': { hsrp_priority: 150, mlag_role_priority: 1, mst_priority: 8192 },
    'TOR2': { hsrp_priority: 100, mlag_role_priority: 32667, mst_priority: 16384 },
    'BMC': { hsrp_priority: null, mlag_role_priority: null, mst_priority: 32768 }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    currentStep: 1,
    totalSteps: 5,
    config: {
        // Phase 1: Switch
        switch: {
            vendor: 'dellemc',
            model: 's5248f-on',
            firmware: 'os10',        // Auto-derived
            hostname: '',
            role: 'TOR1',
            deployment_pattern: 'fully_converged'
        },
        // Phase 2: Network
        vlans: [],
        interfaces: [],
        port_channels: [],
        mlag: null,
        // Phase 3: Routing
        routing_type: 'bgp',
        bgp: null,
        prefix_lists: {},
        static_routes: []
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeWizard();
    setupEventListeners();
});

function initializeWizard() {
    updateNavigationUI();
    showStep(1);
    initializeCardSelections();
}

function initializeCardSelections() {
    // Vendor cards
    initializeCardGroup('.vendor-card', 'vendor', (value) => {
        state.config.switch.vendor = value;
        state.config.switch.firmware = VENDOR_FIRMWARE_MAP[value];
        updateModelCards();
    }, 'dellemc');

    // Model cards
    initializeCardGroup('.model-card', 'model', (value) => {
        state.config.switch.model = value;
    });
    updateModelCards();

    // Role cards
    initializeCardGroup('.role-card', 'role', (value) => {
        state.config.switch.role = value;
        updateRoleBasedSections();
    }, 'TOR1');

    // Pattern cards
    initializeCardGroup('.pattern-card', 'pattern', (value) => {
        state.config.switch.deployment_pattern = value;
    }, 'fully_converged');

    // Routing type cards
    initializeCardGroup('.routing-card', 'routing', (value) => {
        state.config.routing_type = value;
        updateRoutingSection();
    }, 'bgp');
}

function initializeCardGroup(selector, dataAttr, onChange, defaultValue = null) {
    const cards = document.querySelectorAll(selector);
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const value = card.dataset[dataAttr];
            if (onChange) onChange(value);
        });
    });

    // Set default selection
    if (defaultValue) {
        const defaultCard = document.querySelector(`${selector}[data-${dataAttr}="${defaultValue}"]`);
        if (defaultCard) {
            defaultCard.classList.add('selected');
            if (onChange) onChange(defaultValue);
        }
    }
}

function setupEventListeners() {
    // File import
    const importInput = document.getElementById('import-json');
    if (importInput) {
        importInput.addEventListener('change', handleFileImport);
    }

    // Navigation buttons
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => nextStep());
    });
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => prevStep());
    });

    // Top navigation clicks
    document.querySelectorAll('.nav-step').forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.dataset.step);
            if (stepNum <= state.currentStep) {
                showStep(stepNum);
            }
        });
    });

    // Add Management VLAN button
    const addMgmtBtn = document.getElementById('btn-add-mgmt');
    if (addMgmtBtn) {
        addMgmtBtn.addEventListener('click', () => addDynamicVlan('management'));
    }

    // Add Compute VLAN button
    const addComputeBtn = document.getElementById('btn-add-compute');
    if (addComputeBtn) {
        addComputeBtn.addEventListener('click', () => addDynamicVlan('compute'));
    }

    // Add neighbor button
    const addNeighborBtn = document.getElementById('btn-add-neighbor');
    if (addNeighborBtn) {
        addNeighborBtn.addEventListener('click', addBgpNeighbor);
    }

    // Add static route button
    const addRouteBtn = document.getElementById('btn-add-route');
    if (addRouteBtn) {
        addRouteBtn.addEventListener('click', addStaticRoute);
    }

    // Export buttons
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportJSON);

    const copyBtn = document.getElementById('btn-copy');
    if (copyBtn) copyBtn.addEventListener('click', copyJSON);

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', startOver);

    // Loopback IP sync to router-id
    const loopbackInput = document.getElementById('intf-loopback-ip');
    if (loopbackInput) {
        loopbackInput.addEventListener('input', (e) => {
            const routerIdField = document.getElementById('bgp-router-id');
            if (routerIdField) {
                // Extract IP without CIDR
                const ip = e.target.value.split('/')[0];
                routerIdField.value = ip || '';
            }
        });
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function showStep(stepNum) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const targetStep = document.getElementById(`step${stepNum}`);
    if (targetStep) {
        targetStep.classList.add('active');
        state.currentStep = stepNum;
        updateNavigationUI();
        
        if (stepNum === 5) populateReviewStep();
    }
}

function nextStep() {
    if (validateCurrentStep()) {
        collectStepData();
        if (state.currentStep < state.totalSteps) {
            showStep(state.currentStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function prevStep() {
    if (state.currentStep > 1) {
        showStep(state.currentStep - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updateNavigationUI() {
    document.querySelectorAll('.nav-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === state.currentStep) {
            step.classList.add('active');
        } else if (stepNum < state.currentStep) {
            step.classList.add('completed');
        }
    });
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateModelCards() {
    const vendor = state.config.switch.vendor;
    document.querySelectorAll('.model-card').forEach(card => {
        if (card.dataset.vendor === vendor) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
            card.classList.remove('selected');
        }
    });

    // Select first visible model
    const firstVisible = document.querySelector(`.model-card[data-vendor="${vendor}"]`);
    if (firstVisible && !document.querySelector('.model-card.selected[style=""]')) {
        document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
        firstVisible.classList.add('selected');
        state.config.switch.model = firstVisible.dataset.model;
    }
}

function updateRoleBasedSections() {
    const role = state.config.switch.role;
    const isBMC = role === 'BMC';

    // Hide/show MLAG section (TOR only)
    const mlagSection = document.getElementById('mlag-section');
    if (mlagSection) {
        mlagSection.style.display = isBMC ? 'none' : '';
    }

    // Hide/show iBGP port-channel section (TOR only)
    const ibgpSection = document.getElementById('pc-ibgp-section');
    if (ibgpSection) {
        ibgpSection.style.display = isBMC ? 'none' : '';
    }

    // Hide/show BMC VLAN section
    const bmcVlanSection = document.getElementById('vlan-bmc-section');
    if (bmcVlanSection) {
        bmcVlanSection.style.display = isBMC ? '' : 'none';
    }
}

function updateRoutingSection() {
    const routingType = state.config.routing_type;
    const bgpSection = document.getElementById('bgp-section');
    const staticSection = document.getElementById('static-section');

    if (bgpSection) bgpSection.style.display = routingType === 'bgp' ? '' : 'none';
    if (staticSection) staticSection.style.display = routingType === 'static' ? '' : 'none';
}

// ============================================================================
// DATA COLLECTION
// ============================================================================

function collectStepData() {
    switch (state.currentStep) {
        case 1:
            collectSwitchData();
            break;
        case 2:
            collectVlanData();
            break;
        case 3:
            collectPortsData();
            break;
        case 4:
            collectRoutingData();
            break;
    }
}

function collectSwitchData() {
    state.config.switch.hostname = getInputValue('hostname');
    state.config.switch.firmware = VENDOR_FIRMWARE_MAP[state.config.switch.vendor];
}

function collectVlanData() {
    const vlans = [];
    const vendor = state.config.switch.vendor;
    const role = state.config.switch.role;
    const redundancyType = VENDOR_REDUNDANCY_TYPE[vendor];

    // Parking VLAN
    const parkingId = getInputValueInt('vlan-parking-id');
    if (parkingId) {
        vlans.push({
            vlan_id: parkingId,
            name: `UNUSED_VLAN`,
            shutdown: true
        });
    }

    // Management VLANs (Dynamic - collect all using unified function)
    collectVlansByType('management', vlans, redundancyType, role);

    // Compute VLANs (Dynamic - collect all using unified function)
    collectVlansByType('compute', vlans, redundancyType, role);

    // Storage VLANs (L2 only)
    const storage1Id = getInputValueInt('vlan-storage1-id');
    if (storage1Id) {
        const storage1Name = getInputValue('vlan-storage1-name');
        vlans.push({
            vlan_id: storage1Id,
            name: storage1Name || `Storage1_${storage1Id}`,
            purpose: 'storage_1'
        });
    }

    const storage2Id = getInputValueInt('vlan-storage2-id');
    if (storage2Id) {
        const storage2Name = getInputValue('vlan-storage2-name');
        vlans.push({
            vlan_id: storage2Id,
            name: storage2Name || `Storage2_${storage2Id}`,
            purpose: 'storage_2'
        });
    }

    // BMC VLAN (BMC switch only)
    if (role === 'BMC') {
        const bmcId = getInputValueInt('vlan-bmc-id');
        if (bmcId) {
            const bmcName = getInputValue('vlan-bmc-name');
            const bmcVlan = {
                vlan_id: bmcId,
                name: bmcName || `BMC_${bmcId}`,
                purpose: 'bmc'
            };
            
            const bmcIp = getInputValue('vlan-bmc-ip');
            if (bmcIp) {
                bmcVlan.interface = {
                    ip: bmcIp,
                    cidr: getInputValueInt('vlan-bmc-cidr') || 26,
                    mtu: 9216
                };
            }
            vlans.push(bmcVlan);
        }
    }

    state.config.vlans = vlans;
}

function collectVlansByType(type, vlans, redundancyType, role) {
    const config = VLAN_CONFIGS[type];
    if (!config) return;

    const cards = document.querySelectorAll(`[data-vlan-type="${type}"]`);
    const cssClass = config.cssClass;

    cards.forEach((card) => {
        const vlanId = parseInt(card.querySelector(`.vlan-${cssClass}-id`)?.value);
        if (!vlanId) return;

        const customName = card.querySelector(`.vlan-${cssClass}-name`)?.value;
        const vlan = {
            vlan_id: vlanId,
            name: customName || `${config.namePrefix}_${vlanId}`,
            purpose: config.purpose
        };
        
        const ipValue = card.querySelector(`.vlan-${cssClass}-ip`)?.value;
        if (ipValue) {
            const [ip, cidr] = ipValue.includes('/') ? ipValue.split('/') : [ipValue, '24'];
            vlan.interface = {
                ip: ip,
                cidr: parseInt(cidr) || 24,
                mtu: 9216
            };
            
            const gatewayValue = card.querySelector(`.vlan-${cssClass}-gateway`)?.value;
            if (gatewayValue && role !== 'BMC') {
                const gwIp = gatewayValue.includes('/') ? gatewayValue.split('/')[0] : gatewayValue;
                vlan.interface.redundancy = {
                    type: redundancyType,
                    virtual_ip: gwIp,
                    preempt: true
                };
            }

            const dhcpRelay = card.querySelector(`.vlan-${cssClass}-dhcp`)?.value;
            if (dhcpRelay) {
                vlan.interface.dhcp_relay = dhcpRelay.split(',').map(s => s.trim());
            }
        }
        
        vlans.push(vlan);
    });
}

function collectPortsData() {
    const interfaces = [];
    const portChannels = [];
    const role = state.config.switch.role;

    // Get tagged VLANs string from collected vlans
    const taggedVlans = state.config.vlans
        .filter(v => !v.shutdown)
        .map(v => v.vlan_id)
        .join(',');
    
    const mgmtVlan = state.config.vlans.find(v => v.purpose === 'management');
    const nativeVlan = mgmtVlan ? String(mgmtVlan.vlan_id) : '7';

    // Host-facing trunk ports
    const hostStart = getInputValue('intf-host-start');
    const hostEnd = getInputValue('intf-host-end');
    if (hostStart && hostEnd) {
        interfaces.push({
            name: 'HyperConverged_To_Hosts',
            type: 'Trunk',
            intf_type: 'Ethernet',
            start_intf: hostStart,
            end_intf: hostEnd,
            native_vlan: nativeVlan,
            tagged_vlans: taggedVlans,
            qos: document.getElementById('intf-host-qos')?.checked || false,
            mtu: 9216
        });
    }

    // Loopback interface
    const loopbackIp = getInputValue('intf-loopback-ip');
    if (loopbackIp) {
        interfaces.push({
            name: 'Loopback0',
            type: 'L3',
            intf_type: 'loopback',
            intf: 'loopback0',
            ipv4: loopbackIp
        });
    }

    // Border uplinks
    const uplink1Port = getInputValue('intf-uplink1-port');
    const uplink1Ip = getInputValue('intf-uplink1-ip');
    if (uplink1Port && uplink1Ip) {
        interfaces.push({
            name: 'P2P_Border1',
            type: 'L3',
            intf_type: 'Ethernet',
            intf: uplink1Port,
            ipv4: uplink1Ip
        });
    }

    const uplink2Port = getInputValue('intf-uplink2-port');
    const uplink2Ip = getInputValue('intf-uplink2-ip');
    if (uplink2Port && uplink2Ip) {
        interfaces.push({
            name: 'P2P_Border2',
            type: 'L3',
            intf_type: 'Ethernet',
            intf: uplink2Port,
            ipv4: uplink2Ip
        });
    }

    // TOR-only sections
    if (role !== 'BMC') {
        // iBGP Port-Channel
        const ibgpPcId = getInputValueInt('pc-ibgp-id');
        const ibgpPcIp = getInputValue('pc-ibgp-ip');
        const ibgpMembers = getInputValue('pc-ibgp-members');
        if (ibgpPcId && ibgpPcIp) {
            portChannels.push({
                id: ibgpPcId,
                description: 'iBGP_Peer_Link_To_TOR2',
                type: 'L3',
                ipv4: ibgpPcIp,
                members: ibgpMembers ? ibgpMembers.split(',').map(s => s.trim()) : []
            });
        }

        // MLAG Peer-Link Port-Channel (auto-configured)
        portChannels.push({
            id: 101,
            description: 'MLAG_Peer_Link_To_TOR2',
            type: 'Trunk',
            native_vlan: '99',
            tagged_vlans: taggedVlans,
            vpc_peer_link: true,
            members: ['1/1/49', '1/1/50', '1/1/51', '1/1/52']
        });

        // MLAG config
        const keepaliveSrc = getInputValue('mlag-keepalive-src');
        const keepaliveDst = getInputValue('mlag-keepalive-dst');
        if (keepaliveSrc && keepaliveDst) {
            state.config.mlag = {
                domain_id: getInputValueInt('mlag-domain-id') || 1,
                peer_keepalive: {
                    source_ip: keepaliveSrc,
                    destination_ip: keepaliveDst
                }
            };
        }
    } else {
        state.config.mlag = null;
    }

    state.config.interfaces = interfaces;
    state.config.port_channels = portChannels;
}

function collectRoutingData() {
    if (state.config.routing_type === 'bgp') {
        collectBgpData();
        state.config.static_routes = [];
    } else {
        collectStaticRoutesData();
        state.config.bgp = null;
        state.config.prefix_lists = {};
    }
}

function collectBgpData() {
    const asn = getInputValueInt('bgp-asn');
    const loopbackIp = getInputValue('intf-loopback-ip');
    const routerId = loopbackIp ? loopbackIp.split('/')[0] : '';

    // Collect networks to advertise
    const networks = [];
    if (loopbackIp) networks.push(loopbackIp);
    
    // Add uplink networks
    const uplink1Ip = getInputValue('intf-uplink1-ip');
    if (uplink1Ip) networks.push(uplink1Ip);

    // Collect neighbors
    const neighbors = [];
    document.querySelectorAll('.neighbor-entry').forEach(entry => {
        const ip = entry.querySelector('.bgp-neighbor-ip')?.value;
        const desc = entry.querySelector('.bgp-neighbor-desc')?.value;
        const remoteAsn = parseInt(entry.querySelector('.bgp-neighbor-asn')?.value);
        
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

    // Auto-generate prefix lists
    state.config.prefix_lists = {
        DefaultRoute: [
            { seq: 10, action: 'permit', prefix: '0.0.0.0/0' },
            { seq: 50, action: 'deny', prefix: '0.0.0.0/0', prefix_filter: 'le 32' }
        ]
    };
}

function collectStaticRoutesData() {
    const routes = [];
    
    const defaultEnabled = document.getElementById('static-default-enabled')?.checked;
    if (defaultEnabled) {
        const nexthop = getInputValue('static-default-nexthop');
        if (nexthop) {
            routes.push({
                destination: '0.0.0.0/0',
                next_hop: nexthop,
                name: 'Default_Route'
            });
        }
    }

    // Collect additional routes
    document.querySelectorAll('.static-route-entry').forEach(entry => {
        const dest = entry.querySelector('.route-dest')?.value;
        const nexthop = entry.querySelector('.route-nexthop')?.value;
        const name = entry.querySelector('.route-name')?.value;
        
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
// DYNAMIC UI ELEMENTS - Unified VLAN Card Module
// ============================================================================

// Config-driven approach for VLAN types
const VLAN_CONFIGS = {
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

// Unified function to create VLAN cards
function addDynamicVlan(type, data = null) {
    const config = VLAN_CONFIGS[type];
    if (!config) return;

    const containerId = type === 'management' ? 'mgmt-vlans-container' : 'compute-vlans-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    const index = config.counter++;
    const vlanId = config.defaultVlanId(index);
    
    const card = document.createElement('div');
    card.className = 'vlan-card dynamic-vlan';
    card.dataset.vlanType = type;
    card.dataset.vlanIndex = index;

    card.innerHTML = createVlanCardHTML(config, index, vlanId);
    container.appendChild(card);

    if (data) {
        populateVlanCard(card, config, data);
    }
}

// Shared template for VLAN cards
function createVlanCardHTML(config, index, vlanId) {
    const switchIp = typeof config.switchIpPlaceholder === 'function' 
        ? config.switchIpPlaceholder(index) 
        : config.switchIpPlaceholder;
    
    const gateway = typeof config.gatewayPlaceholder === 'function'
        ? config.gatewayPlaceholder(index)
        : config.gatewayPlaceholder;

    return `
        <div class="card-header">
            <h4>${config.label} VLAN #${index + 1}</h4>
            <button type="button" class="btn-remove-vlan" onclick="removeDynamicVlan(this)">× Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>VLAN ID <span class="required">*</span></label>
                <input type="number" class="vlan-${config.cssClass}-id" value="${vlanId}" placeholder="${vlanId}" min="2" max="4094" onchange="updateVlanName(this, '${config.cssClass}', '${config.namePrefix}')">
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

function populateVlanCard(card, config, data) {
    const cssClass = config.cssClass;

    const idInput = card.querySelector(`.vlan-${cssClass}-id`);
    const nameInput = card.querySelector(`.vlan-${cssClass}-name`);
    const ipInput = card.querySelector(`.vlan-${cssClass}-ip`);
    const gatewayInput = card.querySelector(`.vlan-${cssClass}-gateway`);
    const dhcpInput = card.querySelector(`.vlan-${cssClass}-dhcp`);

    if (idInput && data.vlan_id) {
        idInput.value = data.vlan_id;
        idInput.placeholder = data.vlan_id;
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

    if (gatewayInput) {
        const cidr = data.interface?.cidr || 24;
        const vip = data.interface?.redundancy?.virtual_ip;
        if (vip) {
            gatewayInput.value = `${vip}/${cidr}`;
        }
    }

    if (dhcpInput && data.interface?.dhcp_relay) {
        dhcpInput.value = data.interface.dhcp_relay.join(',');
    }
}

// Auto-update VLAN name when VLAN ID changes
function updateVlanName(idInput, cssClass, namePrefix) {
    const vlanId = idInput.value;
    if (!vlanId) return;
    
    const card = idInput.closest('.vlan-card');
    const nameInput = card.querySelector(`.vlan-${cssClass}-name`);
    
    if (nameInput) {
        const newName = `${namePrefix}_${vlanId}`;
        nameInput.placeholder = newName;
        
        // If field is empty OR contains auto-generated pattern, update the value
        const currentValue = nameInput.value.trim();
        const isAutoGenerated = !currentValue || /^(Infra|Compute)_\d+$/.test(currentValue);
        
        if (isAutoGenerated) {
            nameInput.value = newName;
            nameInput.style.color = '#666';
        }
    }
}

// Auto-update Storage VLAN names
function updateStorageVlanName(storageNum) {
    const idInput = document.getElementById(`vlan-storage${storageNum}-id`);
    const nameInput = document.getElementById(`vlan-storage${storageNum}-name`);
    
    if (!idInput || !nameInput) return;
    
    const vlanId = idInput.value;
    if (!vlanId) return;
    
    const newName = `Storage${storageNum}_${vlanId}`;
    nameInput.placeholder = newName;
    
    // If field is empty OR contains auto-generated pattern, update the value
    const currentValue = nameInput.value.trim();
    const isAutoGenerated = !currentValue || /^Storage[12]_\d+$/.test(currentValue);
    
    if (isAutoGenerated) {
        nameInput.value = newName;
        nameInput.style.color = '#666';
    }
}

// Mark name as custom when user types
if (!window.vlanNameListenerAdded) {
    window.vlanNameListenerAdded = true;
    document.addEventListener('input', (e) => {
        if (e.target.matches('.vlan-mgmt-name, .vlan-compute-name')) {
            e.target.style.color = '#333'; // Dark to indicate custom
        }
    });
}

function removeDynamicVlan(btn) {
    const card = btn.closest('.dynamic-vlan');
    const container = card.parentElement;
    
    // Don't allow removing if it's the only one
    if (container.querySelectorAll('.dynamic-vlan').length <= 1) {
        alert('At least one VLAN is required.');
        return;
    }
    
    card.remove();
}

function addBgpNeighbor() {
    const container = document.getElementById('bgp-neighbors');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'neighbor-entry';
    entry.innerHTML = `
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">×</button>
        <div class="form-row">
            <div class="form-group">
                <label>Neighbor IP</label>
                <input type="text" class="bgp-neighbor-ip" placeholder="100.71.39.133">
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" class="bgp-neighbor-desc" placeholder="TO_Border2">
            </div>
            <div class="form-group">
                <label>Remote ASN</label>
                <input type="number" class="bgp-neighbor-asn" placeholder="64811">
            </div>
        </div>
    `;
    container.appendChild(entry);
}

function addStaticRoute() {
    const container = document.getElementById('static-routes-list');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'static-route-entry neighbor-entry';
    entry.innerHTML = `
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">×</button>
        <div class="form-row">
            <div class="form-group">
                <label>Destination</label>
                <input type="text" class="route-dest" placeholder="10.0.0.0/8">
            </div>
            <div class="form-group">
                <label>Next-Hop</label>
                <input type="text" class="route-nexthop" placeholder="100.71.39.1">
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="route-name" placeholder="Corporate_Network">
            </div>
        </div>
    `;
    container.appendChild(entry);
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateCurrentStep() {
    clearValidationErrors();
    
    switch (state.currentStep) {
        case 1:
            return validateSwitchStep();
        case 2:
            return validateVlanStep();
        default:
            return true;
    }
}

function validateSwitchStep() {
    const hostname = getInputValue('hostname');
    if (!hostname) {
        showValidationError('Hostname is required');
        return false;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(hostname)) {
        showValidationError('Hostname can only contain letters, numbers, and hyphens');
        return false;
    }
    return true;
}

function validateVlanStep() {
    const mgmtVlanId = getInputValueInt('vlan-mgmt-id');
    if (!mgmtVlanId) {
        showValidationError('Management VLAN ID is required');
        return false;
    }
    if (mgmtVlanId < 2 || mgmtVlanId > 4094) {
        showValidationError('VLAN ID must be between 2 and 4094');
        return false;
    }
    return true;
}

function showValidationError(message) {
    const container = document.querySelector('.wizard-container');
    const existingError = container.querySelector('.validation-error');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearValidationErrors() {
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
}

function showSuccessMessage(message) {
    const container = document.querySelector('.wizard-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'success-message';
    msgDiv.textContent = message;
    container.insertBefore(msgDiv, container.firstChild);
    setTimeout(() => msgDiv.remove(), 3000);
}

// ============================================================================
// REVIEW & EXPORT
// ============================================================================

function populateReviewStep() {
    const summary = document.getElementById('config-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Hostname</span>
                <span class="summary-value">${state.config.switch.hostname || 'Not set'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Vendor / Model</span>
                <span class="summary-value">${DISPLAY_NAMES.vendors[state.config.switch.vendor]} ${DISPLAY_NAMES.models[state.config.switch.model] || state.config.switch.model}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Role</span>
                <span class="summary-value">${state.config.switch.role}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Firmware</span>
                <span class="summary-value">${state.config.switch.firmware}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Deployment Pattern</span>
                <span class="summary-value">${DISPLAY_NAMES.patterns[state.config.switch.deployment_pattern]}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">VLANs</span>
                <span class="summary-value">${state.config.vlans.length} configured</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Interfaces</span>
                <span class="summary-value">${state.config.interfaces.length} configured</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Port Channels</span>
                <span class="summary-value">${state.config.port_channels.length} configured</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">MLAG</span>
                <span class="summary-value">${state.config.mlag ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Routing</span>
                <span class="summary-value">${state.config.routing_type === 'bgp' ? `BGP ASN ${state.config.bgp?.asn || 'N/A'}` : 'Static Routes'}</span>
            </div>
        `;
    }

    const jsonPreview = document.getElementById('json-preview');
    if (jsonPreview) {
        const exportConfig = buildExportConfig();
        jsonPreview.textContent = JSON.stringify(exportConfig, null, 2);
    }
}

function buildExportConfig() {
    const config = {
        switch: state.config.switch
    };

    if (state.config.vlans.length > 0) {
        config.vlans = state.config.vlans;
    }

    if (state.config.interfaces.length > 0) {
        config.interfaces = state.config.interfaces;
    }

    if (state.config.port_channels.length > 0) {
        config.port_channels = state.config.port_channels;
    }

    if (state.config.mlag) {
        config.mlag = state.config.mlag;
    }

    if (state.config.routing_type === 'bgp' && state.config.bgp) {
        if (Object.keys(state.config.prefix_lists).length > 0) {
            config.prefix_lists = state.config.prefix_lists;
        }
        config.bgp = state.config.bgp;
    } else if (state.config.static_routes.length > 0) {
        config.static_routes = state.config.static_routes;
    }

    return config;
}

function exportJSON() {
    const config = buildExportConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.config.switch.hostname || 'switch'}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessMessage('Configuration exported successfully!');
}

function copyJSON() {
    const config = buildExportConfig();
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
        .then(() => showSuccessMessage('Configuration copied to clipboard!'))
        .catch(() => showValidationError('Failed to copy to clipboard'));
}

function startOver() {
    if (confirm('Are you sure you want to reset all configuration?')) {
        location.reload();
    }
}

// ============================================================================
// IMPORT
// ============================================================================

// Show template selection modal
function showTemplateModal() {
    const modal = document.getElementById('template-modal');
    modal.classList.add('active');
}

// Close template selection modal
function closeTemplateModal() {
    const modal = document.getElementById('template-modal');
    modal.classList.remove('active');
}

// Load template and close modal
async function loadTemplate(templateName) {
    closeTemplateModal();
    await quickLoadExample(templateName);
}

// Quick load example configs
async function quickLoadExample(exampleName) {
    try {
        const response = await fetch(`examples/${exampleName}.json`);
        if (!response.ok) throw new Error('Failed to load example');
        
        const jsonData = await response.json();
        loadConfig(jsonData);
        
        alert(`✅ Loaded "${exampleName}" template successfully!`);
    } catch (error) {
        console.error('Error loading example:', error);
        alert(`❌ Failed to load template: ${error.message}`);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('template-modal');
    if (event.target === modal) {
        closeTemplateModal();
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            loadConfig(imported);
            showSuccessMessage('Configuration imported successfully!');
        } catch (err) {
            showValidationError('Failed to parse JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function loadConfig(config) {
    if (config.switch) {
        state.config.switch = { ...state.config.switch, ...config.switch };
        const hostnameInput = document.getElementById('hostname');
        if (hostnameInput) hostnameInput.value = config.switch.hostname || '';

        // Update vendor/model/role/pattern selections
        if (config.switch.vendor) {
            selectCard('.vendor-card', 'vendor', config.switch.vendor);
            updateModelCards();
        }
        if (config.switch.model) {
            selectCard('.model-card', 'model', config.switch.model);
        }
        if (config.switch.role) {
            selectCard('.role-card', 'role', config.switch.role);
            updateRoleBasedSections();
        }
        if (config.switch.deployment_pattern) {
            selectCard('.pattern-card', 'pattern', config.switch.deployment_pattern);
        }
    }

    if (Array.isArray(config.vlans)) {
        populateVlansFromConfig(config.vlans);
    }

    showStep(1);
}

function selectCard(selector, dataAttr, value) {
    const card = document.querySelector(`${selector}[data-${dataAttr}="${value}"]`);
    if (card) {
        card.click();
    }
}

function resetVlanContainers() {
    const mgmtContainer = document.getElementById('mgmt-vlans-container');
    const computeContainer = document.getElementById('compute-vlans-container');

    if (mgmtContainer) mgmtContainer.innerHTML = '';
    if (computeContainer) computeContainer.innerHTML = '';

    VLAN_CONFIGS.management.counter = 0;
    VLAN_CONFIGS.compute.counter = 0;
}

function populateVlansFromConfig(vlans) {
    resetVlanContainers();

    const management = vlans.filter(v => v.purpose === 'management');
    const compute = vlans.filter(v => v.purpose === 'compute');
    const storage1 = vlans.find(v => v.purpose === 'storage_1');
    const storage2 = vlans.find(v => v.purpose === 'storage_2');
    const parking = vlans.find(v => v.shutdown === true || v.purpose === 'parking');
    const bmc = vlans.find(v => v.purpose === 'bmc' || (v.name || '').toLowerCase().includes('bmc'));

    // Parking VLAN
    if (parking) {
        const parkingInput = document.getElementById('vlan-parking-id');
        if (parkingInput) parkingInput.value = parking.vlan_id || '';
    }

    // Management VLANs
    if (management.length === 0) {
        addDynamicVlan('management');
    } else {
        management.forEach(vlan => addDynamicVlan('management', vlan));
    }

    // Compute VLANs
    if (compute.length === 0) {
        addDynamicVlan('compute');
    } else {
        compute.forEach(vlan => addDynamicVlan('compute', vlan));
    }

    // Storage VLANs (static)
    if (storage1) {
        const s1Id = document.getElementById('vlan-storage1-id');
        const s1Name = document.getElementById('vlan-storage1-name');
        if (s1Id) s1Id.value = storage1.vlan_id || '';
        if (s1Name) {
            s1Name.value = storage1.name || `Storage1_${storage1.vlan_id}`;
            s1Name.style.color = storage1.name ? '#333' : '#666';
        }
    }

    if (storage2) {
        const s2Id = document.getElementById('vlan-storage2-id');
        const s2Name = document.getElementById('vlan-storage2-name');
        if (s2Id) s2Id.value = storage2.vlan_id || '';
        if (s2Name) {
            s2Name.value = storage2.name || `Storage2_${storage2.vlan_id}`;
            s2Name.style.color = storage2.name ? '#333' : '#666';
        }
    }

    // BMC VLAN (static)
    if (bmc) {
        const bmcId = document.getElementById('vlan-bmc-id');
        const bmcName = document.getElementById('vlan-bmc-name');
        const bmcIp = document.getElementById('vlan-bmc-ip');
        const bmcCidr = document.getElementById('vlan-bmc-cidr');
        const bmcGw = document.getElementById('vlan-bmc-gateway');

        if (bmcId) bmcId.value = bmc.vlan_id || '';
        if (bmcName) {
            bmcName.value = bmc.name || `BMC_${bmc.vlan_id}`;
            bmcName.style.color = bmc.name ? '#333' : '#666';
        }
        if (bmcIp && bmc.interface?.ip) bmcIp.value = bmc.interface.ip;
        if (bmcCidr && bmc.interface?.cidr) bmcCidr.value = bmc.interface.cidr;
        if (bmcGw && bmc.interface?.redundancy?.virtual_ip) bmcGw.value = bmc.interface.redundancy.virtual_ip;
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function getInputValueInt(id) {
    const val = getInputValue(id);
    return val ? parseInt(val) : null;
}
