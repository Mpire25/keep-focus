// Standalone page UI for managing blocked sites

import { getAllData, setStorageData, setLocalData } from '../utils/storage-utils.js';
import { renderBlockedList, renderTimeLimitsList, updateFadeOverlays } from '../ui/list-renderer.js';
import { addSite, removeSiteByUrl, addTimeLimit, removeTimeLimit, showError, clearError, showTimeLimitError, clearTimeLimitError } from '../ui/form-handlers.js';
import type { BlockedSite, TimeLimit, TimeTracking, ElementBlockingRule, ScreenTimeHistory, TimeToastShortcut } from '../types/index.js';
import { DEFAULT_TIME_TOAST_SHORTCUT } from '../types/index.js';
import { formatTime, getCurrentDateString } from '../utils/time-utils.js';
import { YOUTUBE_SELECTORS } from '../content/element-blocking.js';
import { updateExtensionIcon } from '../utils/icon-utils.js';

let blockedSites: BlockedSite[] = [];
let darkMode = false;
let timeLimits: TimeLimit[] = [];
let timeTracking: TimeTracking = {};
let elementBlockingRules: ElementBlockingRule[] = [];
let pendingRuleMigrationSave = false;
let screenTimeEnabled = false;
let screenTimeHistory: ScreenTimeHistory = {};
let selectedHistoryDate: string | null = null;
let timeToastShortcut: TimeToastShortcut = DEFAULT_TIME_TOAST_SHORTCUT;
let recordingShortcut = false;

const LEGACY_YOUTUBE_SELECTORS: Partial<Record<keyof typeof YOUTUBE_SELECTORS, string[]>> = {
  suggestedVideos: [
    'ytd-watch-next-secondary-results-renderer',
    'ytd-compact-video-renderer',
    'ytd-item-section-renderer[class*="watch-next"]'
  ]
};

function selectorsMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(s => b.includes(s));
}

function scheduleRuleMigrationSave(): void {
  if (pendingRuleMigrationSave) {
    return;
  }
  pendingRuleMigrationSave = true;
  queueMicrotask(async () => {
    pendingRuleMigrationSave = false;
    try {
      await setStorageData({ elementBlockingRules });
    } catch {
      // Silently handle save errors
    }
  });
}

// Load data from storage
async function loadData(): Promise<void> {
  try {
    const result = await getAllData();
    blockedSites = result.blockedSites || [];
    darkMode = result.darkMode || false;
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    elementBlockingRules = result.elementBlockingRules || [];
    screenTimeEnabled = result.screenTimeEnabled || false;
    screenTimeHistory = result.screenTimeHistory || {};
    timeToastShortcut = result.timeToastShortcut || DEFAULT_TIME_TOAST_SHORTCUT;
    renderShortcutButton();
    applyDarkMode();
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    renderElementBlockingUI();
    renderScreenTimeSection();
    attachRemoveListeners();
  } catch (error) {
    // Silently handle errors
  }
}

const SITE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F7B731',
  '#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E', '#74B9FF',
];

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return days;
}

function getDayTotalMs(dateStr: string): number {
  const entry = screenTimeHistory[dateStr];
  if (!entry) return 0;
  return Object.values(entry).reduce((a, b) => a + b, 0);
}

function getDayLabel(dateStr: string): string {
  const today = getCurrentDateString();
  if (dateStr === today) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function getDayLetter(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1);
}

function renderBarChart(): void {
  const container = document.getElementById('stBarChart');
  if (!container) return;

  const days = getLast7Days();
  const totals = days.map(d => getDayTotalMs(d));
  const maxTotal = Math.max(...totals, 1);
  const today = getCurrentDateString();
  const selected = selectedHistoryDate ?? today;

  container.innerHTML = days.map((dateStr, i) => {
    const total = totals[i];
    const heightPct = total > 0 ? Math.max((total / maxTotal) * 100, 8) : 0;
    const isSelected = dateStr === selected;
    const isToday = dateStr === today;
    return `<div class="st-bar-col${isSelected ? ' selected' : ''}" data-date="${dateStr}">
      <div class="st-bar-track"><div class="st-bar-fill" style="height:${heightPct}%"></div></div>
      <div class="st-bar-label${isToday ? ' today' : ''}">${getDayLetter(dateStr)}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('.st-bar-col').forEach(col => {
    col.addEventListener('click', () => {
      const dateStr = (col as HTMLElement).dataset.date!;
      selectedHistoryDate = dateStr === today ? null : dateStr;
      renderScreenTimeSection();
    });
  });
}

function renderMostUsed(): void {
  const container = document.getElementById('stMostUsedList');
  if (!container) return;

  const today = getCurrentDateString();
  const dateStr = selectedHistoryDate ?? today;
  const entry = screenTimeHistory[dateStr];

  container.replaceChildren();

  if (!entry || Object.keys(entry).length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state-text';
    empty.textContent = 'No activity recorded.';
    container.appendChild(empty);
    return;
  }

  const sorted = Object.entries(entry).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxMs = sorted[0][1];

  const prevDate = new Date(dateStr + 'T00:00:00');
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
  const prevEntry = screenTimeHistory[prevDateStr] ?? {};

  sorted.forEach(([domain, ms], i) => {
    const color = SITE_COLORS[i % SITE_COLORS.length];
    const widthPct = ((ms / maxMs) * 100).toFixed(1);
    const prevMs = prevEntry[domain];
    let deltaCls = '';
    let deltaText = '';
    if (prevMs !== undefined && ms !== prevMs) {
      const delta = ms - prevMs;
      deltaCls = delta > 0 ? 'up' : 'down';
      deltaText = `${delta > 0 ? '↑' : '↓'} ${formatTime(Math.abs(delta))}`;
    }
    const item = document.createElement('div');
    item.className = 'st-site-item';

    const faviconWrap = document.createElement('div');
    faviconWrap.className = 'st-site-favicon-wrap';

    const favicon = document.createElement('img');
    favicon.className = 'st-favicon';
    favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    favicon.alt = '';

    const dot = document.createElement('div');
    dot.className = 'st-site-dot';
    dot.hidden = true;
    dot.style.background = color;

    favicon.addEventListener('error', () => {
      favicon.hidden = true;
      dot.hidden = false;
    });

    const siteInfo = document.createElement('div');
    siteInfo.className = 'st-site-info';

    const siteTop = document.createElement('div');
    siteTop.className = 'st-site-top';

    const siteName = document.createElement('span');
    siteName.className = 'st-site-name';
    siteName.textContent = domain;

    const siteRight = document.createElement('div');
    siteRight.className = 'st-site-right';

    const siteTime = document.createElement('span');
    siteTime.className = 'st-site-time';
    siteTime.textContent = formatTime(ms);

    const siteDelta = document.createElement('span');
    siteDelta.className = `st-site-delta${deltaCls ? ` ${deltaCls}` : ''}`;
    siteDelta.textContent = deltaText;

    const siteBarTrack = document.createElement('div');
    siteBarTrack.className = 'st-site-bar-track';

    const siteBarFill = document.createElement('div');
    siteBarFill.className = 'st-site-bar-fill';
    siteBarFill.style.width = `${widthPct}%`;
    siteBarFill.style.background = color;

    siteBarTrack.appendChild(siteBarFill);
    siteRight.appendChild(siteTime);
    siteRight.appendChild(siteDelta);
    siteTop.appendChild(siteName);
    siteTop.appendChild(siteRight);
    siteInfo.appendChild(siteTop);
    siteInfo.appendChild(siteBarTrack);
    faviconWrap.appendChild(favicon);
    faviconWrap.appendChild(dot);
    item.appendChild(faviconWrap);
    item.appendChild(siteInfo);
    container.appendChild(item);
  });
}

function renderScreenTimeSection(): void {
  const toggle = document.getElementById('screenTimeToggle') as HTMLInputElement | null;
  if (toggle) toggle.checked = screenTimeEnabled;

  const content = document.getElementById('screenTimeContent');
  const disabledEl = document.getElementById('screenTimeDisabled');
  if (content) content.style.display = screenTimeEnabled ? '' : 'none';
  if (disabledEl) disabledEl.style.display = screenTimeEnabled ? 'none' : '';

  if (!screenTimeEnabled) return;

  const today = getCurrentDateString();
  const dateStr = selectedHistoryDate ?? today;
  const total = getDayTotalMs(dateStr);

  const days7 = getLast7Days();
  const daysWithData = days7.filter(d => getDayTotalMs(d) > 0);
  const avgMs = daysWithData.length > 0
    ? daysWithData.reduce((sum, d) => sum + getDayTotalMs(d), 0) / days7.length
    : 0;

  const periodEl = document.getElementById('stSummaryPeriod');
  const timeEl = document.getElementById('stSummaryTime');
  const avgEl = document.getElementById('stSummaryAvg');
  if (periodEl) periodEl.textContent = getDayLabel(dateStr);
  if (timeEl) timeEl.textContent = total > 0 ? formatTime(total) : '—';
  if (avgEl) avgEl.textContent = avgMs > 0 ? `${formatTime(Math.round(avgMs))} daily avg` : '';

  renderBarChart();
  renderMostUsed();
}

async function toggleScreenTime(): Promise<void> {
  screenTimeEnabled = !screenTimeEnabled;
  await setLocalData({ screenTimeEnabled });
  renderScreenTimeSection();
}

// Attach remove button listeners
function attachRemoveListeners(): void {
  // Blocked sites remove buttons
  document.querySelectorAll('.btn-remove:not([data-type="time-limit"])').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const url = target.dataset.url;
      if (url) {
        const result = await removeSiteByUrl(url, blockedSites);
        if (result.success) {
          blockedSites = result.blockedSites || [];
          renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
          attachRemoveListeners();
        }
      }
    });
  });
  
  // Time limit remove buttons
  document.querySelectorAll('.btn-remove[data-type="time-limit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const url = target.dataset.url;
      if (url) {
        const result = await removeTimeLimit(url, timeLimits, timeTracking);
        if (result.success) {
          timeLimits = result.timeLimits || [];
          timeTracking = result.timeTracking || {};
          renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
          attachRemoveListeners();
        }
      }
    });
  });
}

// Update page icons (favicon and sidebar icon) based on dark mode
function updatePageIcons(isDarkMode: boolean): void {
  // Update favicon - use 32x32 for better quality on high-DPI displays
  const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
  if (favicon) {
    favicon.href = isDarkMode ? '../icons/icon32-dark.png' : '../icons/icon32.png';
  }
  
  // Update sidebar icon - use 96x96 for better quality on high-DPI displays
  // CSS will scale it down to 48px, but the higher resolution ensures crispness
  const sidebarIcon = document.getElementById('sidebarIcon') as HTMLImageElement | null;
  if (sidebarIcon) {
    sidebarIcon.src = isDarkMode ? '../icons/icon96-dark.png' : '../icons/icon96.png';
  }
}

// Apply dark mode to the page
function applyDarkMode(): void {
  const body = document.body;
  const darkModeToggle = document.getElementById('darkModeToggle') as HTMLInputElement | null;
  
  if (darkMode) {
    body.classList.add('dark-mode');
    if (darkModeToggle) {
      darkModeToggle.checked = true;
    }
  } else {
    body.classList.remove('dark-mode');
    if (darkModeToggle) {
      darkModeToggle.checked = false;
    }
  }
  
  // Update extension icon when dark mode is applied
  updateExtensionIcon(darkMode);
  
  // Update page icons (favicon and sidebar icon)
  updatePageIcons(darkMode);
}

// Toggle dark mode
async function toggleDarkMode(): Promise<void> {
  darkMode = !darkMode;
  applyDarkMode(); // This will also update the icon
  await setStorageData({ darkMode: darkMode });
}

// --- Time-remaining popup shortcut ------------------------------------------

// Turn a KeyboardEvent.code into a short human label (e.g. KeyY -> Y, Digit1 -> 1)
function codeToLabel(code: string): string {
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

function formatShortcut(shortcut: TimeToastShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrlOrMeta) parts.push('Cmd/Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(codeToLabel(shortcut.code));
  return parts.join(' + ');
}

function renderShortcutButton(): void {
  const btn = document.getElementById('shortcutRecordBtn');
  if (!btn) return;
  if (recordingShortcut) {
    btn.textContent = 'Press keys…';
    btn.classList.add('recording');
  } else {
    btn.textContent = formatShortcut(timeToastShortcut);
    btn.classList.remove('recording');
  }
}

function isModifierCode(code: string): boolean {
  return code.startsWith('Control') || code.startsWith('Shift') ||
         code.startsWith('Alt') || code.startsWith('Meta');
}

function stopRecordingShortcut(): void {
  recordingShortcut = false;
  document.removeEventListener('keydown', onShortcutKeyDown, true);
  renderShortcutButton();
}

async function onShortcutKeyDown(e: KeyboardEvent): Promise<void> {
  if (!recordingShortcut) return;
  e.preventDefault();
  e.stopPropagation();

  // Escape cancels without changing the binding
  if (e.code === 'Escape') {
    stopRecordingShortcut();
    return;
  }

  // Wait for a non-modifier key to complete the chord
  if (isModifierCode(e.code)) return;

  timeToastShortcut = {
    ctrlOrMeta: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    code: e.code
  };

  stopRecordingShortcut();
  await setStorageData({ timeToastShortcut });
}

function startRecordingShortcut(): void {
  if (recordingShortcut) {
    stopRecordingShortcut();
    return;
  }
  recordingShortcut = true;
  renderShortcutButton();
  document.addEventListener('keydown', onShortcutKeyDown, true);
}

async function resetShortcut(): Promise<void> {
  if (recordingShortcut) stopRecordingShortcut();
  timeToastShortcut = { ...DEFAULT_TIME_TOAST_SHORTCUT };
  renderShortcutButton();
  await setStorageData({ timeToastShortcut });
}

// Get or create YouTube blocking rule
function getYouTubeBlockingRule(option: keyof typeof YOUTUBE_SELECTORS): ElementBlockingRule | null {
  const domain = 'youtube.com';
  const selectors = YOUTUBE_SELECTORS[option];

  // Match by stable option field first, then fall back to legacy selector-based matching
  let rule = elementBlockingRules.find(r => r.domain === domain && r.option === option)
    ?? elementBlockingRules.find(r =>
        r.domain === domain &&
        selectorsMatch(r.selectors, selectors)
      );

  // Compatibility path for pre-refactor suggestedVideos rules (old selector set)
  if (!rule) {
    const legacySelectors = LEGACY_YOUTUBE_SELECTORS[option];
    if (legacySelectors) {
      rule = elementBlockingRules.find(r =>
        r.domain === domain &&
        !r.option &&
        selectorsMatch(r.selectors, legacySelectors)
      );
    }
  }

  if (!rule) {
    rule = { domain, selectors: [...selectors], enabled: false, option };
    elementBlockingRules.push(rule);
  } else {
    // Migrate: keep selectors in sync with current definition and stamp option field
    const hadOption = !!rule.option;
    const hadCurrentSelectors = selectorsMatch(rule.selectors, selectors);
    if (!hadCurrentSelectors) {
      rule.selectors = [...selectors];
    }
    if (!rule.option) {
      rule.option = option;
    }
    if (!hadOption || !hadCurrentSelectors) {
      scheduleRuleMigrationSave();
    }
  }

  return rule;
}

// Update YouTube blocking rule
async function updateYouTubeBlockingRule(option: keyof typeof YOUTUBE_SELECTORS, enabled: boolean): Promise<void> {
  const rule = getYouTubeBlockingRule(option);
  if (rule) {
    rule.enabled = enabled;
    
    await setStorageData({ elementBlockingRules: elementBlockingRules });
    
    // Notify content scripts to re-initialize
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.reload(tab.id).catch(() => {
            // Silently handle reload errors
          });
        }
      });
    } catch (error) {
      // Silently handle errors
    }
  }
}

// Render element blocking UI
function renderElementBlockingUI(): void {
  const options: Array<{ id: string; option: keyof typeof YOUTUBE_SELECTORS }> = [
    { id: 'youtubeShortsToggle', option: 'shorts' },
    { id: 'youtubeSuggestedToggle', option: 'suggestedVideos' },
    { id: 'youtubeAdsToggle', option: 'ads' },
    { id: 'youtubeCommentsToggle', option: 'comments' },
    { id: 'youtubeMinimalToggle', option: 'minimalMode' }
  ];
  
  // Check if minimal mode is enabled
  const minimalModeRule = getYouTubeBlockingRule('minimalMode');
  const isMinimalModeEnabled = minimalModeRule ? minimalModeRule.enabled : false;
  
  options.forEach(({ id, option }) => {
    const toggle = document.getElementById(id) as HTMLInputElement | null;
    if (toggle) {
      const rule = getYouTubeBlockingRule(option);
      const enabled = rule ? rule.enabled : false;
      toggle.checked = enabled;
      
      // Disable other toggles when minimal mode is enabled
      if (option !== 'minimalMode' && isMinimalModeEnabled) {
        toggle.disabled = true;
        toggle.parentElement?.parentElement?.classList.add('disabled');
      } else {
        toggle.disabled = false;
        toggle.parentElement?.parentElement?.classList.remove('disabled');
      }
    }
  });
}

// Handle YouTube toggle change
async function handleYouTubeToggleChange(option: keyof typeof YOUTUBE_SELECTORS, enabled: boolean): Promise<void> {
  // If minimal mode is being enabled, enable all other options
  if (option === 'minimalMode' && enabled) {
    const otherOptions: Array<keyof typeof YOUTUBE_SELECTORS> = ['shorts', 'suggestedVideos', 'ads', 'comments'];
    
    // Enable all other blocking options
    for (const otherOption of otherOptions) {
      await updateYouTubeBlockingRule(otherOption, true);
    }
    
    // Then enable minimal mode
    await updateYouTubeBlockingRule(option, enabled);
    
    // Update UI to reflect changes
    renderElementBlockingUI();
  } 
  // If minimal mode is being disabled, just update it
  else if (option === 'minimalMode' && !enabled) {
    await updateYouTubeBlockingRule(option, enabled);
    renderElementBlockingUI();
  }
  // If trying to change other options while minimal mode is enabled, prevent it
  else {
    const minimalModeRule = getYouTubeBlockingRule('minimalMode');
    const isMinimalModeEnabled = minimalModeRule ? minimalModeRule.enabled : false;
    
    if (isMinimalModeEnabled) {
      // Prevent the change - restore the toggle to its previous state
      const toggleIdMap: Record<keyof typeof YOUTUBE_SELECTORS, string> = {
        shorts: 'youtubeShortsToggle',
        suggestedVideos: 'youtubeSuggestedToggle',
        ads: 'youtubeAdsToggle',
        comments: 'youtubeCommentsToggle',
        minimalMode: 'youtubeMinimalToggle'
      };
      const toggle = document.getElementById(toggleIdMap[option]) as HTMLInputElement | null;
      if (toggle) {
        toggle.checked = true; // Keep it enabled since minimal mode forces it on
      }
      return; // Don't update the rule
    }
    
    // Normal case: update the rule
    await updateYouTubeBlockingRule(option, enabled);
  }
}

// Add a site to the blocked list
async function handleAddSite(): Promise<void> {
  const result = await addSite(blockedSites);
  if (result.success) {
    blockedSites = result.blockedSites || [];
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    attachRemoveListeners();
  }
}

// Add a time limit
async function handleAddTimeLimit(): Promise<void> {
  const result = await addTimeLimit(timeLimits, timeTracking);
  if (result.success) {
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    attachRemoveListeners();
  }
}

// Switch tabs
function switchTab(tabName: string): void {
  // Update tab buttons (sidebar navigation)
  document.querySelectorAll('.sidebar-tab-button').forEach(btn => {
    if ((btn as HTMLElement).dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Update fade overlays after tab switch
  setTimeout(() => {
    const blockedList = document.getElementById('blockedList');
    const blockedListWrapper = document.getElementById('blockedListWrapper');
    const timeLimitsList = document.getElementById('timeLimitsList');
    const timeLimitsListWrapper = document.getElementById('timeLimitsListWrapper');
    
    if (blockedList && blockedListWrapper) {
      updateFadeOverlays(blockedList, blockedListWrapper);
    }
    if (timeLimitsList && timeLimitsListWrapper) {
      updateFadeOverlays(timeLimitsList, timeLimitsListWrapper);
    }
  }, 0);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  const siteInput = document.getElementById('siteInput');
  const darkModeToggle = document.getElementById('darkModeToggle') as HTMLInputElement | null;
  
  const addBtn = document.getElementById('addBtn');
  const addTimeLimitBtn = document.getElementById('addTimeLimitBtn');
  
  if (addBtn) {
    addBtn.addEventListener('click', handleAddSite);
  }
  if (addTimeLimitBtn) {
    addTimeLimitBtn.addEventListener('click', handleAddTimeLimit);
  }
  
  // Tab switching (sidebar navigation)
  document.querySelectorAll('.sidebar-tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
  
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', toggleDarkMode);
  }

  const screenTimeToggle = document.getElementById('screenTimeToggle') as HTMLInputElement | null;
  if (screenTimeToggle) {
    screenTimeToggle.addEventListener('change', toggleScreenTime);
  }

  const shortcutRecordBtn = document.getElementById('shortcutRecordBtn');
  if (shortcutRecordBtn) {
    shortcutRecordBtn.addEventListener('click', startRecordingShortcut);
  }
  const shortcutResetBtn = document.getElementById('shortcutResetBtn');
  if (shortcutResetBtn) {
    shortcutResetBtn.addEventListener('click', resetShortcut);
  }
  
  // YouTube element blocking toggles
  const youtubeToggles = [
    { id: 'youtubeShortsToggle', option: 'shorts' as keyof typeof YOUTUBE_SELECTORS },
    { id: 'youtubeSuggestedToggle', option: 'suggestedVideos' as keyof typeof YOUTUBE_SELECTORS },
    { id: 'youtubeAdsToggle', option: 'ads' as keyof typeof YOUTUBE_SELECTORS },
    { id: 'youtubeCommentsToggle', option: 'comments' as keyof typeof YOUTUBE_SELECTORS },
    { id: 'youtubeMinimalToggle', option: 'minimalMode' as keyof typeof YOUTUBE_SELECTORS }
  ];
  
  youtubeToggles.forEach(({ id, option }) => {
    const toggle = document.getElementById(id) as HTMLInputElement | null;
    if (toggle) {
      toggle.addEventListener('change', () => {
        handleYouTubeToggleChange(option, toggle.checked);
      });
    }
  });
  
  // Refresh screen time view when storage updates (e.g. tracking in another tab)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.screenTimeHistory) {
      screenTimeHistory = (changes.screenTimeHistory.newValue as ScreenTimeHistory) || {};
      renderScreenTimeSection();
    }
    if (changes.screenTimeEnabled) {
      screenTimeEnabled = changes.screenTimeEnabled.newValue as boolean || false;
      renderScreenTimeSection();
    }
  });

  if (siteInput) {
    siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddSite();
      }
    });
    
    // Clear error when user starts typing
    siteInput.addEventListener('input', () => {
      clearError();
    });
  }
  
  // Time limit inputs
  const timeLimitSiteInput = document.getElementById('timeLimitSiteInput');
  const timeLimitMinutesInput = document.getElementById('timeLimitMinutesInput');
  
  if (timeLimitSiteInput) {
    timeLimitSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddTimeLimit();
      }
    });
    
    timeLimitSiteInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
  
  if (timeLimitMinutesInput) {
    timeLimitMinutesInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddTimeLimit();
      }
    });
    
    timeLimitMinutesInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
});
