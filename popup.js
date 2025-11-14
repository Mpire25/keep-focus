// Popup UI for managing blocked sites

let blockedSites = [];
let focusStreak = 0;
let darkMode = false;
let timeLimits = [];
let timeTracking = {};

// Load data from storage
async function loadData() {
  try {
    const result = await chrome.storage.sync.get(['blockedSites', 'focusStreak', 'darkMode', 'timeLimits', 'timeTracking']);
    blockedSites = result.blockedSites || [];
    focusStreak = result.focusStreak || 0;
    darkMode = result.darkMode || false;
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    applyDarkMode();
    renderBlockedList();
    renderTimeLimitsList();
  } catch (error) {
    // Error loading data
  }
}

// Save data to storage
async function saveData() {
  try {
    await chrome.storage.sync.set({
      blockedSites: blockedSites,
      focusStreak: focusStreak
    });
  } catch (error) {
    // Error saving data
  }
}

// Save time limits to storage
async function saveTimeLimits() {
  try {
    await chrome.storage.sync.set({
      timeLimits: timeLimits,
      timeTracking: timeTracking
    });
  } catch (error) {
    // Error saving data
  }
}

// Update extension icon based on dark mode
async function updateExtensionIcon(isDarkMode) {
  try {
    const iconSizes = [16, 32, 48, 96, 128, 256];
    const iconPaths = {};
    
    iconSizes.forEach(size => {
      iconPaths[size] = isDarkMode 
        ? `icon${size}-dark.png` 
        : `icon${size}.png`;
    });
    
    await chrome.action.setIcon({ path: iconPaths });
  } catch (error) {
    // If dark mode icons don't exist, fall back to regular icons
    // This allows the extension to work even without dark mode icon files
  }
}

// Apply dark mode to the page
function applyDarkMode() {
  const body = document.body;
  
  if (darkMode) {
    body.classList.add('dark-mode');
  } else {
    body.classList.remove('dark-mode');
  }
  
  // Update extension icon when dark mode is applied
  updateExtensionIcon(darkMode);
}

// Open standalone extension page
function openStandalonePage() {
  const url = chrome.runtime.getURL('standalone.html');
  chrome.tabs.create({ url: url });
}

// Update fade overlays based on scroll position
function updateFadeOverlays(listElement, wrapperElement) {
  if (!listElement || !wrapperElement) return;
  
  const scrollTop = listElement.scrollTop;
  const scrollHeight = listElement.scrollHeight;
  const clientHeight = listElement.clientHeight;
  const fadeHeight = 30; // Match the CSS fade height
  
  // Check if content is scrollable
  const isScrollable = scrollHeight > clientHeight;
  
  if (!isScrollable) {
    wrapperElement.classList.remove('fade-top', 'fade-bottom');
    return;
  }
  
  // Check if scrolled away from top (by fade height)
  if (scrollTop > fadeHeight) {
    wrapperElement.classList.add('fade-top');
  } else {
    wrapperElement.classList.remove('fade-top');
  }
  
  // Check if scrolled away from bottom
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  if (distanceFromBottom > fadeHeight) {
    wrapperElement.classList.add('fade-bottom');
  } else {
    wrapperElement.classList.remove('fade-bottom');
  }
}

// Render the blocked sites list
function renderBlockedList() {
  const list = document.getElementById('blockedList');
  const wrapper = document.getElementById('blockedListWrapper');
  
  if (blockedSites.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No blocked sites yet.<br>Add a site to get started!</p>
      </div>
    `;
    // Update fade overlays after rendering
    setTimeout(() => updateFadeOverlays(list, wrapper), 0);
    return;
  }

  // Sort blocked sites alphabetically by URL
  const sortedSites = [...blockedSites].sort((a, b) => {
    return a.url.localeCompare(b.url);
  });

  list.innerHTML = sortedSites.map((siteObj, index) => {
    const site = siteObj.url;
    const blockChildren = siteObj.blockChildren !== false;
    const modeText = blockChildren ? 'Blocks all subpages' : 'Blocks this page only';
    
    return `
    <li class="blocked-item">
      <span class="site-url">
        <span class="site-url-main">${escapeHtml(site)}</span>
        <span class="site-url-mode">${modeText}</span>
      </span>
      <button class="btn-remove" data-url="${escapeHtml(site)}">Remove</button>
    </li>
  `;
  }).join('');

  // Add event listeners to remove buttons
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      removeSiteByUrl(url);
    });
  });
  
  // Update fade overlays after rendering
  setTimeout(() => updateFadeOverlays(list, wrapper), 0);
  
  // Attach scroll listener if not already attached
  if (!list.dataset.fadeListenerAttached) {
    list.addEventListener('scroll', () => updateFadeOverlays(list, wrapper));
    list.dataset.fadeListenerAttached = 'true';
  }
}

// Add a site to the blocked list
async function addSite() {
  const input = document.getElementById('siteInput');
  const site = input.value.trim();
  const blockChildrenCheckbox = document.getElementById('blockChildrenCheckbox');
  const blockChildren = blockChildrenCheckbox.checked;

  if (!site) {
    return;
  }

  // Validate the URL/domain
  const validationResult = validateUrl(site);
  if (!validationResult.isValid) {
    showError(validationResult.error);
    return;
  }

  // Normalize the URL (remove protocol, www, trailing slashes, etc.)
  const normalizedSite = normalizeUrl(site);
  
  // Check if site already exists
  const siteExists = blockedSites.some(siteObj => siteObj.url === normalizedSite);
  
  if (siteExists) {
    showError('This site is already in your blocked list.');
    input.value = '';
    return;
  }

  // Add as object with url and blockChildren properties
  const newSite = {
    url: normalizedSite,
    blockChildren: blockChildren
  };
  blockedSites.push(newSite);
  
  input.value = '';
  clearError();
  await saveData();
  renderBlockedList();
}

// Remove a site from the blocked list by URL
async function removeSiteByUrl(url) {
  const index = blockedSites.findIndex(siteObj => siteObj.url === url);
  if (index !== -1) {
    blockedSites.splice(index, 1);
    
    // Also remove from unlockedUntil if it exists
    try {
      const result = await chrome.storage.sync.get(['unlockedUntil']);
      const unlockedUntil = result.unlockedUntil || {};
      let updated = false;
      
      // Remove the site from unlockedUntil if it exists (exact URL match)
      if (unlockedUntil[url]) {
        delete unlockedUntil[url];
        updated = true;
      }
      
      // Also check for normalized hostname matches (fallback case from getSiteKey)
      // Extract hostname from URL (first part before /)
      const urlParts = url.split('/');
      const hostname = urlParts[0].toLowerCase().replace(/^www\./, '');
      if (unlockedUntil[hostname]) {
        delete unlockedUntil[hostname];
        updated = true;
      }
      
      // Save updated unlockedUntil if any changes were made
      if (updated) {
        await chrome.storage.sync.set({ unlockedUntil });
      }
    } catch (error) {
      // Error cleaning up unlockedUntil, but continue with removal
    }
    
    await saveData();
    renderBlockedList();
  }
}

// Validate URL/domain input
function validateUrl(url) {
  if (!url || url.trim().length === 0) {
    return { isValid: false, error: 'Please enter a URL or domain.' };
  }

  // Try to parse as URL first (handles full URLs)
  try {
    // Add protocol if missing for URL parsing
    let urlToParse = url.trim();
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = 'https://' + urlToParse;
    }
    
    const urlObj = new URL(urlToParse);
    const hostname = urlObj.hostname;
    
    // Basic domain validation
    if (!hostname || hostname.length === 0) {
      return { isValid: false, error: 'Invalid URL or domain.' };
    }
    
    // Check for valid domain format (at least one dot or localhost)
    const domainPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^localhost$|^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    if (!domainPattern.test(hostname) && hostname !== 'localhost') {
      return { isValid: false, error: 'Please enter a valid domain or URL.' };
    }
    
    return { isValid: true };
  } catch (e) {
    // If URL parsing fails, try to validate as domain directly
    const domainPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^localhost$|^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    const cleanDomain = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    
    if (domainPattern.test(cleanDomain) || cleanDomain === 'localhost') {
      return { isValid: true };
    }
    
    return { isValid: false, error: 'Please enter a valid domain or URL (e.g., example.com or https://example.com).' };
  }
}

// Normalize hostname by removing www. prefix for consistent matching
function normalizeHostname(hostname) {
  if (!hostname) return hostname;
  // Remove www. prefix if present (case-insensitive)
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return normalized;
}

// Normalize URL for consistent matching
function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove protocol (http://, https://)
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Remove fragment and query parameters for the base URL
  // But keep the path if it exists
  try {
    // Try to parse as URL to handle paths properly
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    const urlObj = new URL(normalized);
    // Use normalizeHostname helper for consistency
    const hostname = normalizeHostname(urlObj.hostname);
    const pathname = urlObj.pathname.replace(/\/$/, '');
    normalized = hostname.toLowerCase() + pathname.toLowerCase();
  } catch (e) {
    // If parsing fails, just clean up what we can
    // Split by / to separate domain from path
    const parts = normalized.split('/');
    const domain = normalizeHostname(parts[0]);
    const path = parts.slice(1).join('/').toLowerCase();
    normalized = domain.toLowerCase() + (path ? '/' + path : '');
  }
  
  return normalized;
}

// Show error message
function showError(message) {
  clearError();
  const input = document.getElementById('siteInput');
  const inputGroup = input.closest('.input-group');
  
  // Create error element if it doesn't exist
  let errorEl = document.getElementById('urlError');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'urlError';
    errorEl.className = 'error-message';
    inputGroup.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  input.classList.add('error');
}

// Clear error message
function clearError() {
  const input = document.getElementById('siteInput');
  const errorEl = document.getElementById('urlError');
  
  if (errorEl) {
    errorEl.remove();
  }
  input.classList.remove('error');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format time in milliseconds to readable format
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Get current date string (YYYY-MM-DD)
function getCurrentDateString() {
  const now = new Date();
  // Use local date instead of UTC so reset happens at local midnight
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reset daily tracking if date has changed
function resetDailyTrackingIfNeeded() {
  const currentDate = getCurrentDateString();
  let updated = false;
  
  for (const siteKey in timeTracking) {
    if (timeTracking[siteKey].date !== currentDate) {
      timeTracking[siteKey] = {
        date: currentDate,
        timeSpent: 0,
        lastActive: 0
      };
      updated = true;
    }
  }
  
  if (updated) {
    saveTimeLimits();
  }
}

// Get remaining time for a site
function getRemainingTime(siteKey, limitMinutes) {
  resetDailyTrackingIfNeeded();
  
  const tracking = timeTracking[siteKey];
  if (!tracking || tracking.date !== getCurrentDateString()) {
    return limitMinutes * 60 * 1000; // Return limit in milliseconds
  }
  
  const limitMs = limitMinutes * 60 * 1000;
  const remaining = Math.max(0, limitMs - tracking.timeSpent);
  return remaining;
}

// Render the time limits list
function renderTimeLimitsList() {
  const list = document.getElementById('timeLimitsList');
  const wrapper = document.getElementById('timeLimitsListWrapper');
  
  if (!list) return;
  
  resetDailyTrackingIfNeeded();
  
  if (timeLimits.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No time limits set yet.<br>Add a site and time limit to get started!</p>
      </div>
    `;
    // Update fade overlays after rendering
    setTimeout(() => updateFadeOverlays(list, wrapper), 0);
    return;
  }

  // Sort time limits alphabetically by URL
  const sortedLimits = [...timeLimits].sort((a, b) => {
    return a.url.localeCompare(b.url);
  });

  list.innerHTML = sortedLimits.map((limitObj) => {
    const site = limitObj.url;
    const limitMinutes = limitObj.limitMinutes;
    const remaining = getRemainingTime(site, limitMinutes);
    const remainingFormatted = formatTime(remaining);
    const limitFormatted = formatTime(limitMinutes * 60 * 1000);
    const isExceeded = remaining === 0;
    
    return `
    <li class="blocked-item">
      <span class="site-url">
        <span class="site-url-main">${escapeHtml(site)}</span>
        <span class="site-url-mode">${limitFormatted} per day • ${isExceeded ? 'Limit reached' : remainingFormatted + ' remaining'}</span>
      </span>
      <button class="btn-remove" data-url="${escapeHtml(site)}" data-type="time-limit">Remove</button>
    </li>
  `;
  }).join('');

  // Add event listeners to remove buttons
  document.querySelectorAll('.btn-remove[data-type="time-limit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      removeTimeLimit(url);
    });
  });
  
  // Update fade overlays after rendering
  setTimeout(() => updateFadeOverlays(list, wrapper), 0);
  
  // Attach scroll listener if not already attached
  if (!list.dataset.fadeListenerAttached) {
    list.addEventListener('scroll', () => updateFadeOverlays(list, wrapper));
    list.dataset.fadeListenerAttached = 'true';
  }
}

// Add a time limit
async function addTimeLimit() {
  const siteInput = document.getElementById('timeLimitSiteInput');
  const minutesInput = document.getElementById('timeLimitMinutesInput');
  const site = siteInput.value.trim();
  const minutes = parseInt(minutesInput.value.trim(), 10);

  if (!site) {
    showTimeLimitError('Please enter a site URL.');
    return;
  }

  if (!minutes || minutes < 1) {
    showTimeLimitError('Please enter a valid time limit (at least 1 minute).');
    return;
  }

  // Validate the URL/domain
  const validationResult = validateUrl(site);
  if (!validationResult.isValid) {
    showTimeLimitError(validationResult.error);
    return;
  }

  // Normalize the URL
  const normalizedSite = normalizeUrl(site);
  
  // Check if site already exists
  const siteExists = timeLimits.some(limitObj => limitObj.url === normalizedSite);
  
  if (siteExists) {
    showTimeLimitError('This site already has a time limit.');
    siteInput.value = '';
    minutesInput.value = '';
    return;
  }

  // Add time limit
  const newLimit = {
    url: normalizedSite,
    limitMinutes: minutes
  };
  timeLimits.push(newLimit);
  
  // Initialize tracking for this site if it doesn't exist
  const siteKey = normalizedSite;
  if (!timeTracking[siteKey]) {
    timeTracking[siteKey] = {
      date: getCurrentDateString(),
      timeSpent: 0,
      lastActive: 0
    };
  }
  
  siteInput.value = '';
  minutesInput.value = '';
  clearTimeLimitError();
  await saveTimeLimits();
  renderTimeLimitsList();
}

// Remove a time limit
async function removeTimeLimit(url) {
  const index = timeLimits.findIndex(limitObj => limitObj.url === url);
  if (index !== -1) {
    timeLimits.splice(index, 1);
    
    // Also remove from timeTracking if it exists
    if (timeTracking[url]) {
      delete timeTracking[url];
    }
    
    await saveTimeLimits();
    renderTimeLimitsList();
  }
}

// Show error message for time limits
function showTimeLimitError(message) {
  clearTimeLimitError();
  const siteInput = document.getElementById('timeLimitSiteInput');
  const inputGroup = siteInput.closest('.input-group');
  
  // Create error element if it doesn't exist
  let errorEl = document.getElementById('timeLimitError');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'timeLimitError';
    errorEl.className = 'error-message';
    // Insert after the input group, not inside it
    inputGroup.parentNode.insertBefore(errorEl, inputGroup.nextSibling);
  }
  
  errorEl.textContent = message;
  siteInput.classList.add('error');
}

// Clear error message for time limits
function clearTimeLimitError() {
  const siteInput = document.getElementById('timeLimitSiteInput');
  const errorEl = document.getElementById('timeLimitError');
  
  if (errorEl) {
    errorEl.remove();
  }
  if (siteInput) {
    siteInput.classList.remove('error');
  }
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn.dataset.tab === tabName) {
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
  const externalLinkBtn = document.getElementById('externalLinkBtn');
  
  document.getElementById('addBtn').addEventListener('click', addSite);
  document.getElementById('addTimeLimitBtn').addEventListener('click', addTimeLimit);
  
  // External link button
  if (externalLinkBtn) {
    externalLinkBtn.addEventListener('click', openStandalonePage);
  }
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
  
  // Listen for storage changes to update dark mode when changed in standalone page
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.darkMode) {
      darkMode = changes.darkMode.newValue || false;
      applyDarkMode(); // This will also update the icon
    }
  });
  
  if (siteInput) {
    siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addSite();
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
        addTimeLimit();
      }
    });
    
    timeLimitSiteInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
  
  if (timeLimitMinutesInput) {
    timeLimitMinutesInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTimeLimit();
      }
    });
    
    timeLimitMinutesInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
});

