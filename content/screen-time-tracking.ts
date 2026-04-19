// Screen time tracking — records time spent on every site when enabled

import { getCurrentDateString } from '../utils/time-utils.js';
import { getLocalData, setLocalData } from '../utils/storage-utils.js';
import type { ScreenTimeHistory } from '../types/index.js';

let screenTimeInterval: number | null = null;
let screenTimeStartTime: number | null = null;
let currentDomain: string | null = null;
let isTracking = false;
let isWindowFocused = true; // assume focused on load; blur fires immediately if not
let pendingElapsed = 0;     // ms accumulated in memory, flushed to storage every 30s
let lastFlushTime = 0;

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
    const result = await getLocalData(['screenTimeHistory']);
    const history = (result.screenTimeHistory as ScreenTimeHistory) || {};
    const today = getCurrentDateString();
    if (!history[today]) history[today] = {};
    history[today][domain] = (history[today][domain] || 0) + elapsed;
    pruneOldEntries(history);
    await setLocalData({ screenTimeHistory: history });
  } catch {
    // Ignore extension context errors
  }
}

const FLUSH_INTERVAL_MS = 30_000;

function startInterval(): void {
  if (screenTimeInterval !== null) return;
  screenTimeStartTime = Date.now();
  if (lastFlushTime === 0) lastFlushTime = Date.now();
  screenTimeInterval = window.setInterval(async () => {
    if (!screenTimeStartTime || !currentDomain) return;
    const now = Date.now();
    const elapsed = now - screenTimeStartTime;
    if (elapsed <= 0 || elapsed > 10000) {
      screenTimeStartTime = now;
      return;
    }
    screenTimeStartTime = now;
    pendingElapsed += elapsed;

    // Only write to storage every 30 seconds
    if (now - lastFlushTime >= FLUSH_INTERVAL_MS) {
      await flushToStorage();
    }
  }, 2000);
}

async function flushToStorage(): Promise<void> {
  if (!currentDomain || pendingElapsed <= 0) return;
  const toFlush = pendingElapsed;
  pendingElapsed = 0;
  lastFlushTime = Date.now();
  await saveElapsed(currentDomain, toFlush);
}

function stopInterval(): void {
  if (screenTimeInterval !== null) {
    clearInterval(screenTimeInterval);
    screenTimeInterval = null;
  }
  // Capture any remaining tick time and flush everything pending
  if (currentDomain && screenTimeStartTime) {
    pendingElapsed += Date.now() - screenTimeStartTime;
  }
  screenTimeStartTime = null;
  if (pendingElapsed > 0) {
    flushToStorage();
  }
}

export async function initScreenTimeTracking(): Promise<void> {
  try {
    const result = await getLocalData(['screenTimeEnabled']);
    if (!result.screenTimeEnabled) return;

    currentDomain = getDomain();
    isTracking = true;

    isWindowFocused = document.hasFocus();

    if (!document.hidden && isWindowFocused) {
      startInterval();
    }

    document.addEventListener('visibilitychange', () => {
      if (!isTracking) return;
      if (document.hidden) {
        stopInterval();
      } else if (isWindowFocused) {
        startInterval();
      }
    });

    window.addEventListener('focus', () => {
      if (!isTracking) return;
      isWindowFocused = true;
      if (!document.hidden) {
        startInterval();
      }
    });

    window.addEventListener('blur', () => {
      if (!isTracking) return;
      isWindowFocused = false;
      stopInterval();
    });
  } catch {
    // Ignore errors
  }
}

export function stopScreenTimeTracking(): void {
  isTracking = false;
  stopInterval();
  currentDomain = null;
  pendingElapsed = 0;
  lastFlushTime = 0;
}
