# Keep Focus 🔒

I kept finding myself getting sidetracked and distracted by specific websites so I made a Chrome extention to help me build better habits using the principles from James Clear's *Atomic Habits*.

The rest of the description is AI generated.

## ✨ Features

### Blocking Sites
- **Custom Block List**: Add full domains or specific URLs (e.g., `twitter.com` or `reddit.com/r/LivestreamFail/`)
- **Flexible Blocking Options**: Choose to block all subpages or just the specific page when adding a site
- **Smart Blocking Screen**: When visiting a blocked site, the page is replaced with a minimal, focused overlay
- **Media Pausing**: All videos and audio are automatically paused when a blocked site is shown
- **SPA Support**: Works with Single Page Applications (SPAs) by detecting URL changes

### Time Limits (Screen Limits)
- **Daily Time Limits**: Set daily time limits for sites (e.g., 30 minutes per day on YouTube)
- **Automatic Tracking**: Time spent on sites is automatically tracked and resets daily at local midnight
- **Time Limit Overlay**: When your daily limit is reached, a special overlay appears with an option to request 5 more minutes
- **Real-time Progress**: See how much time you have remaining for each site in the popup

### Unlocking & Friction
- **Reflection Prompt**: You must type a reason before proceeding (e.g., "I'm checking something for work")
- **Random Timer**: Intentional delay (15-30 seconds, randomized) before you can continue (runs in background after reason submission, showing inspirational quotes)
- **Temporary Unlock**: Once unblocked, the site stays accessible for 10 minutes before relocking
- **Close Tab Button**: Easy one-click option that redirects to Google homepage and increases your focus streak

### Focus Streak
- **Focus Streak Counter**: Tracks how many times you resisted unblocking a site—positive reinforcement for saying "no"
- **Smart Increment**: Streak increases when you close the tab instead of unlocking (detects when you haven't unlocked recently)
- **Reset on Unlock**: Your streak resets to 0 when you unlock a site

### Appearance
- **Dark Mode**: Toggle between light and dark themes for the popup and blocking overlays
- **Dynamic Icon**: Extension icon automatically updates to match your dark mode preference
- **Standalone Full-Page Interface**: Access a spacious, full-page management interface with sidebar navigation from the popup

## 🎯 Behavioral Design (Atomic Habits Principles)

| Principle | Implementation |
|-----------|---------------|
| **Make it Invisible** | Blocked site content is completely hidden behind overlay; media is paused |
| **Make it Difficult** | Reflection prompt + random 15-30 second timer adds friction |
| **Make it Unattractive** | Shows your focus streak to reinforce good behavior |
| **Make it Satisfying** | Streak counter provides positive reinforcement; daily time limits help you stay within healthy boundaries |

## 🚀 Installation

### Load as Unpacked Extension

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `keep-focus` folder
6. The extension icon should appear in your toolbar

## 📖 Usage

### Adding Blocked Sites

**Via Popup:**
1. Click the Keep Focus extension icon in your toolbar
2. Make sure you're on the **"Blocked Sites"** tab
3. Enter a domain or URL in the input field (e.g., `twitter.com`, `youtube.com`, `reddit.com/r/all`)
4. Choose your blocking preference:
   - **Block all subpages** (checked by default): Blocks the entire domain and all subpages
   - **Block this page only**: Blocks only the exact URL you specified
5. Click "Add" or press Enter
6. The site will now be blocked when you try to visit it

**Via Standalone Page:**
1. Click the Keep Focus extension icon in your toolbar
2. Click the external link button (↗) in the top right corner to open the standalone page
3. Use the sidebar to navigate to **"Blocked Sites"** (or it may already be selected)
4. Follow the same steps as above

### Adding Time Limits (Screen Limits)

**Via Popup:**
1. Click the Keep Focus extension icon in your toolbar
2. Switch to the **"Screen Limits"** tab
3. Enter a domain or URL in the first input field
4. Enter the number of minutes you want to allow per day in the second input field
5. Click "Add" or press Enter
6. The extension will track your time spent on that site and block it once you reach your daily limit

**Via Standalone Page:**
1. Click the Keep Focus extension icon in your toolbar
2. Click the external link button (↗) in the top right corner to open the standalone page
3. Use the sidebar to navigate to **"Screen Limits"**
4. Follow the same steps as above

### Removing Sites

**Via Popup:**
1. Open the extension popup
2. Click the "Remove" button next to any blocked site or time limit you want to remove

**Via Standalone Page:**
1. Open the standalone page (click the external link button ↗ in the popup)
2. Navigate to the appropriate tab (Blocked Sites or Screen Limits)
3. Click the "Remove" button next to any blocked site or time limit you want to remove

### When You Visit a Blocked Site

1. The page is replaced with a focus overlay (all media is paused)
2. You see your current focus streak (if you have one)
3. You must type a reason for visiting and click "Submit Reason"
4. After submitting, you'll see an inspirational quote while a random 15-30 second timer runs in the background
5. Once the timer reaches 0, the "Continue" button becomes enabled
6. Click "Continue" to unlock the site for 10 minutes
7. Alternatively, click "Close Tab" to redirect to Google homepage and increase your focus streak

### When You Reach a Time Limit

1. The page is replaced with a time limit overlay
2. You see: "You've reached your time limit. Time to step away and refocus."
3. Click "More Time" if you need additional time
4. Type a reason for needing more time and click "Submit Reason"
5. After submitting, you'll see an inspirational quote while a random 15-30 second timer runs in the background
6. Once the timer reaches 0, the "Add 5 more mins" button becomes enabled
7. Click "Add 5 more mins" to get 5 additional minutes (or click "Close Tab" to redirect to Google)

### Building Your Focus Streak

- **Increment**: Your streak increases when you close the tab instead of unlocking (detected when you haven't unlocked a site recently—outside the 10-minute unlock window plus a 1-hour threshold)
- **Reset**: Your streak resets to 0 when you unlock a site
- **Display**: Your current streak is shown on blocking screens

### Dark Mode

1. Open the extension popup
2. Click the external link button (↗) in the top right corner to open the standalone page
3. Navigate to the **"Settings"** tab
4. Toggle the "Dark Mode" switch
5. The popup, standalone page, extension icon, and all blocking overlays will switch between light and dark themes

**Note**: You can also access the standalone page directly from the popup using the external link button (↗) for a more spacious interface with sidebar navigation.

## 🏗️ Technical Details

### Storage

The extension uses `chrome.storage.sync` to store:
- `blockedSites`: Array of objects with `{url, blockChildren}` properties (where `blockChildren` determines if subpages are blocked)
- `unlockedUntil`: Object mapping site keys to unlock timestamps
- `focusStreak`: Current focus streak count
- `timeLimits`: Array of objects with `{url, limitMinutes}` properties for daily time limits
- `timeTracking`: Object mapping site keys to tracking data with `{date, timeSpent, lastActive}` properties (resets daily at local midnight)
- `darkMode`: Boolean indicating dark mode preference

This allows your settings to sync across Chrome installations.

### File Structure

```
keep-focus/
├── manifest.json       # Extension manifest
├── scripts/
│   ├── background.js      # Background service worker (handles icon updates)
│   ├── content.js          # Content script that blocks sites
│   ├── popup.js            # Popup logic
│   ├── standalone.js       # Standalone page logic
│   └── dark-mode-init.js   # Dark mode initialization script
├── pages/
│   ├── popup.html          # Popup UI
│   └── standalone.html     # Standalone full-page interface
├── styles/
│   ├── shared.css          # Shared styles between popup and standalone
│   ├── popup.css           # Popup styles
│   └── standalone.css      # Standalone page styles
├── icons/
│   ├── icon16.png          # Extension icon (16x16, light mode)
│   ├── icon16-dark.png     # Extension icon (16x16, dark mode)
│   ├── icon32.png          # Extension icon (32x32, light mode)
│   ├── icon32-dark.png     # Extension icon (32x32, dark mode)
│   ├── icon48.png          # Extension icon (48x48, light mode)
│   ├── icon48-dark.png     # Extension icon (48x48, dark mode)
│   ├── icon96.png          # Extension icon (96x96, light mode)
│   ├── icon96-dark.png     # Extension icon (96x96, dark mode)
│   ├── icon128.png         # Extension icon (128x128, light mode)
│   ├── icon128-dark.png    # Extension icon (128x128, dark mode)
│   ├── icon256.png         # Extension icon (256x256, light mode)
│   └── icon256-dark.png    # Extension icon (256x256, dark mode)
└── README.md           # This file
```

## 🎨 Design Philosophy

The extension follows Atomic Habits principles:

- **Clear messaging**: "You said you wanted to focus" reminds you of your intention
- **Minimal friction**: Just enough delay (randomized timer) to make you think, not so much that it's frustrating
- **Positive reinforcement**: Streak counter celebrates your wins
- **Reflection**: Requiring a reason makes you conscious of your choices
- **Boundaries, not bans**: Time limits allow controlled access rather than complete blocking, helping build sustainable habits
- **Media awareness**: Automatically pausing videos/audio prevents passive consumption during blocked periods

## 📝 Example User Flows

### Blocked Site Flow

1. You try to open `twitter.com`
2. Page shows overlay: "You said you wanted to focus. Why are you visiting this site?"
3. All videos/audio on the page are paused
4. You type: "Checking DMs for business" and click "Submit Reason"
5. The interface switches to show an inspirational quote while a random 15-30 second timer runs in the background
6. Timer reaches 0 → "Continue" button becomes enabled
7. You have two options:
   - Click "Continue" → site unlocks for 10 minutes (streak resets to 0)
   - Click "Close Tab" → redirects to Google homepage and your focus streak increases! 🔥
8. After 10 minutes (if unlocked), the site blocks again

### Time Limit Flow

1. You've set a 30-minute daily limit for `youtube.com`
2. You've been watching videos for 30 minutes today
3. Page shows overlay: "You've reached your time limit. Time to step away and refocus."
4. You click "More Time" and type: "Finishing a tutorial" and click "Submit Reason"
5. The interface switches to show an inspirational quote while a random 15-30 second timer runs in the background
6. Timer reaches 0 → "Add 5 more mins" button becomes enabled
7. You click "Add 5 more mins" → you get 5 additional minutes of viewing time
8. After using those 5 minutes, the site blocks again until tomorrow (when the daily limit resets)

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use and modify for your own purposes.

---

**Remember**: "Every action you take is a vote for the type of person you wish to become." — James Clear, *Atomic Habits*

