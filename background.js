importScripts("categorizer.js");

// Core action: organize tabs in a window into named, colored groups.
// By default only loose (ungrouped) tabs are touched, so groups the user
// created by hand stay exactly as they are. Pass includeGrouped to reshuffle
// everything.
async function groupAllTabs(windowId, includeGrouped) {
  let tabs = await chrome.tabs.query({ windowId, pinned: false });
  if (!includeGrouped) {
    tabs = tabs.filter((t) => t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);
  }
  const groups = Tabrarian.buildGroups(tabs);

  // Reuse existing groups when the names mean the same thing (fuzzy match:
  // "LC Trees" adopts "LeetCode · Trees") so re-running never creates a
  // near-duplicate group next to one the user already made.
  const existingGroups = await chrome.tabGroups.query({ windowId });

  let grouped = 0;
  for (const [name, { color, tabs: groupTabs }] of groups) {
    const tabIds = groupTabs.map((t) => t.id);
    if (tabIds.length === 0) continue;

    const existing = Tabrarian.findMatchingGroup(name, existingGroups);
    if (existing) {
      await chrome.tabs.group({ tabIds, groupId: existing.id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: name, color });
    }
    grouped += tabIds.length;
  }
  return { groupCount: groups.size, tabCount: grouped };
}

// Groups one specific set of tabs (per-group "Apply" button in the popup).
// Returns the title of the group the tabs ended up in.
async function groupOne(windowId, name, color, tabIds) {
  const existingGroups = await chrome.tabGroups.query({ windowId });
  const existing = Tabrarian.findMatchingGroup(name, existingGroups);
  if (existing) {
    await chrome.tabs.group({ tabIds, groupId: existing.id });
    return { title: existing.title, tabCount: tabIds.length };
  }
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, { title: name, color });
  return { title: name, tabCount: tabIds.length };
}

// Applies an explicit grouping plan computed by the popup (which includes
// the user's drag-and-drop adjustments).
async function applyGroups(windowId, specs) {
  let tabCount = 0;
  for (const spec of specs) {
    if (spec.tabIds.length === 0) continue;
    await groupOne(windowId, spec.name, spec.color, spec.tabIds);
    tabCount += spec.tabIds.length;
  }
  return { groupCount: specs.length, tabCount };
}

async function ungroupAllTabs(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const groupedTabIds = tabs.filter((t) => t.groupId !== -1).map((t) => t.id);
  if (groupedTabIds.length > 0) {
    await chrome.tabs.ungroup(groupedTabIds);
  }
  return { ungrouped: groupedTabIds.length };
}

async function collapseAllGroups(windowId) {
  const groups = await chrome.tabGroups.query({ windowId });
  await Promise.all(groups.map((g) => chrome.tabGroups.update(g.id, { collapsed: true })));
  return { collapsed: groups.length };
}

async function closeDuplicates(windowId) {
  const tabs = await chrome.tabs.query({ windowId, pinned: false });
  const dupes = Tabrarian.findDuplicateTabs(tabs);
  // Never close the active tab; keep it and close its twin instead is not
  // needed since findDuplicateTabs keeps the first occurrence — but if the
  // active tab is a later duplicate, swap it out of the close list.
  const active = tabs.find((t) => t.active);
  const toClose = dupes.filter((t) => !active || t.id !== active.id);
  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose.map((t) => t.id));
  }
  return { closed: toClose.length };
}

// Auto-group: when enabled, newly loaded tabs get sorted into a matching
// group automatically.
async function maybeAutoGroup(tab) {
  const { autoGroup } = await chrome.storage.sync.get({ autoGroup: false });
  if (!autoGroup || !tab.url || tab.pinned || tab.groupId !== -1) return;

  const cat = Tabrarian.categorizeTab(tab);
  if (!cat) return;

  const existingGroups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const existing = Tabrarian.findMatchingGroup(cat.name, existingGroups);
  if (existing) {
    await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
  } else {
    const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, { title: cat.name, color: cat.color });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    maybeAutoGroup(tab).catch(() => {});
  }
});

// Focus mode: when enabled, switching tabs expands the group you're working
// in and collapses all the others, keeping the tab strip readable all day.
async function maybeFocusGroup(tabId) {
  const { focusMode } = await chrome.storage.sync.get({ focusMode: false });
  if (!focusMode) return;

  const tab = await chrome.tabs.get(tabId);
  // On a loose tab, leave groups as they are.
  if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return;

  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  await Promise.all(
    groups.map((g) =>
      // May fail transiently while the user is dragging a tab — ignore.
      chrome.tabGroups.update(g.id, { collapsed: g.id !== tab.groupId }).catch(() => {})
    )
  );
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  maybeFocusGroup(tabId).catch(() => {});
});

// Memory saver: periodically discards tabs in collapsed groups that haven't
// been used for a while. Discarded tabs keep their title/favicon in the tab
// strip and reload right where they were when clicked — no data leaves, no
// tab closes; only the RAM is freed.
const MEMORY_SWEEP_ALARM = "memory-sweep";
const MEMORY_SWEEP_MINUTES = 5;
const MEMORY_GRACE_MS = 10 * 60 * 1000; // don't sleep tabs used in the last 10 min

async function syncMemorySaverAlarm() {
  const { memorySaver } = await chrome.storage.sync.get({ memorySaver: false });
  if (memorySaver) {
    chrome.alarms.create(MEMORY_SWEEP_ALARM, { periodInMinutes: MEMORY_SWEEP_MINUTES });
  } else {
    chrome.alarms.clear(MEMORY_SWEEP_ALARM);
  }
}

async function memorySweep() {
  const collapsed = await chrome.tabGroups.query({ collapsed: true });
  if (collapsed.length === 0) return;
  const collapsedIds = new Set(collapsed.map((g) => g.id));

  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const candidates = tabs.filter((t) =>
    collapsedIds.has(t.groupId) &&
    !t.active &&
    !t.audible &&            // never interrupt playing audio/video
    !t.discarded &&          // already sleeping
    t.autoDiscardable !== false && // site asked not to be discarded
    (!t.lastAccessed || now - t.lastAccessed > MEMORY_GRACE_MS)
  );

  await Promise.all(candidates.map((t) => chrome.tabs.discard(t.id).catch(() => {})));
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MEMORY_SWEEP_ALARM) memorySweep().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => syncMemorySaverAlarm().catch(() => {}));
chrome.runtime.onStartup.addListener(() => syncMemorySaverAlarm().catch(() => {}));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.memorySaver) {
    syncMemorySaverAlarm().catch(() => {});
    // Sweep right away when the user turns it on, so the effect is visible.
    if (changes.memorySaver.newValue) memorySweep().catch(() => {});
  }
});

// Message API used by the popup.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    groupAll: () => groupAllTabs(msg.windowId, msg.includeGrouped),
    groupOne: () => groupOne(msg.windowId, msg.name, msg.color, msg.tabIds),
    applyGroups: () => applyGroups(msg.windowId, msg.groups),
    ungroupAll: () => ungroupAllTabs(msg.windowId),
    collapseAll: () => collapseAllGroups(msg.windowId),
    closeDuplicates: () => closeDuplicates(msg.windowId)
  };
  const handler = handlers[msg.action];
  if (!handler) return;
  handler()
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // keep the message channel open for the async response
});
