# Tabrarian — Auto Tab Grouper

A Chrome extension that automatically aggregates your open tabs into named,
colored tab groups by topic — so you can keep everything open without the
chaos. Nothing is ever closed automatically; tabs are only *organized*.

## Features

- **One-click grouping** — sorts every tab in the window into Chrome's native
  tab groups: Dev, AI, YouTube, Streaming, Social, Shopping, News, Email, Work, Finance,
  Learning, Music, Reading, Travel, Government (any `.gov` / `.gov.in` /
  `.gov.uk`-style domain; universities via `.edu` / `.ac.in` land in Learning).
- **Path-aware splitting** — Google Docs, Sheets, Slides and Forms all live on
  `docs.google.com`, so the splitter reads the URL path: a window full of
  spreadsheets and documents becomes separate "Google Sheets" and
  "Google Docs" groups. Same for Jira vs Confluence on `*.atlassian.net`,
  and for AWS/GCP console services: heavy console use splits into
  "AWS EC2", "AWS CloudWatch", "GCP BigQuery", etc.
- **Built for dev workflows** — `localhost` apps group by port (`Local :3000`
  vs `Local :8080` are different apps); self-hosted internal tools are
  recognized by hostname on *any* company domain: `grafana.*`/`kibana.*` →
  Monitoring, `wiki.*`/`confluence.*`/`docs.*` → Docs, `jenkins.*`/
  `gitlab.*`/`argocd.*` → Dev, `jira.*` → Work. Private-network hosts
  (10.x, 192.168.x, `*.internal`) count as Local.
- **Smart fallback** — tabs that don't match a category are clustered by
  website (2+ tabs from the same site become their own group); true one-offs
  go into "Other".
- **Granular splitting** — if one site dominates a category (4+ tabs), it
  breaks out into its own group (e.g. "LinkedIn" out of Social). Coding
  problem sites (LeetCode, HackerRank, GeeksForGeeks...) with 8+ tabs get
  sub-split by topic: "LeetCode · Trees", "LeetCode · DP", "LeetCode · Graphs".
- **Reading detection** — lone blog posts and articles are recognized by URL
  shape (`/blog/`, `/post/`, dates in the path) and grouped under "Reading"
  instead of drowning in "Other".
- **Auto-group mode** — optional toggle that files new tabs into the right
  group the moment they finish loading.
- **Focus mode** — optional toggle: when you switch tabs, the group you're
  working in expands and every other group collapses, keeping the tab strip
  readable all day without touching the popup.
- **Memory saver** — optional toggle: tabs in collapsed groups unused for
  10+ minutes are put to sleep (Chrome's tab discarding), freeing their RAM.
  They stay in the tab strip with title and favicon, and reload exactly
  where they were when clicked. Playing audio/video and sites that opt out
  of discarding are never touched. Sleeping tabs show dimmed in the popup
  with a "💤 N tabs sleeping" counter.
- **Respects your existing groups** — by default only loose (ungrouped) tabs
  are organized; groups you created by hand are never touched or dissolved.
  Loose tabs matching an existing group's name join it instead of spawning a
  duplicate. Tick "Also reorganize tabs already in groups" for a full
  reshuffle.
- **Duplicate detection** — finds tabs with the exact same URL and lets you
  close just the extra copies (your active tab is never closed).
- **Collapse / Ungroup** — collapse all groups to shrink your tab strip, or
  undo all grouping with one click. Pinned tabs are always left untouched.
- **Interactive preview** — the popup shows exactly how tabs will be grouped
  before you commit. Click a tab to jump to it, hover for a quick-close ×,
  search across titles and URLs, apply a single group with its Group/Join
  button, and collapse/expand groups.
- **Drag and drop** — disagree with a suggestion? Drag any tab onto a
  different group in the preview; "Group tabs now" applies exactly what you
  see. "Reset moves" undoes your manual moves.
- **✦ Topics mode** — semantic grouping that clusters tabs by what their
  titles *mean*, across sites: a job hunt spanning LinkedIn, Glassdoor and
  Wellfound becomes one "Job · Software" group; recipes from three different
  cooking sites become one group. 100% local (TF-IDF + agglomerative
  clustering in [smartgroup.js](smartgroup.js)) — no API keys, no network
  calls, nothing leaves your machine. Tabs that don't cluster fall back to
  the rules engine.
- **Light & dark theme** — follows your system appearance.

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this folder
4. Pin "Tabrarian" from the puzzle-piece menu, then click it and hit
   **Group tabs now**

Works in any Chromium browser with tab-group support (Chrome, Edge, Brave).

## Privacy & security

- **No network requests, ever.** Categorization, topic clustering, and even
  favicons (served from Chrome's local `_favicon` cache) are fully local.
- **No data stored** beyond five settings flags in `chrome.storage.sync`;
  tab URLs/titles are read transiently and never persisted or transmitted.
- **Minimal permissions**: `tabs`, `tabGroups`, `storage`, `favicon`,
  `alarms`. No host permissions, no content scripts, no remote code, and no
  `externally_connectable` surface (web pages cannot message the extension).
- All dynamic UI content is rendered with `textContent` — page-controlled
  strings (tab titles) cannot inject HTML.

## Customizing categories

All rules live in [categorizer.js](categorizer.js) — each category is a name,
a Chrome group color, a list of domains, and optional title keywords. Add your
own domains or whole new categories there; no build step needed, just reload
the extension.
