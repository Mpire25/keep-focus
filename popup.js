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
    console.error('Error loading data:', error);
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
    console.error('Error saving data:', error);
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

  list.innerHTML = blockedSites.map((site, index) => `
    <li class="blocked-item">
      <span class="site-url">${escapeHtml(site)}</span>
      <button class="btn-remove" data-index="${index}">Remove</button>
    </li>
  `).join('');

  // Add event listeners to remove buttons
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeSite(index);
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
  const site = input.value.trim().toLowerCase();

  if (!site) {
    return;
  }

  // Normalize the URL (remove protocol, trailing slashes, etc.)
  const normalizedSite = normalizeUrl(site);
  
  if (blockedSites.includes(normalizedSite)) {
    input.value = '';
    return;
  }

  blockedSites.push(normalizedSite);
  input.value = '';
  await saveData();
  renderBlockedList();
}

// Remove a site from the blocked list
async function removeSite(index) {
  blockedSites.splice(index, 1);
  await saveData();
  renderBlockedList();
}

// Normalize URL for consistent matching
function normalizeUrl(url) {
  // Remove protocol
  url = url.replace(/^https?:\/\//, '');
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  // Remove www prefix (optional - you might want to keep this)
  // url = url.replace(/^www\./, '');
  // Convert to lowercase for case-insensitive matching
  return url.toLowerCase();
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

  document.getElementById('addBtn').addEventListener('click', addSite);
  
  document.getElementById('siteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite();
    }
  });
});

