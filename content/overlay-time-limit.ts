// Show the time limit blocking overlay

import { getStorageData, getLocalData, setLocalData } from '../utils/storage-utils.js';
import { getCurrentDateString } from '../utils/time-utils.js';
import { showInteractiveOverlay } from './overlay-flow.js';
import type { TimeLimit, TimeTracking } from '../types/index.js';

export async function showTimeLimitOverlay(normalizedUrl: string, siteKey: string, limitMinutes: number): Promise<void> {
  void normalizedUrl;
  void limitMinutes;

  await showInteractiveOverlay({
    heading: 'You\'ve reached your time limit',
    subtitle: 'Time to step away and refocus.',
    continueButtonLabel: 'Add 5 more mins',
    reasonVisibleInitially: false,
    showMoreTimeButton: true,
    moreTimeButtonLabel: 'More Time',
    onContinue: async () => {
      try {
        const [localResult, syncResult] = await Promise.all([
          getLocalData(['timeTracking']),
          getStorageData(['timeLimits'])
        ]);
        const timeTracking = (localResult.timeTracking as TimeTracking) || {};
        const timeLimits = (syncResult.timeLimits as TimeLimit[]) || [];

        const limitObj = timeLimits.find(l => l.url === siteKey);
        const limitMs = limitObj ? limitObj.limitMinutes * 60 * 1000 : 0;

        if (timeTracking[siteKey]) {
          // Give user 5 more minutes by setting timeSpent so they have 5 minutes available
          const currentDate = getCurrentDateString();
          const fiveMinutesMs = 5 * 60 * 1000;

          if (timeTracking[siteKey].date !== currentDate) {
            // Reset for new day - start with 0 time spent
            timeTracking[siteKey] = {
              date: currentDate,
              timeSpent: 0,
              lastActive: Date.now()
            };
          } else {
            // Set timeSpent to (limit - 5 minutes) to give them 5 minutes available
            // If limit is less than 5 minutes, set to 0 to give them the full limit
            const newTimeSpent = Math.max(0, limitMs - fiveMinutesMs);
            timeTracking[siteKey].timeSpent = newTimeSpent;
            timeTracking[siteKey].lastActive = Date.now();
          }

          await setLocalData({ timeTracking });
        }

        // Reload the page to resume tracking
        window.location.reload();
      } catch (error) {
        // Extension context invalidated - just reload the page anyway
        const err = error as Error;
        if (err.message && err.message.includes('Extension context invalidated')) {
          window.location.reload();
        }
        // Other errors - ignore
      }
    }
  });
}
