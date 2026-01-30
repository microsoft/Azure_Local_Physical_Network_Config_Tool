/**
 * Main entry point for the Azure Local Network Switch Configuration Wizard
 */

import { 
  initializeWizard, 
  setupEventListeners, 
  setupVlanCardDelegation, 
  setupRouteDelegation,
  showTemplateModal,
  closeTemplateModal,
  loadTemplate,
  toggleCollapsible,
  updateVlanName,
  updateStorageVlanName,
  selectPattern,
  expandPatternImage,
  expandPatternPreview,
  closeLightbox,
  changePattern,
  onVendorChange,
  onModelChange,
  selectRole,
  updateHostname,
  startOver,
  showPhase,
  nextPhase,
  nextSubstep,
  previousSubstep,
  previousPhase
} from './app';

// ============================================================================
// THEME & FONT SIZE (Odin Style)
// ============================================================================

function toggleTheme(): void {
  const body = document.body;
  const isLight = body.classList.toggle('light-theme');
  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = isLight ? '☀️' : '🌙';
  }
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function increaseFontSize(): void {
  const body = document.body;
  const currentSize = body.classList.contains('font-large') ? 'large' : 
                      body.classList.contains('font-small') ? 'small' : 'normal';
  
  body.classList.remove('font-small', 'font-large');
  
  if (currentSize === 'small') {
    // small -> normal (no class needed)
  } else if (currentSize === 'normal') {
    body.classList.add('font-large');
  }
  // large stays large (max)
  else {
    body.classList.add('font-large');
  }
  
  const newSize = body.classList.contains('font-large') ? 'large' : 
                  body.classList.contains('font-small') ? 'small' : 'normal';
  localStorage.setItem('fontSize', newSize);
  showToast(`Font size: ${newSize}`, 'info');
}

function decreaseFontSize(): void {
  const body = document.body;
  const currentSize = body.classList.contains('font-large') ? 'large' : 
                      body.classList.contains('font-small') ? 'small' : 'normal';
  
  body.classList.remove('font-small', 'font-large');
  
  if (currentSize === 'large') {
    // large -> normal (no class needed)
  } else if (currentSize === 'normal') {
    body.classList.add('font-small');
  }
  // small stays small (min)
  else {
    body.classList.add('font-small');
  }
  
  const newSize = body.classList.contains('font-large') ? 'large' : 
                  body.classList.contains('font-small') ? 'small' : 'normal';
  localStorage.setItem('fontSize', newSize);
  showToast(`Font size: ${newSize}`, 'info');
}

function scrollToSection(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (section) {
    // Scroll with offset for sticky header
    const headerHeight = 120; // header + breadcrumb height
    const elementPosition = section.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    
    // Update active breadcrumb
    updateActiveBreadcrumb(sectionId);
  }
}

function updateActiveBreadcrumb(sectionId: string): void {
  document.querySelectorAll('.breadcrumb-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-section') === sectionId || 
        item.getAttribute('href') === `#${sectionId}`) {
      item.classList.add('active');
    }
  });
}

/**
 * Update breadcrumb completion states based on form data
 */
function updateBreadcrumbCompletion(): void {
  const breadcrumbs = document.querySelectorAll('.breadcrumb-item');
  
  breadcrumbs.forEach(item => {
    const section = item.getAttribute('data-section') || item.getAttribute('href')?.replace('#', '');
    let isComplete = false;
    
    switch (section) {
      case 'phase1':
        // Pattern & Switch complete if pattern, vendor, model, role selected
        isComplete = !!(
          document.querySelector('.pattern-card.selected') &&
          (document.getElementById('vendor-select') as HTMLSelectElement)?.value &&
          (document.getElementById('model-select') as HTMLSelectElement)?.value &&
          document.querySelector('.role-card.selected')
        );
        break;
      case 'phase2':
        // VLANs complete if management VLAN has ID
        const mgmtVlan = document.querySelector('.vlan-mgmt-id') as HTMLInputElement;
        isComplete = !!(mgmtVlan?.value);
        break;
      case 'phase2-ports':
        // Ports complete if any port range is set
        const convergedStart = document.getElementById('intf-converged-start') as HTMLInputElement;
        isComplete = !!(convergedStart?.value);
        break;
      case 'phase2-redundancy':
        // Redundancy complete if MLAG keepalive is set
        const keepaliveSrc = document.getElementById('mlag-keepalive-src') as HTMLInputElement;
        isComplete = !!(keepaliveSrc?.value);
        break;
      case 'phase3':
        // Routing complete if loopback IP is set
        const loopback = document.getElementById('intf-loopback-ip') as HTMLInputElement;
        isComplete = !!(loopback?.value);
        break;
      case 'review':
        // Review is complete if we reach it with valid config
        isComplete = document.querySelectorAll('.breadcrumb-item.completed').length >= 5;
        break;
    }
    
    if (isComplete) {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }
  });
}

// Call updateBreadcrumbCompletion periodically and on input changes
function setupBreadcrumbTracking(): void {
  // Update on any input change
  document.addEventListener('input', () => {
    setTimeout(updateBreadcrumbCompletion, 100);
  });
  
  // Update on click (for card selections)
  document.addEventListener('click', () => {
    setTimeout(updateBreadcrumbCompletion, 100);
  });
  
  // Initial update
  setTimeout(updateBreadcrumbCompletion, 500);
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function loadSavedPreferences(): void {
  // Load theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) themeBtn.textContent = '☀️';
  }
  
  // Load font size
  const savedFontSize = localStorage.getItem('fontSize');
  if (savedFontSize === 'large') {
    document.body.classList.add('font-large');
  } else if (savedFontSize === 'small') {
    document.body.classList.add('font-small');
  }
}

// Expose functions globally for onclick handlers in HTML
declare global {
  interface Window {
    showTemplateModal: () => void;
    closeTemplateModal: () => void;
    loadTemplate: (templateName: string) => Promise<void>;
    toggleCollapsible: (header: HTMLElement) => void;
    updateVlanName: (input: HTMLInputElement, type: string, prefix: string) => void;
    updateStorageVlanName: (storageNum: number) => void;
    selectPattern: (pattern: any) => void;
    expandPatternImage: () => void;
    expandPatternPreview: (src: string, alt: string) => void;
    closeLightbox: () => void;
    changePattern: () => void;
    onVendorChange: () => void;
    onModelChange: () => void;
    selectRole: (role: any) => void;
    updateHostname: () => void;
    startOver: () => void;
    showPhase: (phase: number | string, substep?: string) => void;
    nextPhase: () => void;
    nextSubstep: () => void;
    previousSubstep: () => void;
    previousPhase: () => void;
    toggleTheme: () => void;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
    scrollToSection: (sectionId: string) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  }
}

window.showTemplateModal = showTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.loadTemplate = loadTemplate;
window.toggleCollapsible = toggleCollapsible;
window.updateVlanName = updateVlanName;
window.updateStorageVlanName = updateStorageVlanName;
window.selectPattern = selectPattern;
window.expandPatternImage = expandPatternImage;
window.expandPatternPreview = expandPatternPreview;
window.closeLightbox = closeLightbox;
window.changePattern = changePattern;
window.onVendorChange = onVendorChange;
window.onModelChange = onModelChange;
window.selectRole = selectRole;
window.updateHostname = updateHostname;
window.startOver = startOver;
window.showPhase = showPhase;
window.nextPhase = nextPhase;
window.nextSubstep = nextSubstep;
window.previousSubstep = previousSubstep;
window.previousPhase = previousPhase;
window.toggleTheme = toggleTheme;
window.increaseFontSize = increaseFontSize;
window.decreaseFontSize = decreaseFontSize;
window.scrollToSection = scrollToSection;
window.showToast = showToast;

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedPreferences();
  initializeWizard();
  setupEventListeners();
  setupVlanCardDelegation();
  setupRouteDelegation();
  setupBreadcrumbTracking();
});
