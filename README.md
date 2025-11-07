# Keep Focus 🔒

I kept finding myself getting sidetracked and distracted by specific websites so I made a Chrome extention to help me build better habits using the principles from James Clear's *Atomic Habits*.

The rest of the description is AI generated.

## ✨ Features

- **Custom Block List**: Add full domains or specific URLs (e.g., `twitter.com` or `reddit.com/r/LivestreamFail/`)
- **Flexible Blocking Options**: Choose to block all subpages or just the specific page when adding a site
- **Smart Blocking Screen**: When visiting a blocked site, the page is replaced with a minimal, focused overlay
- **Reflection Prompt**: You must type a reason before proceeding (e.g., "I'm checking something for work")
- **15-Second Timer**: Intentional delay before you can continue (runs in background after reason submission, showing inspirational quotes)
- **Temporary Unlock**: Once unblocked, the site stays accessible for 10 minutes before relocking
- **Focus Streak Counter**: Tracks how many times you resisted unblocking a site—positive reinforcement for saying "no"
- **Close Tab Button**: Easy one-click option to close the tab and stay focused

## 🎯 Behavioral Design (Atomic Habits Principles)

| Principle | Implementation |
|-----------|---------------|
| **Make it Invisible** | Blocked site content is completely hidden behind overlay |
| **Make it Difficult** | Reflection prompt + 15-second timer adds friction |
| **Make it Unattractive** | Shows your focus streak to reinforce good behavior |
| **Make it Satisfying** | Streak counter provides positive reinforcement |

## 🚀 Installation

### Load as Unpacked Extension

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `keep-focus` folder
6. The extension icon should appear in your toolbar

**Note**: You'll need to add icon files (`icon16.png`, `icon48.png`, `icon128.png`) for the extension to work properly. Place them in the root directory.

## 📖 Usage

### Adding Blocked Sites

1. Click the Keep Focus extension icon in your toolbar
2. Enter a domain or URL in the input field (e.g., `twitter.com`, `youtube.com`, `reddit.com/r/all`)
3. Choose your blocking preference:
   - **Block all subpages** (checked by default): Blocks the entire domain and all subpages
   - **Block this page only**: Blocks only the exact URL you specified
4. Click "Add" or press Enter
5. The site will now be blocked when you try to visit it

### Removing Blocked Sites

1. Open the extension popup
2. Click the "Remove" button next to any site you want to unblock

### When You Visit a Blocked Site

1. The page is replaced with a focus overlay
2. You see your current focus streak (if you have one)
3. You must type a reason for visiting and click "Submit Reason"
4. After submitting, you'll see an inspirational quote while a 15-second timer runs in the background
5. Once the timer reaches 0, the "Continue" button becomes enabled
6. Click "Continue" to unlock the site for 10 minutes
7. Alternatively, click "Stay Focused - Close Tab" at the bottom to close the tab and increase your focus streak

### Building Your Focus Streak

- **Increment**: Your streak increases when you close the tab instead of unlocking (using the "Stay Focused - Close Tab" button or closing the tab manually)
- **Reset**: Your streak resets to 0 when you unlock a site
- **Display**: Your current streak is shown both in the popup and on blocking screens

## 🏗️ Technical Details

### Storage

The extension uses `chrome.storage.sync` to store:
- `blockedSites`: Array of objects with `{url, blockChildren}` properties (where `blockChildren` determines if subpages are blocked)
- `unlockedUntil`: Object mapping site keys to unlock timestamps
- `focusStreak`: Current focus streak count

This allows your settings to sync across Chrome installations.

### File Structure

```
keep-focus/
├── manifest.json       # Extension manifest
├── popup.html          # Popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic
├── content.js          # Content script that blocks sites
├── icon16.png          # Extension icon (16x16)
├── icon48.png          # Extension icon (48x48)
├── icon128.png         # Extension icon (128x128)
└── README.md           # This file
```

## 🎨 Design Philosophy

The extension follows Atomic Habits principles:

- **Clear messaging**: "You said you wanted to focus" reminds you of your intention
- **Minimal friction**: Just enough delay to make you think, not so much that it's frustrating
- **Positive reinforcement**: Streak counter celebrates your wins
- **Reflection**: Requiring a reason makes you conscious of your choices

## 📝 Example User Flow

1. You try to open `twitter.com`
2. Page shows overlay: "You said you wanted to focus. Why are you visiting this site?"
3. You type: "Checking DMs for business" and click "Submit Reason"
4. The interface switches to show an inspirational quote while a 15-second timer runs in the background
5. Timer reaches 0 → "Continue" button becomes enabled
6. You have two options:
   - Click "Continue" → site unlocks for 10 minutes (streak resets to 0)
   - Click "Stay Focused - Close Tab" → tab closes and your focus streak increases! 🔥
7. After 10 minutes (if unlocked), the site blocks again

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use and modify for your own purposes.

---

**Remember**: "Every action you take is a vote for the type of person you wish to become." — James Clear, *Atomic Habits*

