// Shared utility for updating the extension icon based on dark mode
const ICON_SIZES = [16, 32, 48, 96, 128, 256];

export async function updateExtensionIcon(isDarkMode: boolean): Promise<void> {
  const iconPaths: Record<number, string> = {};

  ICON_SIZES.forEach(size => {
    const relativePath = isDarkMode
      ? `icons/icon${size}-dark.png`
      : `icons/icon${size}.png`;
    iconPaths[size] = chrome.runtime.getURL(relativePath);
  });

  try {
    await chrome.action.setIcon({ path: iconPaths });
  } catch {
    // Dark mode icons may not exist — fall back to regular icons
    if (isDarkMode) {
      const fallbackPaths: Record<number, string> = {};
      ICON_SIZES.forEach(size => {
        fallbackPaths[size] = chrome.runtime.getURL(`icons/icon${size}.png`);
      });
      try {
        await chrome.action.setIcon({ path: fallbackPaths });
      } catch {
        // Silently fail if icon update fails
      }
    }
  }
}
