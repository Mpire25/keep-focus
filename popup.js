// Popup UI for managing blocked sites

let blockedSites = [];
let focusStreak = 0;

// Load data from storage
async function loadData() {
  try {
    const result = await chrome.storage.sync.get(['blockedSites', 'focusStreak']);
    blockedSites = result.blockedSites || [];
    focusStreak = result.focusStreak || 0;
    renderBlockedList();
    updateStreakDisplay();
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

// Render the blocked sites list
function renderBlockedList() {
  const list = document.getElementById('blockedList');
  
  if (blockedSites.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No blocked sites yet.<br>Add a site to get started!</p>
      </div>
    `;
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
}

// Update streak display
function updateStreakDisplay() {
  const streakSection = document.getElementById('streakSection');
  const streakCount = document.getElementById('streakCount');
  
  if (focusStreak > 0) {
    streakSection.style.display = 'block';
    streakCount.textContent = focusStreak;
  } else {
    streakSection.style.display = 'none';
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

// Remove a site from the blocked list
async function removeSite(index) {
  blockedSites.splice(index, 1);
  await saveData();
  renderBlockedList();
}

// Remove a site from the blocked list by URL
async function removeSiteByUrl(url) {
  const index = blockedSites.findIndex(siteObj => siteObj.url === url);
  if (index !== -1) {
    blockedSites.splice(index, 1);
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

// Normalize URL for consistent matching
function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove protocol (http://, https://)
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Remove www. prefix (case-insensitive)
  normalized = normalized.replace(/^www\./i, '');
  
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
    const hostname = urlObj.hostname.replace(/^www\./i, '');
    const pathname = urlObj.pathname.replace(/\/$/, '');
    normalized = hostname.toLowerCase() + pathname.toLowerCase();
  } catch (e) {
    // If parsing fails, just clean up what we can
    // Split by / to separate domain from path
    const parts = normalized.split('/');
    const domain = parts[0].replace(/^www\./i, '').toLowerCase();
    const path = parts.slice(1).join('/').toLowerCase();
    normalized = domain + (path ? '/' + path : '');
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  const siteInput = document.getElementById('siteInput');
  
  document.getElementById('addBtn').addEventListener('click', addSite);
  
  siteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite();
    }
  });
  
  // Clear error when user starts typing
  siteInput.addEventListener('input', () => {
    clearError();
  });
});

