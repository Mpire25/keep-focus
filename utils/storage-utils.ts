// Chrome storage utilities
//
// Sync storage: small config that should follow the user across devices
//   blockedSites, timeLimits, darkMode, elementBlockingRules, timeToastShortcut
//
// Local storage: device-specific or large data that must not hit sync quota
//   unlockedUntil, timeTracking, screenTimeEnabled, screenTimeHistory

import type { ExtensionData } from '../types/index.js';
import { DEFAULT_TIME_TOAST_SHORTCUT } from '../types/index.js';

const STORAGE_MIGRATION_FLAG = 'storageMigratedV2';

function isNonEmptyObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.keys(value as Record<string, unknown>).length > 0;
}

// One-time migration for legacy users where these keys lived in sync storage.
// Safe for new users: local data always wins; we only copy when local is empty.
async function migrateLegacyLocalKeysIfNeeded(): Promise<void> {
  const migrationResult = await chrome.storage.local.get([STORAGE_MIGRATION_FLAG]);
  if (migrationResult[STORAGE_MIGRATION_FLAG]) {
    return;
  }

  const [localLegacy, syncLegacy] = await Promise.all([
    chrome.storage.local.get(['unlockedUntil', 'timeTracking']),
    chrome.storage.sync.get(['unlockedUntil', 'timeTracking'])
  ]);

  const patch: Record<string, unknown> = {};

  if (!isNonEmptyObject(localLegacy.unlockedUntil) && isNonEmptyObject(syncLegacy.unlockedUntil)) {
    patch.unlockedUntil = syncLegacy.unlockedUntil;
  }

  if (!isNonEmptyObject(localLegacy.timeTracking) && isNonEmptyObject(syncLegacy.timeTracking)) {
    patch.timeTracking = syncLegacy.timeTracking;
  }

  patch[STORAGE_MIGRATION_FLAG] = true;
  await chrome.storage.local.set(patch);
}

// Get all extension data from storage
export async function getAllData(): Promise<ExtensionData> {
  try {
    await migrateLegacyLocalKeysIfNeeded();

    const [syncResult, localResult] = await Promise.all([
      chrome.storage.sync.get(['blockedSites', 'timeLimits', 'darkMode', 'elementBlockingRules', 'timeToastShortcut']),
      chrome.storage.local.get(['unlockedUntil', 'timeTracking', 'screenTimeEnabled', 'screenTimeHistory'])
    ]);
    return {
      blockedSites: syncResult.blockedSites || [],
      unlockedUntil: localResult.unlockedUntil || {},
      timeLimits: syncResult.timeLimits || [],
      timeTracking: localResult.timeTracking || {},
      darkMode: syncResult.darkMode || false,
      elementBlockingRules: syncResult.elementBlockingRules || [],
      screenTimeEnabled: localResult.screenTimeEnabled || false,
      screenTimeHistory: localResult.screenTimeHistory || {},
      timeToastShortcut: syncResult.timeToastShortcut || DEFAULT_TIME_TOAST_SHORTCUT
    };
  } catch (error) {
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
        screenTimeHistory: {},
        timeToastShortcut: DEFAULT_TIME_TOAST_SHORTCUT
      };
    }
    throw error;
  }
}

// Get specific data from sync storage
export async function getStorageData(keys: string[]): Promise<Record<string, unknown>> {
  try {
    return await chrome.storage.sync.get(keys);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      const defaults: Record<string, unknown> = {};
      keys.forEach(key => {
        if (key === 'blockedSites' || key === 'timeLimits') {
          defaults[key] = [];
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

// Set data in sync storage
export async function setStorageData(data: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.sync.set(data);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      return;
    }
    throw error;
  }
}

// Get data from local storage
export async function getLocalData(keys: string[]): Promise<Record<string, unknown>> {
  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      const defaults: Record<string, unknown> = {};
      keys.forEach(key => {
        if (key === 'unlockedUntil' || key === 'timeTracking' || key === 'screenTimeHistory') {
          defaults[key] = {};
        } else if (key === 'screenTimeEnabled') {
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

// Set data in local storage
export async function setLocalData(data: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.local.set(data);
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      return;
    }
    throw error;
  }
}
