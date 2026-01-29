// Azure Local Switch Configuration Wizard - Enhanced with Validation
let currentStep = 1;
let config = {};
let modalResolve = null;

// Custom confirm modal
function customConfirm(title, message) {
    return new Promise((resolve) => {
        modalResolve = resolve;
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('custom-confirm-modal').style.display = 'flex';
    });
}

function closeModal(confirmed) {
    document.getElementById('custom-confirm-modal').style.display = 'none';
    if (modalResolve) {
        modalResolve(confirmed);
        modalResolve = null;
    }
}

const modelsByVendor = {
    cisco: [
        { value: '93180YC-FX', label: 'Nexus 93180YC-FX' },
        { value: '93180YC-FX3', label: 'Nexus 93180YC-FX3' },
        { value: '93108TC-FX3P', label: 'Nexus 93108TC-FX3P' }
    ],
    dellemc: [
        { value: 's5248f-on', label: 'S5248F-ON' },
        { value: 'N3248TE-ON', label: 'N3248TE-ON' }
    ]
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Import JSON
    document.getElementById('import-json').addEventListener('change', importJSON);
    
    // Step 1: Deployment Pattern cards - auto-advance
    setupCardSelection('step1', '.card[data-field="deployment-pattern"]', (value) => {
        config.deployment_pattern = value;
        updateNavigation();
        goToStep(2);
    });
    
    // Step 2: Switch Role cards
    setupCardSelection('step2', '.card[data-field="role"]', (value) => {
        config.switch_role = value;
        updateNavigation();
    });
    
    // Step 2: Vendor cards
    setupCardSelection('step2', '.card[data-field="vendor"]', (value) => {
        config.vendor = value;
        showModelCards(value);
        updateNavigation();
    });
    
    // Initialize navigation
    updateNavigation();
    setupNavigationClicks();
});

// Setup card click selection
function setupCardSelection(stepId, selector, callback) {
    const step = document.getElementById(stepId);
    const cards = step.querySelectorAll(selector);
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove selected from siblings with same data-field
            const field = this.getAttribute('data-field');
            if (field) {
                const siblings = step.querySelectorAll(`.card[data-field="${field}"]`);
                siblings.forEach(c => c.classList.remove('selected'));
            } else {
                const parent = this.parentElement;
                parent.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
            }
            
            // Add selected to this card
            this.classList.add('selected');
            
            // Callback with value
            const value = this.getAttribute('data-value');
            if (callback) callback(value);
        });
    });
}

// Show model cards based on vendor
function showModelCards(vendor) {
    const modelGroup = document.getElementById('model-group');
    const modelCards = document.getElementById('model-cards');
    
    modelCards.innerHTML = '';
    
    if (modelsByVendor[vendor]) {
        modelsByVendor[vendor].forEach(model => {
            const card = document.createElement('div');
            card.className = 'card small';
            card.setAttribute('data-value', model.value);
            card.setAttribute('data-field', 'model');
            card.innerHTML = `<h4>${model.label}</h4>`;
            
            card.addEventListener('click', function() {
                modelCards.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                config.model = model.value;
                updateNavigation();
            });
            
            modelCards.appendChild(card);
        });
        
        modelGroup.style.display = 'block';
    }
}

// Validation functions
function validateStep1() {
    return !!config.deployment_pattern;
}

function validateStep2() {
    const hostname = document.getElementById('hostname').value.trim();
    return hostname && config.switch_role && config.vendor && config.model;
}

function validateStep3() {
    // Required: Infrastructure, Storage VLANs, Compute
    const infraVlan = document.getElementById('infra-vlan-id').value;
    const infraSubnet = document.getElementById('infra-subnet').value.trim();
    const infraPorts = document.getElementById('infra-ports').value.trim();
    
    const storageTor1Vlan = document.getElementById('storage-tor1-vlan').value;
    const storageTor1Ports = document.getElementById('storage-tor1-ports').value.trim();
    const storageTor2Vlan = document.getElementById('storage-tor2-vlan').value;
    const storageTor2Ports = document.getElementById('storage-tor2-ports').value.trim();
    
    const computeVlan = document.getElementById('compute-vlan-id').value;
    const computeSubnet = document.getElementById('compute-subnet').value.trim();
    const computePorts = document.getElementById('compute-ports').value.trim();
    
    // BMC is optional
    
    return infraVlan && infraSubnet && infraPorts &&
           storageTor1Vlan && storageTor1Ports &&
           storageTor2Vlan && storageTor2Ports &&
           computeVlan && computeSubnet && computePorts;
}

function validateStep4() {
    const border1Port = document.getElementById('border1-port').value.trim();
    const border1P2pIp = document.getElementById('border1-p2p-ip').value.trim();
    const border2Port = document.getElementById('border2-port').value.trim();
    const border2P2pIp = document.getElementById('border2-p2p-ip').value.trim();
    
    const border1Ip = document.getElementById('border1-neighbor-ip').value.trim();
    const border2Ip = document.getElementById('border2-neighbor-ip').value.trim();
    
    const torAsn = document.getElementById('tor-asn').value;
    const loopbackIp = document.getElementById('loopback-ip').value.trim();
    const borderAsn = document.getElementById('border-asn').value;
    const ncAsn = document.getElementById('nc-asn').value;
    const ncIp = document.getElementById('nc-neighbor-ip').value.trim();
    
    return border1Port && border1P2pIp && border2Port && border2P2pIp &&
           torAsn && loopbackIp && borderAsn &&
           border1Ip && border2Ip && ncAsn && ncIp;
}

// Show validation error
function showValidationError(message) {
    const errorDiv = document.getElementById('validation-error');
    errorDiv.textContent = '⚠️ ' + message;
    errorDiv.style.display = 'block';
    
    // Scroll to top to show error
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Hide validation error
function hideValidationError() {
    const errorDiv = document.getElementById('validation-error');
    errorDiv.style.display = 'none';
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = '✓ ' + message;
    successDiv.style.display = 'block';
    
    // Scroll to top to show message
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Hide success message
function hideSuccessMessage() {
    const successDiv = document.getElementById('success-message');
    successDiv.style.display = 'none';
}

// Navigation with validation
function goToStep(targetStep) {
    hideValidationError();
    
    // Validate current step before moving forward
    if (targetStep > currentStep) {
        let isValid = true;
        let errorMessage = '';
        
        switch (currentStep) {
            case 1:
                isValid = validateStep1();
                errorMessage = 'Please select a deployment pattern before proceeding.';
                break;
            case 2:
                isValid = validateStep2();
                errorMessage = 'Please complete all required fields: Hostname, Role, Vendor, and Model.';
                break;
            case 3:
                isValid = validateStep3();
                errorMessage = 'Please fill in all required VLAN and Port fields (Infrastructure, Storage, Compute).';
                break;
            case 4:
                isValid = validateStep4();
                errorMessage = 'Please complete all Border Router and BGP configuration fields.';
                break;
        }
        
        if (!isValid) {
            showValidationError(errorMessage);
            return;
        }
    }
    
    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Show target step
    document.getElementById(`step${targetStep}`).classList.add('active');
    
    currentStep = targetStep;
    updateNavigation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update navigation bar
function updateNavigation() {
    const navSteps = document.querySelectorAll('.nav-step');
    
    navSteps.forEach((navStep, index) => {
        const stepNum = index + 1;
        
        // Remove all states
        navStep.classList.remove('active', 'completed', 'disabled');
        
        if (stepNum < currentStep) {
            navStep.classList.add('completed');
        } else if (stepNum === currentStep) {
            navStep.classList.add('active');
        } else {
            navStep.classList.add('disabled');
        }
    });
}

// Setup navigation clicks
function setupNavigationClicks() {
    const navSteps = document.querySelectorAll('.nav-step');
    
    navSteps.forEach((navStep) => {
        navStep.addEventListener('click', () => {
            const targetStep = parseInt(navStep.getAttribute('data-step'));
            
            // Only allow going to completed or current step
            if (targetStep <= currentStep) {
                goToStep(targetStep);
            } else {
                // Try to advance (will validate)
                goToStep(targetStep);
            }
        });
    });
}

// Generate and review configuration
function generateAndReview() {
    // Validate step 4 first
    if (!validateStep4()) {
        showValidationError('Please complete all Border Router and BGP configuration fields.');
        return;
    }
    
    hideValidationError();
    
    // Collect all data
    const dhcpRelayRaw = document.getElementById('dhcp-relay').value.trim();
    const dhcpRelay = dhcpRelayRaw ? dhcpRelayRaw.split(',').map(ip => ip.trim()).filter(ip => ip) : [];
    
    // Check if BMC fields are filled
    const bmcVlanId = document.getElementById('bmc-vlan-id').value;
    const bmcSubnet = document.getElementById('bmc-subnet').value.trim();
    const bmcPorts = document.getElementById('bmc-ports').value.trim();
    
    const bmcConfig = (bmcVlanId && bmcSubnet) ? {
        id: parseInt(bmcVlanId),
        subnet: bmcSubnet,
        ports: bmcPorts || undefined
    } : undefined;
    
    config = {
        deployment_pattern: config.deployment_pattern,
        switch: {
            role: config.switch_role,
            vendor: config.vendor,
            model: config.model,
            hostname: document.getElementById('hostname').value.trim()
        },
        vlans: {
            infrastructure: {
                id: parseInt(document.getElementById('infra-vlan-id').value),
                subnet: document.getElementById('infra-subnet').value.trim(),
                ports: document.getElementById('infra-ports').value.trim(),
                dhcp_relay: dhcpRelay.length > 0 ? dhcpRelay : undefined
            },
            storage_tor1: {
                id: parseInt(document.getElementById('storage-tor1-vlan').value),
                ports: document.getElementById('storage-tor1-ports').value.trim(),
                l2_only: true
            },
            storage_tor2: {
                id: parseInt(document.getElementById('storage-tor2-vlan').value),
                ports: document.getElementById('storage-tor2-ports').value.trim(),
                l2_only: true
            },
            bmc: bmcConfig,
            compute: {
                id: parseInt(document.getElementById('compute-vlan-id').value),
                subnet: document.getElementById('compute-subnet').value.trim(),
                ports: document.getElementById('compute-ports').value.trim()
            }
        },
        ports: {
            border_routers: [
                {
                    port: document.getElementById('border1-port').value.trim(),
                    p2p_ip: document.getElementById('border1-p2p-ip').value.trim(),
                    description: 'P2P to Border Router 1'
                },
                {
                    port: document.getElementById('border2-port').value.trim(),
                    p2p_ip: document.getElementById('border2-p2p-ip').value.trim(),
                    description: 'P2P to Border Router 2'
                }
            ]
        },
        bgp: {
            tor_asn: parseInt(document.getElementById('tor-asn').value),
            loopback: document.getElementById('loopback-ip').value.trim(),
            neighbors: {
                border1: {
                    asn: parseInt(document.getElementById('border-asn').value),
                    ip: document.getElementById('border1-neighbor-ip').value.trim()
                },
                border2: {
                    asn: parseInt(document.getElementById('border-asn').value),
                    ip: document.getElementById('border2-neighbor-ip').value.trim()
                },
                network_controller: {
                    asn: parseInt(document.getElementById('nc-asn').value),
                    ip: document.getElementById('nc-neighbor-ip').value.trim()
                }
            }
        }
    };
    
    // Clean up undefined values
    if (!config.vlans.infrastructure.dhcp_relay) {
        delete config.vlans.infrastructure.dhcp_relay;
    }
    if (!config.vlans.bmc) {
        delete config.vlans.bmc;
    }
    
    // Display summary
    displaySummary();
    
    // Display JSON
    document.getElementById('json-output').textContent = JSON.stringify(config, null, 2);
    
    // Go to review step
    goToStep(5);
}

// Display summary
function displaySummary() {
    const summary = document.getElementById('config-summary');
    
    const bmcInfo = config.vlans.bmc ? 
        `<p><strong>BMC VLAN:</strong> ${config.vlans.bmc.id} (${config.vlans.bmc.subnet})</p>` : 
        '<p><strong>BMC VLAN:</strong> Not configured</p>';
    
    const html = `
        <h3>Configuration Summary</h3>
        <div class="summary-grid">
            <div class="summary-section">
                <h4>Deployment & Switch</h4>
                <p><strong>Pattern:</strong> ${config.deployment_pattern}</p>
                <p><strong>Hostname:</strong> ${config.switch.hostname}</p>
                <p><strong>Role:</strong> ${config.switch.role}</p>
                <p><strong>Vendor:</strong> ${config.switch.vendor}</p>
                <p><strong>Model:</strong> ${config.switch.model}</p>
            </div>
            
            <div class="summary-section">
                <h4>VLANs</h4>
                <p><strong>Infrastructure:</strong> ${config.vlans.infrastructure.id} (${config.vlans.infrastructure.subnet})</p>
                <p><strong>Storage TOR1:</strong> ${config.vlans.storage_tor1.id} (L2 only)</p>
                <p><strong>Storage TOR2:</strong> ${config.vlans.storage_tor2.id} (L2 only)</p>
                ${bmcInfo}
                <p><strong>Compute:</strong> ${config.vlans.compute.id} (${config.vlans.compute.subnet})</p>
            </div>
            
            <div class="summary-section">
                <h4>Ports</h4>
                <p><strong>Infrastructure:</strong> ${config.vlans.infrastructure.ports}</p>
                <p><strong>Storage TOR1:</strong> ${config.vlans.storage_tor1.ports}</p>
                <p><strong>Storage TOR2:</strong> ${config.vlans.storage_tor2.ports}</p>
                ${config.vlans.bmc ? `<p><strong>BMC:</strong> ${config.vlans.bmc.ports || 'Not specified'}</p>` : ''}
                <p><strong>Compute:</strong> ${config.vlans.compute.ports}</p>
                <p><strong>Border 1:</strong> ${config.ports.border_routers[0].port}</p>
                <p><strong>Border 2:</strong> ${config.ports.border_routers[1].port}</p>
            </div>
            
            <div class="summary-section">
                <h4>BGP</h4>
                <p><strong>ToR ASN:</strong> ${config.bgp.tor_asn}</p>
                <p><strong>Loopback:</strong> ${config.bgp.loopback}</p>
                <p><strong>Border ASN:</strong> ${config.bgp.neighbors.border1.asn}</p>
                <p><strong>Border 1 IP:</strong> ${config.bgp.neighbors.border1.ip}</p>
                <p><strong>Border 2 IP:</strong> ${config.bgp.neighbors.border2.ip}</p>
                <p><strong>NC ASN:</strong> ${config.bgp.neighbors.network_controller.asn}</p>
                <p><strong>NC IP:</strong> ${config.bgp.neighbors.network_controller.ip}</p>
            </div>
        </div>
    `;
    
    summary.innerHTML = html;
}

// Export JSON
function exportJSON() {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.switch.hostname || 'azure-local'}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export config file
function exportConfig() {
    const vendor = config.switch.vendor;
    let configText = '';
    
    if (vendor === 'cisco') {
        configText = generateCiscoConfig();
    } else if (vendor === 'dellemc') {
        configText = generateDellConfig();
    }
    
    const blob = new Blob([configText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.switch.hostname || 'switch'}.cfg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Generate Cisco config
function generateCiscoConfig() {
    const role = config.switch.role;
    const priority = role === 'TOR1' ? 150 : 140;
    const sviOffset = role === 'TOR1' ? 2 : 3;
    
    let configText = `!
! Azure Local Switch Configuration
! Hostname: ${config.switch.hostname}
! Role: ${config.switch.role}
! Generated: ${new Date().toISOString()}
!

hostname ${config.switch.hostname}

feature bgp
feature hsrp
feature dhcp
feature lacp
feature interface-vlan

system default switchport
system jumbomtu 9216

!
! VLAN Configuration
!
vlan ${config.vlans.infrastructure.id}
  name Infra_${config.vlans.infrastructure.id}

vlan ${config.vlans.storage_tor1.id}
  name Storage_${config.vlans.storage_tor1.id}_TOR1

vlan ${config.vlans.storage_tor2.id}
  name Storage_${config.vlans.storage_tor2.id}_TOR2

`;

    if (config.vlans.bmc) {
        configText += `vlan ${config.vlans.bmc.id}
  name BMC_${config.vlans.bmc.id}

`;
    }

    configText += `vlan ${config.vlans.compute.id}
  name Compute_${config.vlans.compute.id}

!
! SVI Interfaces
!
interface Vlan${config.vlans.infrastructure.id}
  no shutdown
  mtu 1500
  ip address ${getSubnetIP(config.vlans.infrastructure.subnet, sviOffset)}
`;

    if (config.vlans.infrastructure.dhcp_relay) {
        config.vlans.infrastructure.dhcp_relay.forEach(ip => {
            configText += `  ip dhcp relay address ${ip}\n`;
        });
    }

    configText += `  hsrp ${config.vlans.infrastructure.id}
    priority ${priority}
    ip ${getSubnetIP(config.vlans.infrastructure.subnet, 1)}

`;

    if (config.vlans.bmc) {
        configText += `interface Vlan${config.vlans.bmc.id}
  no shutdown
  mtu 1500
  ip address ${getSubnetIP(config.vlans.bmc.subnet, sviOffset)}
  hsrp ${config.vlans.bmc.id}
    priority ${priority}
    ip ${getSubnetIP(config.vlans.bmc.subnet, 1)}

`;
    }

    configText += `interface Vlan${config.vlans.compute.id}
  no shutdown
  mtu 9216
  ip address ${getSubnetIP(config.vlans.compute.subnet, sviOffset)}
  hsrp ${config.vlans.compute.id}
    priority ${priority}
    ip ${getSubnetIP(config.vlans.compute.subnet, 1)}

!
! Infrastructure VLAN Ports
!
interface ${config.vlans.infrastructure.ports}
  switchport mode trunk
  switchport trunk native vlan ${config.vlans.infrastructure.id}
  switchport trunk allowed vlan ${config.vlans.infrastructure.id}
  mtu 9216
  spanning-tree port type edge trunk
  no shutdown

!
! Storage VLAN Ports
!
interface ${config.vlans.storage_tor1.ports}
  switchport mode trunk
  switchport trunk native vlan ${role === 'TOR1' ? config.vlans.storage_tor1.id : config.vlans.storage_tor2.id}
  switchport trunk allowed vlan ${role === 'TOR1' ? config.vlans.storage_tor1.id : config.vlans.storage_tor2.id}
  mtu 9216
  spanning-tree port type edge trunk
  no shutdown

`;

    if (config.vlans.bmc && config.vlans.bmc.ports) {
        configText += `!
! BMC VLAN Ports
!
interface ${config.vlans.bmc.ports}
  switchport mode trunk
  switchport trunk native vlan ${config.vlans.bmc.id}
  switchport trunk allowed vlan ${config.vlans.bmc.id}
  mtu 9216
  spanning-tree port type edge trunk
  no shutdown

`;
    }

    configText += `!
! Compute VLAN Ports
!
interface ${config.vlans.compute.ports}
  switchport mode trunk
  switchport trunk native vlan ${config.vlans.compute.id}
  switchport trunk allowed vlan ${config.vlans.compute.id}
  mtu 9216
  spanning-tree port type edge trunk
  no shutdown

!
! Border Router Uplinks
!
interface ${config.ports.border_routers[0].port}
  description ${config.ports.border_routers[0].description}
  no switchport
  mtu 9216
  ip address ${config.ports.border_routers[0].p2p_ip}
  no shutdown

interface ${config.ports.border_routers[1].port}
  description ${config.ports.border_routers[1].description}
  no switchport
  mtu 9216
  ip address ${config.ports.border_routers[1].p2p_ip}
  no shutdown

!
! Loopback
!
interface loopback0
  description BGP Router ID
  ip address ${config.bgp.loopback}

!
! BGP Configuration
!
router bgp ${config.bgp.tor_asn}
  router-id ${config.bgp.loopback.split('/')[0]}
  address-family ipv4 unicast
    network ${config.vlans.infrastructure.subnet}
`;

    if (config.vlans.bmc) {
        configText += `    network ${config.vlans.bmc.subnet}\n`;
    }

    configText += `    network ${config.vlans.compute.subnet}
  neighbor ${config.bgp.neighbors.border1.ip}
    remote-as ${config.bgp.neighbors.border1.asn}
    address-family ipv4 unicast
  neighbor ${config.bgp.neighbors.border2.ip}
    remote-as ${config.bgp.neighbors.border2.asn}
    address-family ipv4 unicast
  neighbor ${config.bgp.neighbors.network_controller.ip}
    remote-as ${config.bgp.neighbors.network_controller.asn}
    address-family ipv4 unicast

!
! End
!
`;

    return configText;
}

// Generate Dell config
function generateDellConfig() {
    const role = config.switch.role;
    const priority = role === 'TOR1' ? 150 : 140;
    const sviOffset = role === 'TOR1' ? 2 : 3;
    
    let configText = `!
! Azure Local Switch Configuration
! Hostname: ${config.switch.hostname}
! Role: ${config.switch.role}
! Generated: ${new Date().toISOString()}
!

hostname ${config.switch.hostname}

system mtu 9216

!
! VLAN Interfaces
!
interface vlan${config.vlans.infrastructure.id}
 description Infra_${config.vlans.infrastructure.id}
 no shutdown
 mtu 1500
 ip address ${getSubnetIP(config.vlans.infrastructure.subnet, sviOffset)}
`;

    if (config.vlans.infrastructure.dhcp_relay) {
        config.vlans.infrastructure.dhcp_relay.forEach(ip => {
            configText += ` ip helper-address ${ip}\n`;
        });
    }

    configText += ` vrrp-group ${config.vlans.infrastructure.id}
  priority ${priority}
  virtual-address ${getSubnetIP(config.vlans.infrastructure.subnet, 1)}

`;

    if (config.vlans.bmc) {
        configText += `interface vlan${config.vlans.bmc.id}
 description BMC_${config.vlans.bmc.id}
 no shutdown
 mtu 1500
 ip address ${getSubnetIP(config.vlans.bmc.subnet, sviOffset)}
 vrrp-group ${config.vlans.bmc.id}
  priority ${priority}
  virtual-address ${getSubnetIP(config.vlans.bmc.subnet, 1)}

`;
    }

    configText += `interface vlan${config.vlans.compute.id}
 description Compute_${config.vlans.compute.id}
 no shutdown
 mtu 9216
 ip address ${getSubnetIP(config.vlans.compute.subnet, sviOffset)}
 vrrp-group ${config.vlans.compute.id}
  priority ${priority}
  virtual-address ${getSubnetIP(config.vlans.compute.subnet, 1)}

!
! Infrastructure VLAN Ports
!
interface range ${config.vlans.infrastructure.ports}
 no shutdown
 switchport mode trunk
 switchport access vlan ${config.vlans.infrastructure.id}
 switchport trunk allowed vlan ${config.vlans.infrastructure.id}
 mtu 9216
 spanning-tree port type edge

!
! Storage VLAN Ports
!
interface range ${config.vlans.storage_tor1.ports}
 no shutdown
 switchport mode trunk
 switchport access vlan ${role === 'TOR1' ? config.vlans.storage_tor1.id : config.vlans.storage_tor2.id}
 switchport trunk allowed vlan ${role === 'TOR1' ? config.vlans.storage_tor1.id : config.vlans.storage_tor2.id}
 mtu 9216
 spanning-tree port type edge

`;

    if (config.vlans.bmc && config.vlans.bmc.ports) {
        configText += `!
! BMC VLAN Ports
!
interface range ${config.vlans.bmc.ports}
 no shutdown
 switchport mode trunk
 switchport access vlan ${config.vlans.bmc.id}
 switchport trunk allowed vlan ${config.vlans.bmc.id}
 mtu 9216
 spanning-tree port type edge

`;
    }

    configText += `!
! Compute VLAN Ports
!
interface range ${config.vlans.compute.ports}
 no shutdown
 switchport mode trunk
 switchport access vlan ${config.vlans.compute.id}
 switchport trunk allowed vlan ${config.vlans.compute.id}
 mtu 9216
 spanning-tree port type edge

!
! Border Router Uplinks
!
interface ${config.ports.border_routers[0].port}
 description ${config.ports.border_routers[0].description}
 no shutdown
 no switchport
 mtu 9216
 ip address ${config.ports.border_routers[0].p2p_ip}

interface ${config.ports.border_routers[1].port}
 description ${config.ports.border_routers[1].description}
 no shutdown
 no switchport
 mtu 9216
 ip address ${config.ports.border_routers[1].p2p_ip}

!
! Loopback
!
interface loopback0
 description BGP Router ID
 ip address ${config.bgp.loopback}

!
! BGP Configuration
!
router bgp ${config.bgp.tor_asn}
 router-id ${config.bgp.loopback.split('/')[0]}
 address-family ipv4 unicast
  network ${config.vlans.infrastructure.subnet}
`;

    if (config.vlans.bmc) {
        configText += `  network ${config.vlans.bmc.subnet}\n`;
    }

    configText += `  network ${config.vlans.compute.subnet}
 neighbor ${config.bgp.neighbors.border1.ip}
  remote-as ${config.bgp.neighbors.border1.asn}
  address-family ipv4 unicast
 neighbor ${config.bgp.neighbors.border2.ip}
  remote-as ${config.bgp.neighbors.border2.asn}
  address-family ipv4 unicast
 neighbor ${config.bgp.neighbors.network_controller.ip}
  remote-as ${config.bgp.neighbors.network_controller.asn}
  address-family ipv4 unicast

!
! End
!
`;

    return configText;
}

// Helper: Get IP from subnet
function getSubnetIP(subnet, offset) {
    const [network, cidr] = subnet.split('/');
    const parts = network.split('.');
    parts[3] = offset.toString();
    return parts.join('.') + '/' + cidr;
}

// Import JSON
function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            
            // Populate deployment pattern
            if (imported.deployment_pattern) {
                config.deployment_pattern = imported.deployment_pattern;
                const card = document.querySelector(`#step1 .card[data-value="${imported.deployment_pattern}"]`);
                if (card) card.classList.add('selected');
            }
            
            // Populate switch info
            if (imported.switch) {
                document.getElementById('hostname').value = imported.switch.hostname || '';
                
                if (imported.switch.role) {
                    config.switch_role = imported.switch.role;
                    const card = document.querySelector(`#step2 .card[data-value="${imported.switch.role}"]`);
                    if (card) card.classList.add('selected');
                }
                
                if (imported.switch.vendor) {
                    config.vendor = imported.switch.vendor;
                    const card = document.querySelector(`#step2 .card[data-value="${imported.switch.vendor}"]`);
                    if (card) card.classList.add('selected');
                    showModelCards(imported.switch.vendor);
                    
                    setTimeout(() => {
                        if (imported.switch.model) {
                            config.model = imported.switch.model;
                            const modelCard = document.querySelector(`#model-cards .card[data-value="${imported.switch.model}"]`);
                            if (modelCard) modelCard.classList.add('selected');
                        }
                    }, 100);
                }
            }
            
            // Populate VLANs
            if (imported.vlans) {
                document.getElementById('infra-vlan-id').value = imported.vlans.infrastructure?.id || 7;
                document.getElementById('infra-subnet').value = imported.vlans.infrastructure?.subnet || '';
                document.getElementById('infra-ports').value = imported.vlans.infrastructure?.ports || '';
                document.getElementById('dhcp-relay').value = (imported.vlans.infrastructure?.dhcp_relay || []).join(', ');
                
                document.getElementById('storage-tor1-vlan').value = imported.vlans.storage_tor1?.id || 711;
                document.getElementById('storage-tor1-ports').value = imported.vlans.storage_tor1?.ports || '';
                document.getElementById('storage-tor2-vlan').value = imported.vlans.storage_tor2?.id || 712;
                document.getElementById('storage-tor2-ports').value = imported.vlans.storage_tor2?.ports || '';
                
                if (imported.vlans.bmc) {
                    document.getElementById('bmc-vlan-id').value = imported.vlans.bmc.id || 125;
                    document.getElementById('bmc-subnet').value = imported.vlans.bmc.subnet || '';
                    document.getElementById('bmc-ports').value = imported.vlans.bmc.ports || '';
                }
                
                document.getElementById('compute-vlan-id').value = imported.vlans.compute?.id || 201;
                document.getElementById('compute-subnet').value = imported.vlans.compute?.subnet || '';
                document.getElementById('compute-ports').value = imported.vlans.compute?.ports || '';
            }
            
            // Populate ports
            if (imported.ports && imported.ports.border_routers?.length >= 2) {
                document.getElementById('border1-port').value = imported.ports.border_routers[0].port || '';
                document.getElementById('border1-p2p-ip').value = imported.ports.border_routers[0].p2p_ip || '';
                document.getElementById('border2-port').value = imported.ports.border_routers[1].port || '';
                document.getElementById('border2-p2p-ip').value = imported.ports.border_routers[1].p2p_ip || '';
            }
            
            // Populate BGP
            if (imported.bgp) {
                document.getElementById('tor-asn').value = imported.bgp.tor_asn || '';
                document.getElementById('loopback-ip').value = imported.bgp.loopback || '';
                if (imported.bgp.neighbors) {
                    document.getElementById('border-asn').value = imported.bgp.neighbors.border1?.asn || '';
                    document.getElementById('border1-neighbor-ip').value = imported.bgp.neighbors.border1?.ip || '';
                    document.getElementById('border2-neighbor-ip').value = imported.bgp.neighbors.border2?.ip || '';
                    document.getElementById('nc-asn').value = imported.bgp.neighbors.network_controller?.asn || '';
                    document.getElementById('nc-neighbor-ip').value = imported.bgp.neighbors.network_controller?.ip || '';
                }
            }
            
            // Store the imported config
            config = imported;
            
            // Generate and display the review page
            setTimeout(() => {
                displaySummary();
                document.getElementById('json-output').textContent = JSON.stringify(config, null, 2);
                showSuccessMessage('Configuration imported successfully! Jumping to review page...');
                goToStep(5);
            }, 200);
            
        } catch (error) {
            showValidationError('Error importing JSON: ' + error.message);
        } finally {
            // Reset file input so same file can be imported again
            event.target.value = '';
        }
    };
    
    reader.readAsText(file);
}

// Start over
async function startOver() {
    const confirmed = await customConfirm(
        'Start Over?',
        'Are you sure you want to start over? All current configuration will be lost.'
    );
    
    if (confirmed) {
        // Clear config object
        config = {};
        
        // Remove all card selections
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        
        // Clear ALL text inputs completely
        document.getElementById('hostname').value = '';
        document.getElementById('infra-subnet').value = '';
        document.getElementById('infra-ports').value = '';
        document.getElementById('dhcp-relay').value = '';
        document.getElementById('storage-tor1-ports').value = '';
        document.getElementById('storage-tor2-ports').value = '';
        document.getElementById('bmc-subnet').value = '';
        document.getElementById('bmc-ports').value = '';
        document.getElementById('compute-subnet').value = '';
        document.getElementById('compute-ports').value = '';
        document.getElementById('border1-port').value = '';
        document.getElementById('border1-p2p-ip').value = '';
        document.getElementById('border2-port').value = '';
        document.getElementById('border2-p2p-ip').value = '';
        document.getElementById('loopback-ip').value = '';
        document.getElementById('border1-neighbor-ip').value = '';
        document.getElementById('border2-neighbor-ip').value = '';
        document.getElementById('nc-neighbor-ip').value = '';
        
        // Reset VLAN IDs to defaults
        document.getElementById('infra-vlan-id').value = '7';
        document.getElementById('storage-tor1-vlan').value = '711';
        document.getElementById('storage-tor2-vlan').value = '712';
        document.getElementById('bmc-vlan-id').value = '125';
        document.getElementById('compute-vlan-id').value = '201';
        
        // Clear ASN fields
        document.getElementById('tor-asn').value = '';
        document.getElementById('border-asn').value = '';
        document.getElementById('nc-asn').value = '';
        
        // Hide model selection group
        document.getElementById('model-group').style.display = 'none';
        
        // Clear summary and JSON preview
        document.getElementById('config-summary').innerHTML = '';
        document.getElementById('json-output').textContent = '';
        
        // Reset to step 1
        currentStep = 1;
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.getElementById('step1').classList.add('active');
        updateNavigation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
