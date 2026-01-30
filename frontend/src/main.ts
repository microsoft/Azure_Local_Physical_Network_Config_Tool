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
  if (body.classList.contains('font-small')) {
    body.classList.remove('font-small');
  } else if (!body.classList.contains('font-large')) {
    body.classList.add('font-large');
  }
  localStorage.setItem('fontSize', body.classList.contains('font-large') ? 'large' : 
                                    body.classList.contains('font-small') ? 'small' : 'normal');
}

function decreaseFontSize(): void {
  const body = document.body;
  if (body.classList.contains('font-large')) {
    body.classList.remove('font-large');
  } else if (!body.classList.contains('font-small')) {
    body.classList.add('font-small');
  }
  localStorage.setItem('fontSize', body.classList.contains('font-large') ? 'large' : 
                                    body.classList.contains('font-small') ? 'small' : 'normal');
}

function scrollToSection(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update active state in sidebar nav
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = document.querySelector(`.sidebar-nav-link[onclick*="${sectionId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
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
});
