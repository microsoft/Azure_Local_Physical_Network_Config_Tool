/**
 * Main entry point for the Azure Local Network Switch Configuration Wizard
 */

import { initializeWizard, setupEventListeners, setupVlanCardDelegation, setupRouteDelegation } from './app';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeWizard();
  setupEventListeners();
  setupVlanCardDelegation();
  setupRouteDelegation();
});
