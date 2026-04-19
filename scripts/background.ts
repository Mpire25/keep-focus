// Background service worker for Keep Focus extension
// Handles dynamic icon updates based on dark mode preference, and serialises
// screen time writes so concurrent tabs don't overwrite each other.

import { updateExtensionIcon } from '../utils/icon-utils.js';
import type { ScreenTimeHistory } from '../types/index.js';

function pruneOldScreenTimeEntries(history: ScreenTimeHistory): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  // Use local date components to match how keys are stored (YYYY-MM-DD local time).
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const cutoffStr = `${y}-${m}-${d}`;
  Object.keys(history).forEach(key => {
    if (key < cutoffStr) delete history[key];
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCREEN_TIME_ADD') {
    const { domain, elapsed, date } = message as { domain: string; elapsed: number; date: string };
    chrome.storage.local.get(['screenTimeHistory']).then(result => {
      const history = (result.screenTimeHistory as ScreenTimeHistory) || {};
      if (!history[date]) history[date] = {};
      history[date][domain] = (history[date][domain] || 0) + elapsed;
      pruneOldScreenTimeEntries(history);
      return chrome.storage.local.set({ screenTimeHistory: history });
    }).then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true; // keep channel open for async response
  }
});

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

