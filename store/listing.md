# Chrome Web Store listing — copy-paste material

## Summary (max 132 chars)

Tabrarian: auto-sort tabs into named, colored groups — by site, topic, or dev
workflow (AWS, localhost, Grafana). 100% local & private.

## Category

Productivity → Tools (or "Workflow & Planning")

## Description

Drowning in tabs you can't close because you might need them? This extension
organizes them instead — one click sorts every loose tab into Chrome's native
tab groups, named and colored. Nothing is ever closed automatically.

WHAT IT DOES
• One-click grouping into smart categories: Dev, Cloud, Monitoring, Docs,
  AI, Video, Social, Shopping, News, Email, Work, Finance, Learning,
  Reading, Travel, Government, Local
• ✦ Topics mode: clusters tabs by what their titles MEAN — a job hunt across
  LinkedIn, Glassdoor and Wellfound becomes one group. Runs entirely on your
  machine, no AI service, no account.
• Respects your existing groups — never dissolves what you built by hand.
  Loose tabs join matching groups you already have ("LC Trees" adopts new
  LeetCode tree problems).
• Interactive preview: search tabs, click to jump, drag tabs between groups
  before applying, close duplicates safely.
• Auto-group new tabs as they open (optional).
• Focus mode: switch tabs and the group you're in expands while the rest
  collapse — a self-maintaining tab strip (optional).
• Memory saver: tabs in collapsed groups you haven't used in 10+ minutes go
  to sleep and free their RAM — they stay in the strip and reload right
  where they were when clicked. Audio/video is never interrupted (optional).

BUILT FOR DEVELOPERS
• AWS/GCP console tabs split by service: "AWS EC2", "AWS CloudWatch",
  "GCP BigQuery"
• localhost apps grouped by port (Local :3000 vs Local :8080)
• Self-hosted internal tools recognized on any company domain: grafana.*,
  kibana.* → Monitoring; wiki.*, confluence.* → Docs; jenkins.*, gitlab.*,
  argocd.* → Dev; jira.* → Work
• Google Docs vs Sheets vs Slides split correctly; LeetCode problems grouped
  by topic (Trees, DP, Graphs...)

PRIVATE BY DESIGN
• Zero network requests — everything runs locally
• No data collected, stored, or transmitted. No account, no analytics.
• Minimal permissions, no content scripts injected into pages

## Single purpose description (for the review form)

Organizes the user's open tabs into named, colored Chrome tab groups.

## Permission justifications (for the Privacy tab in the dev console)

- tabs: Read tab titles and URLs to determine which group each tab belongs
  to. Required for the core (and only) function: organizing tabs.
- tabGroups: Create, name, color, and collapse Chrome tab groups. This is
  the extension's output mechanism.
- storage: Persist four user settings (auto-group, focus mode, reorganize
  toggle, grouping mode).
- favicon: Show tab icons in the popup preview from Chrome's local favicon
  cache, avoiding any network requests.
- alarms: Schedule the optional memory-saver sweep (every 5 minutes) that
  discards long-unused tabs in collapsed groups to free RAM. Runs entirely
  locally; only active when the user enables the Memory Saver toggle.

## Data usage disclosures (Privacy practices form)

- Does NOT collect any user data (check "no" on every category).
- Remote code: none.

## Assets checklist

- [x] Icons 16/48/128 (in /icons)
- [ ] Screenshots: 1–5 images, 1280×800 or 640×400 PNG (see README of this
      folder — take popup open over a messy tab strip, before/after shots)
- [ ] Optional: small promo tile 440×280
- [ ] Privacy policy hosted at a public URL (host store/PRIVACY.md on GitHub)
