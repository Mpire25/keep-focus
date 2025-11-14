// Time formatting and date utilities

import type { TimeTracking } from '../types/index.js';

// Get current date string (YYYY-MM-DD)
export function getCurrentDateString(): string {
  const now = new Date();
  // Use local date instead of UTC so reset happens at local midnight
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format time in milliseconds to readable format
export function formatTime(ms: number): string {
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

// Reset daily tracking if date has changed
export function resetDailyTrackingIfNeeded(timeTracking: TimeTracking): boolean {
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
  
  return updated;
}

