// URL normalization and validation utilities

import type { BlockedSite, TimeLimit, ValidationResult } from '../types/index.js';

// Normalize hostname by removing www. prefix for consistent matching
export function normalizeHostname(hostname: string): string {
  if (!hostname) return hostname;
  // Remove www. prefix if present (case-insensitive)
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return normalized;
}

// Normalize URL for consistent matching
export function normalizeUrl(url: string): string {
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

// Validate URL/domain input
export function validateUrl(url: string): ValidationResult {
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

// Check if a site is blocked
export function isSiteBlocked(normalizedUrl: string, blockedSites: BlockedSite[]): boolean {
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/');
  
  return blockedSites.some(blockedSiteObj => {
    const blockedSite = blockedSiteObj.url;
    const blockChildren = blockedSiteObj.blockChildren !== false;
    
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/');
    
    const normalizedCurrentHostname = normalizeHostname(currentHostname);
    const normalizedBlockedHostname = normalizeHostname(blockedHostname);
    
    const hostnameMatch = normalizedCurrentHostname === normalizedBlockedHostname;
    
    if (!hostnameMatch) {
      return false;
    }
    
    if (!blockedPath) {
      if (blockChildren) {
        return true;
      } else {
        const isExactDomain = !currentPath || currentPath === '';
        return isExactDomain;
      }
    }
    
    const normalizedBlockedSite = normalizedBlockedHostname + (blockedPath ? '/' + blockedPath : '');
    
    let pathMatch = false;
    if (blockChildren) {
      pathMatch = normalizedUrl === normalizedBlockedSite || 
             normalizedUrl.startsWith(normalizedBlockedSite + '/') ||
             currentPath === blockedPath ||
             currentPath.startsWith(blockedPath + '/');
    } else {
      pathMatch = normalizedUrl === normalizedBlockedSite || currentPath === blockedPath;
    }
    return pathMatch;
  });
}

// Get site key for storage
export function getSiteKey(normalizedUrl: string, blockedSites: BlockedSite[]): string {
  // Find the matching blocked site pattern
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/'); // Get path after hostname
  
  // Normalize current hostname (should already be normalized, but just in case)
  const normalizedCurrentHostname = normalizeHostname(currentHostname);
  
  for (const blockedSiteObj of blockedSites) {
    const blockedSite = blockedSiteObj.url;
    const blockChildren = blockedSiteObj.blockChildren !== false; // Default to true if undefined
    
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/'); // Get path after hostname
    
    // Normalize both hostnames for comparison (remove www. prefix)
    const normalizedBlockedHostname = normalizeHostname(blockedHostname);
    
    // Check if normalized hostnames match
    const hostnameMatch = normalizedCurrentHostname === normalizedBlockedHostname;
    
    if (!hostnameMatch) {
      continue; // Different domain, skip
    }
    
    // If blocked site has no path (domain-only block), match
    if (!blockedPath) {
      return blockedSite;
    }
    
    // Normalize blocked site for comparison
    const normalizedBlockedSite = normalizedBlockedHostname + (blockedPath ? '/' + blockedPath : '');
    
    // If blockChildren is true, match exact and subpaths
    // If blockChildren is false, only match exact
    if (blockChildren) {
      if (normalizedUrl === normalizedBlockedSite || 
          normalizedUrl.startsWith(normalizedBlockedSite + '/') ||
          currentPath === blockedPath ||
          currentPath.startsWith(blockedPath + '/')) {
        return blockedSite;
      }
    } else {
      // Only exact match
      if (normalizedUrl === normalizedBlockedSite || currentPath === blockedPath) {
        return blockedSite;
      }
    }
  }
  return normalizedCurrentHostname; // Return normalized domain as fallback
}

// Get site key for time limits (similar to getSiteKey but for time limits)
export function getTimeLimitSiteKey(normalizedUrl: string, timeLimits: TimeLimit[]): string | null {
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/');
  
  const normalizedCurrentHostname = normalizeHostname(currentHostname);
  
  for (const limitObj of timeLimits) {
    const limitUrl = limitObj.url;
    const limitParts = limitUrl.split('/');
    const limitHostname = limitParts[0];
    const limitPath = limitParts.slice(1).join('/');
    
    const normalizedLimitHostname = normalizeHostname(limitHostname);
    
    // Check if hostnames match
    if (normalizedCurrentHostname !== normalizedLimitHostname) {
      continue;
    }
    
    // If limit has no path, match all paths
    if (!limitPath) {
      return limitUrl;
    }
    
    // Check path match
    if (normalizedUrl === limitUrl || 
        normalizedUrl.startsWith(limitUrl + '/') ||
        currentPath === limitPath ||
        currentPath.startsWith(limitPath + '/')) {
      return limitUrl;
    }
  }
  
  return null;
}

// Check if site has a time limit
export function hasTimeLimit(normalizedUrl: string, timeLimits: TimeLimit[]): boolean {
  return getTimeLimitSiteKey(normalizedUrl, timeLimits) !== null;
}

