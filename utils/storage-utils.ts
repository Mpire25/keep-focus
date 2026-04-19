// Chrome storage utilities

import type { ExtensionData } from '../types/index.js';

// Get all extension data from storage
export async function getAllData(): Promise<ExtensionData> {
  try {
    const result = await chrome.storage.sync.get([
      'blockedSites',
      'unlockedUntil',
      'timeLimits',
      'timeTracking',
      'darkMode',
      'elementBlockingRules',
      'screenTimeEnabled',
      'screenTimeHistory'
    ]);
    return {
      blockedSites: result.blockedSites || [],
      unlockedUntil: result.unlockedUntil || {},
      timeLimits: result.timeLimits || [],
      timeTracking: result.timeTracking || {},
      darkMode: result.darkMode || false,
      elementBlockingRules: result.elementBlockingRules || [],
      screenTimeEnabled: result.screenTimeEnabled || false,
      screenTimeHistory: result.screenTimeHistory || {}
    };
  } catch (error) {
    // Extension context invalidated or other error
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      return {
        blockedSites: [],
        unlockedUntil: {},
        timeLimits: [],
        timeTracking: {},
        darkMode: false,
        elementBlockingRules: [],
        screenTimeEnabled: false,
        screenTimeHistory: {}
      };
    }
    throw error;
  }
}

// Get specific data from storage
export async function getStorageData(keys: string[]): Promise<Record<string, unknown>> {
  try {
    return await chrome.storage.sync.get(keys);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      // Return empty defaults
      const defaults: Record<string, unknown> = {};
      keys.forEach(key => {
        if (key === 'blockedSites' || key === 'timeLimits') {
          defaults[key] = [];
        } else if (key === 'unlockedUntil' || key === 'timeTracking') {
          defaults[key] = {};
        } else if (key === 'darkMode') {
          defaults[key] = false;
        } else {
          defaults[key] = null;
        }
      });
      return defaults;
    }
    throw error;
  }
}

// Set data in storage
export async function setStorageData(data: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.sync.set(data);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      // Silently fail if extension context is invalidated
      return;
    }
    throw error;
  }
}

