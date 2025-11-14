// Shared form handling utilities for popup and standalone pages

import { validateUrl, normalizeUrl } from '../utils/url-utils.js';
import { getCurrentDateString } from '../utils/time-utils.js';
import { getAllData, setStorageData } from '../utils/storage-utils.js';

// Show error message
export function showError(message, inputId = 'siteInput', errorId = 'urlError') {
  clearError(inputId, errorId);
  const input = document.getElementById(inputId);
  const inputGroup = input?.closest('.input-group');
  
  if (!input || !inputGroup) return;
  
  // Create error element if it doesn't exist
  let errorEl = document.getElementById(errorId);
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = errorId;
    errorEl.className = 'error-message';
    inputGroup.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  input.classList.add('error');
}

// Clear error message
export function clearError(inputId = 'siteInput', errorId = 'urlError') {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  
  if (errorEl) {
    errorEl.remove();
  }
  if (input) {
    input.classList.remove('error');
  }
}

// Show error message for time limits
export function showTimeLimitError(message) {
  clearTimeLimitError();
  const siteInput = document.getElementById('timeLimitSiteInput');
  const inputGroup = siteInput?.closest('.input-group');
  
  if (!siteInput || !inputGroup) return;
  
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
export function clearTimeLimitError() {
  const siteInput = document.getElementById('timeLimitSiteInput');
  const errorEl = document.getElementById('timeLimitError');
  
  if (errorEl) {
    errorEl.remove();
  }
  if (siteInput) {
    siteInput.classList.remove('error');
  }
}

// Add a site to the blocked list
export async function addSite(blockedSites, siteInputId = 'siteInput', blockChildrenCheckboxId = 'blockChildrenCheckbox') {
  const input = document.getElementById(siteInputId);
  const site = input?.value.trim();
  const blockChildrenCheckbox = document.getElementById(blockChildrenCheckboxId);
  const blockChildren = blockChildrenCheckbox?.checked ?? true;

  if (!site) {
    return { success: false };
  }

  // Validate the URL/domain
  const validationResult = validateUrl(site);
  if (!validationResult.isValid) {
    showError(validationResult.error);
    return { success: false };
  }

  // Normalize the URL (remove protocol, www, trailing slashes, etc.)
  const normalizedSite = normalizeUrl(site);
  
  // Check if site already exists
  const siteExists = blockedSites.some(siteObj => siteObj.url === normalizedSite);
  
  if (siteExists) {
    showError('This site is already in your blocked list.');
    input.value = '';
    return { success: false };
  }

  // Add as object with url and blockChildren properties
  const newSite = {
    url: normalizedSite,
    blockChildren: blockChildren
  };
  blockedSites.push(newSite);
  
  input.value = '';
  clearError();
  await setStorageData({ blockedSites });
  return { success: true, blockedSites };
}

// Remove a site from the blocked list by URL
export async function removeSiteByUrl(url, blockedSites) {
  const index = blockedSites.findIndex(siteObj => siteObj.url === url);
  if (index !== -1) {
    blockedSites.splice(index, 1);
    
    // Also remove from unlockedUntil if it exists
    try {
      const result = await getAllData();
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
        await setStorageData({ unlockedUntil });
      }
    } catch (error) {
      // Error cleaning up unlockedUntil, but continue with removal
    }
    
    await setStorageData({ blockedSites });
    return { success: true, blockedSites };
  }
  return { success: false, blockedSites };
}

// Add a time limit
export async function addTimeLimit(timeLimits, timeTracking, siteInputId = 'timeLimitSiteInput', minutesInputId = 'timeLimitMinutesInput') {
  const siteInput = document.getElementById(siteInputId);
  const minutesInput = document.getElementById(minutesInputId);
  const site = siteInput?.value.trim();
  const minutes = parseInt(minutesInput?.value.trim(), 10);

  if (!site) {
    showTimeLimitError('Please enter a site URL.');
    return { success: false };
  }

  if (!minutes || minutes < 1) {
    showTimeLimitError('Please enter a valid time limit (at least 1 minute).');
    return { success: false };
  }

  // Validate the URL/domain
  const validationResult = validateUrl(site);
  if (!validationResult.isValid) {
    showTimeLimitError(validationResult.error);
    return { success: false };
  }

  // Normalize the URL
  const normalizedSite = normalizeUrl(site);
  
  // Check if site already exists
  const siteExists = timeLimits.some(limitObj => limitObj.url === normalizedSite);
  
  if (siteExists) {
    showTimeLimitError('This site already has a time limit.');
    siteInput.value = '';
    minutesInput.value = '';
    return { success: false };
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
  await setStorageData({ timeLimits, timeTracking });
  return { success: true, timeLimits, timeTracking };
}

// Remove a time limit
export async function removeTimeLimit(url, timeLimits, timeTracking) {
  const index = timeLimits.findIndex(limitObj => limitObj.url === url);
  if (index !== -1) {
    timeLimits.splice(index, 1);
    
    // Also remove from timeTracking if it exists
    if (timeTracking[url]) {
      delete timeTracking[url];
    }
    
    await setStorageData({ timeLimits, timeTracking });
    return { success: true, timeLimits, timeTracking };
  }
  return { success: false, timeLimits, timeTracking };
}

