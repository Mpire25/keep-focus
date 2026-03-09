// Background service worker for Keep Focus extension
// Handles dynamic icon updates based on dark mode preference

import { updateExtensionIcon } from '../utils/icon-utils.js';

// Listen for dark mode changes in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.darkMode) {
    const isDarkMode = (changes.darkMode.newValue as boolean) || false;
    updateExtensionIcon(isDarkMode);
  }
});

// Update icon when extension loads/installs
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = (result.darkMode as boolean) || false;
    updateExtensionIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
});

// Also update icon when service worker starts (for existing installations)
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = (result.darkMode as boolean) || false;
    updateExtensionIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
});

// Update icon immediately when service worker loads
(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = (result.darkMode as boolean) || false;
    updateExtensionIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
})();

