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

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeWizard();
  setupEventListeners();
  setupVlanCardDelegation();
  setupRouteDelegation();
});
