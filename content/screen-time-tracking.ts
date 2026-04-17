// Screen time tracking — records time spent on every site when enabled

import { getCurrentDateString } from '../utils/time-utils.js';
import { getStorageData, setStorageData } from '../utils/storage-utils.js';
import type { ScreenTimeHistory } from '../types/index.js';

let screenTimeInterval: number | null = null;
let screenTimeStartTime: number | null = null;
let currentDomain: string | null = null;
let isTracking = false;

function getDomain(): string {
  return window.location.hostname.replace(/^www\./, '').toLowerCase();
}

function pruneOldEntries(history: ScreenTimeHistory): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  Object.keys(history).forEach(d => {
    if (d < cutoffStr) delete history[d];
  });
}

async function saveElapsed(domain: string, elapsed: number): Promise<void> {
  try {
    const result = await getStorageData(['screenTimeHistory']);
    const history = (result.screenTimeHistory as ScreenTimeHistory) || {};
    const today = getCurrentDateString();
    if (!history[today]) history[today] = {};
    history[today][domain] = (history[today][domain] || 0) + elapsed;
    pruneOldEntries(history);
    await setStorageData({ screenTimeHistory: history });
  } catch {
    // Ignore extension context errors
  }
}

function startInterval(): void {
  if (screenTimeInterval !== null) return;
  screenTimeStartTime = Date.now();
  screenTimeInterval = window.setInterval(async () => {
    if (!screenTimeStartTime || !currentDomain) return;
    const now = Date.now();
    const elapsed = now - screenTimeStartTime;
    if (elapsed <= 0 || elapsed > 10000) {
      screenTimeStartTime = now;
      return;
    }
    screenTimeStartTime = now;
    await saveElapsed(currentDomain, elapsed);
  }, 2000);
}

function stopInterval(): void {
  if (screenTimeInterval !== null) {
    clearInterval(screenTimeInterval);
    screenTimeInterval = null;
  }
  if (currentDomain && screenTimeStartTime) {
    const elapsed = Date.now() - screenTimeStartTime;
    if (elapsed > 0) {
      saveElapsed(currentDomain, elapsed);
    }
  }
  screenTimeStartTime = null;
}

export async function initScreenTimeTracking(): Promise<void> {
  try {
    const result = await getStorageData(['screenTimeEnabled']);
    if (!result.screenTimeEnabled) return;

    currentDomain = getDomain();
    isTracking = true;

    if (!document.hidden) {
      startInterval();
    }

    document.addEventListener('visibilitychange', () => {
      if (!isTracking) return;
      if (document.hidden) {
        stopInterval();
      } else {
        screenTimeStartTime = Date.now();
        startInterval();
      }
    });
  } catch {
    // Ignore errors
  }
}

export function stopScreenTimeTracking(): void {
  isTracking = false;
  stopInterval();
  currentDomain = null;
}
