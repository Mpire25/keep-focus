// Hold-to-show "time remaining" toast
//
// While the user holds a configurable chord (default Cmd/Ctrl+Shift+Space),
// a small toast slides down from the top of the screen showing the live time
// left for the current site's time limit. Releasing the chord slides it back.

import { getStorageData, getLocalData } from '../utils/storage-utils.js';
import { normalizeUrl, getTimeLimitSiteKey } from '../utils/url-utils.js';
import { formatTime } from '../utils/time-utils.js';
import { getSafeTimeToastShortcut, isTimeToastShortcutSafe } from '../utils/shortcut-utils.js';
import { DEFAULT_TIME_TOAST_SHORTCUT } from '../types/index.js';
import type { TimeLimit, TimeTracking, TimeToastShortcut } from '../types/index.js';

const TOAST_ID = 'keep-focus-time-toast';
const STYLE_ID = 'keep-focus-time-toast-styles';

let shortcut: TimeToastShortcut = DEFAULT_TIME_TOAST_SHORTCUT;
let listenersAttached = false;
let isShown = false;
let toastEl: HTMLDivElement | null = null;
let valueEl: HTMLDivElement | null = null;
let tickInterval: number | null = null;
let removeTimeout: number | null = null;

// Local countdown state captured when the toast opens. We count down from a
// local clock rather than re-reading the tracker's storage, which only
// checkpoints every 2 seconds (and would make the display jump in 2s steps).
let baseRemainingMs = 0;
let baseTimestamp = 0;
let hasActiveLimit = false;

function isExtensionContextError(error: unknown): boolean {
  const err = error as Error;
  return !!(err && err.message && err.message.includes('Extension context invalidated'));
}

// --- Shortcut matching -------------------------------------------------------

// True when this keydown event exactly satisfies the configured chord
function eventMatchesShortcut(e: KeyboardEvent): boolean {
  if (!isTimeToastShortcutSafe(shortcut)) return false;
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  return (
    e.code === shortcut.code &&
    ctrlOrMeta === shortcut.ctrlOrMeta &&
    e.shiftKey === shortcut.shift &&
    e.altKey === shortcut.alt
  );
}

// True when the released key is one of the keys participating in the chord,
// so releasing any of them tears the toast back down.
function isChordKey(e: KeyboardEvent): boolean {
  if (e.code === shortcut.code) return true;
  if (shortcut.ctrlOrMeta && (e.code.startsWith('Control') || e.code.startsWith('Meta'))) return true;
  if (shortcut.shift && e.code.startsWith('Shift')) return true;
  if (shortcut.alt && e.code.startsWith('Alt')) return true;
  return false;
}

// --- Styling -----------------------------------------------------------------

function injectStyles(darkMode: boolean): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const bg = darkMode ? '#2d2d2d' : '#ffffff';
  const text = darkMode ? '#e0e0e0' : '#212529';
  const label = darkMode ? '#a0a0a0' : '#6c757d';
  const shadow = darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(212, 184, 150, 0.35)';
  const border = darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(212, 184, 150, 0.25)';

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${TOAST_ID} {
      all: unset !important;
      box-sizing: border-box !important;
      position: fixed !important;
      top: 16px !important;
      left: 50% !important;
      transform: translate(-50%, calc(-100% - 32px)) !important;
      opacity: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 2px !important;
      min-width: 180px !important;
      padding: 14px 28px !important;
      background: ${bg} !important;
      border: 1px solid ${border} !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 32px ${shadow} !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      pointer-events: none !important;
      will-change: transform, opacity !important;
      /* Exit: a touch quicker than the entrance */
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.2s ease-out !important;
    }
    #${TOAST_ID}.visible {
      transform: translate(-50%, 0) !important;
      opacity: 1 !important;
      /* Entrance: gentle glide with a subtle settle, fade in faster than the slide */
      transition: transform 0.4s cubic-bezier(0.34, 1.23, 0.64, 1), opacity 0.18s ease-out !important;
    }
    #${TOAST_ID} .kf-toast-value {
      all: unset !important;
      font-size: 26px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      color: #d4b896 !important;
      text-align: center !important;
    }
    #${TOAST_ID} .kf-toast-value.kf-toast-nolimit {
      font-size: 16px !important;
      font-weight: 600 !important;
      color: ${text} !important;
    }
    #${TOAST_ID} .kf-toast-label {
      all: unset !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      letter-spacing: 0.3px !important;
      color: ${label} !important;
      text-align: center !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// --- Content -----------------------------------------------------------------

// Compute the message for the current site. Returns null when there's no limit.
async function computeRemaining(): Promise<{ siteKey: string; limitMs: number; remainingMs: number } | null> {
  const [syncResult, localResult] = await Promise.all([
    getStorageData(['timeLimits']),
    getLocalData(['timeTracking'])
  ]);
  const timeLimits = (syncResult.timeLimits as TimeLimit[]) || [];
  const timeTracking = (localResult.timeTracking as TimeTracking) || {};

  const normalized = normalizeUrl(window.location.href);
  const siteKey = getTimeLimitSiteKey(normalized, timeLimits);
  if (!siteKey) return null;

  const limitObj = timeLimits.find(l => l.url === siteKey);
  if (!limitObj) return null;

  const limitMs = limitObj.limitMinutes * 60 * 1000;
  const timeSpent = timeTracking[siteKey]?.timeSpent || 0;
  const remainingMs = Math.max(0, limitMs - timeSpent);
  return { siteKey, limitMs, remainingMs };
}

function renderValue(remainingMs: number): void {
  if (!valueEl) return;
  valueEl.classList.remove('kf-toast-nolimit');
  valueEl.textContent = remainingMs <= 0 ? 'Limit reached' : formatTime(remainingMs) + ' left';
}

function renderNoLimit(): void {
  if (!valueEl) return;
  valueEl.classList.add('kf-toast-nolimit');
  valueEl.textContent = 'No time limit on this site';
}

// Refresh the displayed value from a local clock so it counts down smoothly,
// independent of the tracker's 2-second storage checkpoints. Runs faster than
// once per second so the displayed second flips right at the boundary.
function updateDisplay(): void {
  if (!hasActiveLimit) return;
  renderValue(Math.max(0, baseRemainingMs - (Date.now() - baseTimestamp)));
}

// --- Show / hide -------------------------------------------------------------

async function show(): Promise<void> {
  if (isShown) return;
  isShown = true;

  // Cancel any in-flight removal so a quick re-press reuses the node
  if (removeTimeout !== null) {
    clearTimeout(removeTimeout);
    removeTimeout = null;
  }

  let darkMode = false;
  try {
    const result = await getStorageData(['darkMode']);
    darkMode = (result.darkMode as boolean) || false;
  } catch (error) {
    if (!isExtensionContextError(error)) throw error;
  }

  // The user may have released the chord while we were awaiting storage
  if (!isShown) return;

  injectStyles(darkMode);

  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = TOAST_ID;

    valueEl = document.createElement('div');
    valueEl.className = 'kf-toast-value';

    const labelEl = document.createElement('div');
    labelEl.className = 'kf-toast-label';
    labelEl.textContent = 'Time remaining';

    toastEl.appendChild(valueEl);
    toastEl.appendChild(labelEl);
  }

  if (!toastEl.isConnected) {
    (document.body || document.documentElement).appendChild(toastEl);
  }

  // Initial content
  try {
    const result = await computeRemaining();
    if (!isShown) return;
    if (result) {
      hasActiveLimit = true;
      baseRemainingMs = result.remainingMs;
      baseTimestamp = Date.now();
      renderValue(result.remainingMs);
      if (tickInterval !== null) clearInterval(tickInterval);
      tickInterval = window.setInterval(updateDisplay, 250);
    } else {
      hasActiveLimit = false;
      renderNoLimit();
    }
  } catch (error) {
    if (isExtensionContextError(error)) {
      hide();
      return;
    }
    throw error;
  }

  // Force reflow so the entry transition runs, then slide in
  void toastEl.offsetHeight;
  toastEl.classList.add('visible');
}

function hide(): void {
  if (!isShown) return;
  isShown = false;
  hasActiveLimit = false;

  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  if (!toastEl) return;
  toastEl.classList.remove('visible');

  // Remove after the slide-out transition finishes
  if (removeTimeout !== null) clearTimeout(removeTimeout);
  removeTimeout = window.setTimeout(() => {
    if (!isShown && toastEl && toastEl.isConnected) {
      toastEl.remove();
    }
    removeTimeout = null;
  }, 320);
}

// --- Event handlers ----------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat) return; // ignore auto-repeat while held
  if (!eventMatchesShortcut(e)) return;
  e.preventDefault();
  void show();
}

function onKeyUp(e: KeyboardEvent): void {
  if (!isShown) return;
  if (isChordKey(e)) hide();
}

function onWindowBlur(): void {
  // Releasing focus means we'll miss the keyup, so tear down to avoid sticking
  hide();
}

// --- Public API --------------------------------------------------------------

export async function initTimeToast(): Promise<void> {
  if (listenersAttached) return;
  listenersAttached = true;

  try {
    const result = await getStorageData(['timeToastShortcut']);
    shortcut = getSafeTimeToastShortcut(result.timeToastShortcut);
  } catch (error) {
    if (!isExtensionContextError(error)) throw error;
  }

  // Keep the cached shortcut in sync with settings changes (no reload needed)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.timeToastShortcut?.newValue) {
        shortcut = getSafeTimeToastShortcut(changes.timeToastShortcut.newValue);
      }
    });
  } catch {
    // Extension context may be invalidated; ignore
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onWindowBlur);
}

export function stopTimeToast(): void {
  if (!listenersAttached) return;
  listenersAttached = false;

  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('keyup', onKeyUp, true);
  window.removeEventListener('blur', onWindowBlur);

  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (removeTimeout !== null) {
    clearTimeout(removeTimeout);
    removeTimeout = null;
  }
  if (toastEl && toastEl.isConnected) toastEl.remove();
  toastEl = null;
  valueEl = null;
  isShown = false;
}
