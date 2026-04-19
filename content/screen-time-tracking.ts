// Screen time tracking — records time spent on every site when enabled

import { getCurrentDateString } from '../utils/time-utils.js';
import { getLocalData } from '../utils/storage-utils.js';

let screenTimeInterval: number | null = null;
let screenTimeStartTime: number | null = null;
let currentDomain: string | null = null;
let isTracking = false;
let isWindowFocused = true; // assume focused on load; blur fires immediately if not
let pendingElapsed = 0;
let domListenersSetUp = false;

function getDomain(): string {
  return window.location.hostname.replace(/^www\./, '').toLowerCase();
}

async function saveElapsed(domain: string, elapsed: number): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'SCREEN_TIME_ADD',
      domain,
      elapsed,
      date: getCurrentDateString(),
    });
  } catch {
    // Ignore extension context errors / SW not available
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
    pendingElapsed += elapsed;
    await flushToStorage();
  }, 2000);
}

async function flushToStorage(): Promise<void> {
  if (!currentDomain || pendingElapsed <= 0) return;
  const toFlush = pendingElapsed;
  pendingElapsed = 0;
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
    void flushToStorage();
  }
}

function setupDomListeners(): void {
  if (domListenersSetUp) return;
  domListenersSetUp = true;

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

  // Extra unload safety: capture final elapsed time as the page is being discarded.
  window.addEventListener('pagehide', () => {
    if (!isTracking) return;
    stopInterval();
  });
}

function enableTracking(): void {
  currentDomain = getDomain();
  isTracking = true;
  isWindowFocused = document.hasFocus();
  if (!document.hidden && isWindowFocused) {
    startInterval();
  }
}

export async function initScreenTimeTracking(): Promise<void> {
  try {
    setupDomListeners();

    // React to the user toggling screen time from the dashboard in already-open tabs.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.screenTimeEnabled) return;
      const enabled = changes.screenTimeEnabled.newValue as boolean;
      if (enabled && !isTracking) {
        enableTracking();
      } else if (!enabled && isTracking) {
        stopScreenTimeTracking();
      }
    });

    const result = await getLocalData(['screenTimeEnabled']);
    if (!result.screenTimeEnabled) return;

    enableTracking();
  } catch {
    // Ignore errors
  }
}

export function stopScreenTimeTracking(): void {
  isTracking = false;
  stopInterval();
  currentDomain = null;
}
