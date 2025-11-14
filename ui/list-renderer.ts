// Shared list rendering utilities for popup and standalone pages

import { escapeHtml } from '../utils/html-utils.js';
import { formatTime, getCurrentDateString, resetDailyTrackingIfNeeded } from '../utils/time-utils.js';
import type { BlockedSite, TimeLimit, TimeTracking } from '../types/index.js';

// Get remaining time for a site
function getRemainingTime(siteKey: string, limitMinutes: number, timeTracking: TimeTracking): number {
  resetDailyTrackingIfNeeded(timeTracking);
  
  const tracking = timeTracking[siteKey];
  if (!tracking || tracking.date !== getCurrentDateString()) {
    return limitMinutes * 60 * 1000; // Return limit in milliseconds
  }
  
  const limitMs = limitMinutes * 60 * 1000;
  const remaining = Math.max(0, limitMs - tracking.timeSpent);
  return remaining;
}

// Update fade overlays based on scroll position
export function updateFadeOverlays(listElement: HTMLElement | null, wrapperElement: HTMLElement | null): void {
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
export function renderBlockedList(blockedSites: BlockedSite[], listId: string, wrapperId: string): void {
  const list = document.getElementById(listId);
  const wrapper = document.getElementById(wrapperId);
  
  if (!list) return;
  
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

  list.innerHTML = sortedSites.map((siteObj) => {
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

  // Update fade overlays after rendering
  setTimeout(() => updateFadeOverlays(list, wrapper), 0);
  
  // Attach scroll listener if not already attached
  if (!list.dataset.fadeListenerAttached) {
    list.addEventListener('scroll', () => updateFadeOverlays(list, wrapper));
    list.dataset.fadeListenerAttached = 'true';
  }
}

// Render the time limits list
export function renderTimeLimitsList(timeLimits: TimeLimit[], timeTracking: TimeTracking, listId: string, wrapperId: string): void {
  const list = document.getElementById(listId);
  const wrapper = document.getElementById(wrapperId);
  
  if (!list) return;
  
  resetDailyTrackingIfNeeded(timeTracking);
  
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
    const remaining = getRemainingTime(site, limitMinutes, timeTracking);
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

  // Update fade overlays after rendering
  setTimeout(() => updateFadeOverlays(list, wrapper), 0);
  
  // Attach scroll listener if not already attached
  if (!list.dataset.fadeListenerAttached) {
    list.addEventListener('scroll', () => updateFadeOverlays(list, wrapper));
    list.dataset.fadeListenerAttached = 'true';
  }
}

