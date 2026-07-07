let currentWindowId = null;
let searchQuery = "";
let groupingMode = "rules"; // "rules" | "topics"

// Per-group display state: "preview" (first 5), "full", or "collapsed".
const groupState = new Map();

// Manual drag-and-drop moves: tabId -> { name, color } of the target group.
// Applied on top of the computed grouping, and honored by "Group tabs now".
const overrides = new Map();

function includeGrouped() {
  return document.getElementById("regroup-toggle").checked;
}

function send(action, extra = {}) {
  return chrome.runtime.sendMessage({
    action,
    windowId: currentWindowId,
    includeGrouped: includeGrouped(),
    ...extra
  });
}

function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.classList.remove("flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("flash");
}

// Icons come from Chrome's local favicon cache (the _favicon API), never
// from the network — a page-controlled favIconUrl could otherwise make the
// popup fire requests to arbitrary third-party servers.
function faviconUrl(tab) {
  const base = chrome.runtime.getURL("/_favicon/");
  return `${base}?pageUrl=${encodeURIComponent(tab.url || "")}&size=16`;
}

function jumpToTab(tab) {
  chrome.tabs.update(tab.id, { active: true });
  chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

async function getPreviewTabs() {
  const allTabs = await chrome.tabs.query({ windowId: currentWindowId, pinned: false });
  const tabs = includeGrouped()
    ? allTabs
    : allTabs.filter((t) => t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);
  return { allTabs, tabs };
}

// Moves dragged tabs from their computed group into their chosen one.
function applyOverrides(groups) {
  for (const [tabId, target] of overrides) {
    let moved = null;
    for (const [, group] of groups) {
      const idx = group.tabs.findIndex((t) => t.id === tabId);
      if (idx !== -1) {
        moved = group.tabs.splice(idx, 1)[0];
        break;
      }
    }
    if (!moved) {
      overrides.delete(tabId); // tab was closed or grouped meanwhile
      continue;
    }
    if (!groups.has(target.name)) {
      groups.set(target.name, { color: target.color, tabs: [] });
    }
    groups.get(target.name).tabs.push(moved);
  }
  for (const [name, group] of groups) {
    if (group.tabs.length === 0) groups.delete(name);
  }
}

function computeGroups(tabs) {
  const groups = groupingMode === "topics"
    ? SmartGroup.buildTopicGroups(tabs)
    : Tabrarian.buildGroups(tabs);
  applyOverrides(groups);
  return groups;
}

function setMode(mode) {
  groupingMode = mode;
  overrides.clear(); // moves reference group names from the other mode
  document.getElementById("mode-rules").classList.toggle("active", mode === "rules");
  document.getElementById("mode-topics").classList.toggle("active", mode === "topics");
  chrome.storage.sync.set({ groupingMode: mode });
  renderPreview();
}

function matchesSearch(tab) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return (tab.title || "").toLowerCase().includes(q)
    || (tab.url || "").toLowerCase().includes(q);
}

function makeTabRow(tab) {
  const row = document.createElement("div");
  row.className = "group-tab" + (tab.discarded ? " asleep" : "");
  row.title = tab.discarded ? `${tab.url} (sleeping)` : tab.url;
  row.draggable = true;

  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", String(tab.id));
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const img = document.createElement("img");
  img.src = faviconUrl(tab);
  row.appendChild(img);

  const label = document.createElement("span");
  label.className = "tab-title";
  label.textContent = tab.title || tab.url;
  row.appendChild(label);

  const close = document.createElement("button");
  close.className = "tab-close";
  close.textContent = "×";
  close.title = "Close this tab";
  close.addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.tabs.remove(tab.id);
    renderPreview();
  });
  row.appendChild(close);

  row.addEventListener("click", () => jumpToTab(tab));
  return row;
}

function makeGroupEl(name, color, groupTabs, existingGroups) {
  const state = searchQuery ? "full" : (groupState.get(name) || "preview");

  const el = document.createElement("div");
  el.className = "group";
  el.style.setProperty("--group-color", `var(--tg-${color})`);

  // Drop target for drag-and-drop moves.
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove("drag-over");
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("drag-over");
    const tabId = Number(e.dataTransfer.getData("text/plain"));
    if (!tabId) return;
    overrides.set(tabId, { name, color });
    setStatus(`Moved to “${name}” — apply when ready`);
    renderPreview();
  });

  const header = document.createElement("div");
  header.className = "group-header";

  const chevron = document.createElement("span");
  chevron.className = "chevron" + (state === "collapsed" ? " closed" : "");
  chevron.textContent = "▾";
  header.appendChild(chevron);

  const title = document.createElement("span");
  title.className = "group-name";
  title.textContent = name;
  header.appendChild(title);

  const existing = Tabrarian.findMatchingGroup(name, existingGroups);
  if (existing && existing.title) {
    const hint = document.createElement("span");
    hint.className = "join-hint";
    hint.textContent = `→ “${existing.title}”`;
    header.appendChild(hint);
  }

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = groupTabs.length;
  header.appendChild(count);

  const apply = document.createElement("button");
  apply.className = "apply-btn";
  apply.textContent = existing ? "Join" : "Group";
  apply.title = existing
    ? `Move these tabs into “${existing.title}”`
    : "Create just this group";
  apply.addEventListener("click", async (e) => {
    e.stopPropagation();
    const tabIds = groupTabs.map((t) => t.id);
    const res = await send("groupOne", { name, color, tabIds });
    for (const id of tabIds) overrides.delete(id);
    setStatus(res.error ? `Error: ${res.error}` : `Grouped ${tabIds.length} tabs into “${res.title}” ✓`);
    renderPreview();
  });
  header.appendChild(apply);

  header.addEventListener("click", () => {
    groupState.set(name, state === "collapsed" ? "preview" : "collapsed");
    renderPreview();
  });
  el.appendChild(header);

  if (state !== "collapsed") {
    const shown = state === "full" ? groupTabs : groupTabs.slice(0, 5);
    for (const tab of shown) el.appendChild(makeTabRow(tab));

    if (shown.length < groupTabs.length) {
      const more = document.createElement("div");
      more.className = "group-tab more";
      more.textContent = `…and ${groupTabs.length - shown.length} more — show all`;
      more.addEventListener("click", () => {
        groupState.set(name, "full");
        renderPreview();
      });
      el.appendChild(more);
    }
  }

  return el;
}

async function renderPreview() {
  const { allTabs, tabs } = await getPreviewTabs();

  const alreadyGrouped = allTabs.length - tabs.length;
  document.getElementById("tab-count").textContent = includeGrouped() || alreadyGrouped === 0
    ? `${allTabs.length} tabs`
    : `${tabs.length} loose · ${alreadyGrouped} in groups`;

  // Duplicate detection (always across all tabs)
  const dupes = Tabrarian.findDuplicateTabs(allTabs);
  const dupeRow = document.getElementById("dupe-row");
  if (dupes.length > 0) {
    dupeRow.classList.remove("hidden");
    document.getElementById("dupe-label").textContent =
      `${dupes.length} duplicate tab${dupes.length > 1 ? "s" : ""} found`;
  } else {
    dupeRow.classList.add("hidden");
  }

  document.getElementById("reset-moves").classList.toggle("hidden", overrides.size === 0);

  // Sleeping (discarded) tab counter
  const sleeping = allTabs.filter((t) => t.discarded).length;
  const sleepStat = document.getElementById("sleep-stat");
  sleepStat.classList.toggle("hidden", sleeping === 0);
  if (sleeping > 0) {
    sleepStat.textContent = `💤 ${sleeping} tab${sleeping > 1 ? "s" : ""} sleeping — RAM freed, click any to wake`;
  }

  // Grouping preview
  const groups = computeGroups(tabs);
  const existingGroups = await chrome.tabGroups.query({ windowId: currentWindowId });
  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  let rendered = 0;
  for (const [name, { color, tabs: groupTabs }] of groups) {
    const visible = groupTabs.filter(matchesSearch);
    if (visible.length === 0) continue;
    preview.appendChild(makeGroupEl(name, color, visible, existingGroups));
    rendered++;
  }

  if (rendered === 0) {
    const empty = document.createElement("div");
    empty.className = "group empty";
    empty.textContent = searchQuery
      ? `No tabs match “${searchQuery}”.`
      : alreadyGrouped > 0
        ? "All tabs are already in groups — nothing to move. ✓"
        : "No groupable tabs in this window.";
    preview.appendChild(empty);
  }
}

async function init() {
  const win = await chrome.windows.getCurrent();
  currentWindowId = win.id;

  // Restore settings
  const { autoGroup, regroupExisting, groupingMode: savedMode } = await chrome.storage.sync.get({
    autoGroup: false,
    regroupExisting: false,
    groupingMode: "rules"
  });
  groupingMode = savedMode;
  document.getElementById("mode-rules").classList.toggle("active", savedMode === "rules");
  document.getElementById("mode-topics").classList.toggle("active", savedMode === "topics");
  document.getElementById("mode-rules").addEventListener("click", () => setMode("rules"));
  document.getElementById("mode-topics").addEventListener("click", () => setMode("topics"));
  const toggle = document.getElementById("auto-toggle");
  toggle.checked = autoGroup;
  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoGroup: toggle.checked });
  });

  const regroupToggle = document.getElementById("regroup-toggle");
  regroupToggle.checked = regroupExisting;
  regroupToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ regroupExisting: regroupToggle.checked });
    renderPreview();
  });

  const { focusMode } = await chrome.storage.sync.get({ focusMode: false });
  const focusToggle = document.getElementById("focus-toggle");
  focusToggle.checked = focusMode;
  focusToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ focusMode: focusToggle.checked });
  });

  const { memorySaver } = await chrome.storage.sync.get({ memorySaver: false });
  const memoryToggle = document.getElementById("memory-toggle");
  memoryToggle.checked = memorySaver;
  memoryToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ memorySaver: memoryToggle.checked });
    // The background sweeps immediately on enable; reflect it shortly after.
    setTimeout(renderPreview, 500);
  });

  document.getElementById("search").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderPreview();
  });

  document.getElementById("reset-moves").addEventListener("click", () => {
    overrides.clear();
    setStatus("Manual moves reset");
    renderPreview();
  });

  document.getElementById("group-btn").addEventListener("click", async () => {
    setStatus("Grouping…");
    // Send the exact plan shown in the preview, drag moves included.
    const { tabs } = await getPreviewTabs();
    const groups = computeGroups(tabs);
    const specs = [...groups].map(([name, g]) => ({
      name,
      color: g.color,
      tabIds: g.tabs.map((t) => t.id)
    }));
    const res = await send("applyGroups", { groups: specs });
    overrides.clear();
    setStatus(res.error ? `Error: ${res.error}` : `Sorted ${res.tabCount} tabs into ${res.groupCount} groups ✓`);
    renderPreview();
  });

  document.getElementById("ungroup-btn").addEventListener("click", async () => {
    const res = await send("ungroupAll");
    setStatus(res.error ? `Error: ${res.error}` : `Ungrouped ${res.ungrouped} tabs`);
    renderPreview();
  });

  document.getElementById("collapse-btn").addEventListener("click", async () => {
    const res = await send("collapseAll");
    setStatus(res.error ? `Error: ${res.error}` : `Collapsed ${res.collapsed} groups`);
  });

  document.getElementById("dupe-btn").addEventListener("click", async () => {
    const res = await send("closeDuplicates");
    setStatus(res.error ? `Error: ${res.error}` : `Closed ${res.closed} duplicate tabs`);
    renderPreview();
  });

  renderPreview();
}

init();
