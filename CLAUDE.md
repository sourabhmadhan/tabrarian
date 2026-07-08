# Tabrarian

Chrome MV3 extension that auto-organizes tabs into named, colored tab groups.
Plain JS, no build step — edit and reload at `chrome://extensions`.

**Full project context, architecture, design rationale, tuning knobs, and
regression scenarios: [.claude/CONTEXT.md](.claude/CONTEXT.md).** Read it
before making changes.

Hard constraints (also enforced by the privacy policy and store listing):
- Never close a tab automatically; only organize.
- Never touch user-created groups unless "Reorganize existing groups" is on.
- Zero network requests — no APIs, no telemetry, favicons via Chrome's
  local `_favicon` cache only.

Test logic changes with the Node harness pattern documented in
.claude/CONTEXT.md §8, then `node --check` every touched script.
