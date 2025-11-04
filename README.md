# Keep Focus 🔒

A Chrome extension that helps you build better focus habits by blocking distracting websites with intentional friction. Inspired by James Clear's *Atomic Habits* principles.

## ✨ Features

- **Custom Block List**: Add full domains or specific URLs (e.g., `twitter.com` or `reddit.com/r/LivestreamFail/`)
- **Smart Blocking Screen**: When visiting a blocked site, the page is replaced with a minimal, focused overlay
- **Reflection Prompt**: You must type a reason before proceeding (e.g., "I'm checking something for work")
- **15-Second Timer**: Intentional delay before you can continue, making you pause and think
- **Temporary Unlock**: Once unblocked, the site stays accessible for 10 minutes before relocking
- **Focus Streak Counter**: Tracks how many times you resisted unblocking a site—positive reinforcement for saying "no"

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
3. Click "Add" or press Enter
4. The site will now be blocked when you try to visit it

### Removing Blocked Sites

1. Open the extension popup
2. Click the "Remove" button next to any site you want to unblock

### When You Visit a Blocked Site

1. The page is replaced with a focus overlay
2. You see your current focus streak (if you have one)
3. You must type a reason for visiting
4. Wait 15 seconds for the timer to count down
5. Once the timer reaches 0 and you've typed a reason, click "Continue"
6. The site unlocks for 10 minutes

### Building Your Focus Streak

- **Increment**: Your streak increases when you close the tab instead of unlocking
- **Reset**: Your streak resets to 0 when you unlock a site
- **Display**: Your current streak is shown both in the popup and on blocking screens

## 🏗️ Technical Details

### Storage

The extension uses `chrome.storage.sync` to store:
- `blockedSites`: Array of blocked domains/URLs
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

## 🔮 Future Ideas (v2)

- Daily summary dashboard: time saved, focus streaks, top distractions
- Integration with Notion or Google Calendar
- "Focus mode" toggle (one-click enable/disable)
- Whitelist timer (e.g., 5 minutes allowed every 2 hours)
- Optional "Focus Quotes" when you hit a block
- Analytics: Track your most visited blocked sites
- Customizable timer duration and unlock window

## 📝 Example User Flow

1. You try to open `twitter.com`
2. Page shows overlay: "You said you wanted to stay focused. Why are you here?"
3. You type: "Checking DMs for business"
4. Timer counts down: 15... 14... 13... (you wait)
5. Timer reaches 0 → "Continue" button unlocks
6. You click "Continue" → site unlocks for 10 minutes
7. After 10 minutes, the site blocks again
8. If you close the tab instead of unlocking, your focus streak increases! 🔥

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use and modify for your own purposes.

---

**Remember**: "Every action you take is a vote for the type of person you wish to become." — James Clear, *Atomic Habits*

