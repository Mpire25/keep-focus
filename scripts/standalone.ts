// Standalone page UI for managing blocked sites

import { getAllData, setStorageData } from '../utils/storage-utils.js';
import { renderBlockedList, renderTimeLimitsList, updateFadeOverlays } from '../ui/list-renderer.js';
import { addSite, removeSiteByUrl, addTimeLimit, removeTimeLimit, showError, clearError, showTimeLimitError, clearTimeLimitError } from '../ui/form-handlers.js';
import type { BlockedSite, TimeLimit, TimeTracking, ElementBlockingRule } from '../types/index.js';

let blockedSites: BlockedSite[] = [];
let focusStreak = 0;
let darkMode = false;
let timeLimits: TimeLimit[] = [];
let timeTracking: TimeTracking = {};
let elementBlockingRules: ElementBlockingRule[] = [];

// YouTube selector mappings (must match content/element-blocking.ts)
const YOUTUBE_SELECTORS = {
  shorts: [
    'ytd-reel-shelf-renderer',
    'a[href*="/shorts/"]',
    'ytd-shorts',
    'ytd-reel-item-renderer'
  ],
  suggestedVideos: [
    'ytd-watch-next-secondary-results-renderer',
    'ytd-compact-video-renderer',
    '#secondary',
    'ytd-item-section-renderer[class*="watch-next"]'
  ],
  ads: [
    'ytd-ad-slot-renderer',
    '.ytp-ad-module',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-display-ad-renderer'
  ],
  comments: [
    '#comments',
    'ytd-comments',
    'ytd-comments-header-renderer',
    'ytd-comment-thread-renderer'
  ],
  minimalMode: [
    '#secondary',
    '#related',
    'ytd-watch-next-secondary-results-renderer',
    '#comments',
    'ytd-comments',
    'ytd-item-section-renderer[class*="watch-next"]',
    'ytd-compact-video-renderer'
  ]
};

// Load data from storage
async function loadData(): Promise<void> {
  try {
    const result = await getAllData();
    blockedSites = result.blockedSites || [];
    focusStreak = result.focusStreak || 0;
    darkMode = result.darkMode || false;
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    elementBlockingRules = result.elementBlockingRules || [];
    applyDarkMode();
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    renderElementBlockingUI();
    attachRemoveListeners();
  } catch (error) {
    // Silently handle errors
  }
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

// Update extension icon based on dark mode
async function updateExtensionIcon(isDarkMode: boolean): Promise<void> {
  try {
    const iconSizes = [16, 32, 48, 96, 128, 256];
    const iconPaths: Record<number, string> = {};
    
    iconSizes.forEach(size => {
      const relativePath = isDarkMode 
        ? `icons/icon${size}-dark.png` 
        : `icons/icon${size}.png`;
      iconPaths[size] = chrome.runtime.getURL(relativePath);
    });
    
    await chrome.action.setIcon({ path: iconPaths });
  } catch (error) {
    // If dark mode icons don't exist, fall back to regular icons
    // This allows the extension to work even without dark mode icon files
    if (isDarkMode) {
      try {
        const iconSizes = [16, 32, 48, 96, 128, 256];
        const iconPaths: Record<number, string> = {};
        iconSizes.forEach(size => {
          iconPaths[size] = chrome.runtime.getURL(`icons/icon${size}.png`);
        });
        await chrome.action.setIcon({ path: iconPaths });
      } catch (fallbackError) {
        // Silently fail if icon update fails
      }
    }
  }
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

// Get or create YouTube blocking rule
function getYouTubeBlockingRule(option: keyof typeof YOUTUBE_SELECTORS): ElementBlockingRule | null {
  const domain = 'youtube.com';
  const selectors = YOUTUBE_SELECTORS[option];
  
  let rule = elementBlockingRules.find(r => 
    r.domain === domain && 
    r.selectors.length === selectors.length &&
    r.selectors.every(s => selectors.includes(s))
  );
  
  if (!rule) {
    rule = {
      domain,
      selectors,
      enabled: false
    };
    elementBlockingRules.push(rule);
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
  
  options.forEach(({ id, option }) => {
    const toggle = document.getElementById(id) as HTMLInputElement | null;
    if (toggle) {
      const rule = getYouTubeBlockingRule(option);
      const enabled = rule ? rule.enabled : false;
      toggle.checked = enabled;
    }
  });
}

// Handle YouTube toggle change
async function handleYouTubeToggleChange(option: keyof typeof YOUTUBE_SELECTORS, enabled: boolean): Promise<void> {
  await updateYouTubeBlockingRule(option, enabled);
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

