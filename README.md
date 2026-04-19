# Keep Focus

I kept finding myself getting sidetracked and distracted by specific websites so I made a Chrome extension to help me build better habits using the principles from James Clear's *Atomic Habits*. It is simple and not everything will work 100% but it does what I need it to do.

---

A Chrome extension that blocks distracting websites and enforces daily time limits. Built around the idea that friction and reflection — not bans — build better habits.

## Features

- **Block sites**: Add domains or specific URLs to a block list
- **Time limits**: Set a daily minute allowance per site (e.g., 30 min/day on YouTube)
- **Friction on unlock**: Must type a reason + wait a randomized 15–30 second timer before accessing a blocked site
- **Temporary access**: Unlocked sites stay open for 10 minutes, then relock
- **YouTube element blocking**: Toggle off Shorts, suggested videos, ads, comments, or enable minimal mode (all at once)
- **Screen Time tracking**: Apple-style dashboard showing a 7-day bar chart, daily total, daily average, and a Most Used list with favicons and per-site comparison to the previous day
- **Dark mode**

## Installation

1. Clone the repo
2. `bun install && bun run build`
3. Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `keep-focus` folder

Run `bun run watch` during development to auto-rebuild on file changes.

## Usage

Open the extension popup to add blocked sites or time limits. Use the external link button (↗) to open the full-page interface.

When adding a site, choose to block the entire domain or just a specific URL (e.g. block `reddit.com/r/all` without blocking all of Reddit).

When you hit a blocked site or time limit, type a reason and wait out the timer. You can continue or close the tab.

## Development

```
bun run build       # compile TypeScript to dist/
bun run watch       # auto-rebuild on changes
bun run type-check  # type check only
```

After rebuilding, reload the extension in `chrome://extensions/`.

## License

MIT
