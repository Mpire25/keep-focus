// Show the blocking overlay

import { getLocalData, setLocalData } from '../utils/storage-utils.js';
import { showInteractiveOverlay } from './overlay-flow.js';

const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes

export async function showBlockOverlay(normalizedUrl: string, siteKey: string): Promise<void> {
  void normalizedUrl;

  await showInteractiveOverlay({
    heading: 'You said you wanted to focus.',
    subtitle: 'Why are you visiting this site?',
    continueButtonLabel: 'Continue',
    reasonVisibleInitially: true,
    showMoreTimeButton: false,
    onContinue: async () => {
      try {
        const result = await getLocalData(['unlockedUntil']);
        const unlockedUntil = (result.unlockedUntil as Record<string, number>) || {};
        unlockedUntil[siteKey] = Date.now() + UNLOCK_DURATION;

        await setLocalData({ unlockedUntil });

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
