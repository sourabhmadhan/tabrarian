// Smart (semantic) grouping — 100% local, no network, no API keys.
//
// Clusters tabs by what their titles *mean* using TF-IDF weighting and
// average-linkage agglomerative clustering, then labels each cluster with
// its most distinctive words. Tabs that don't cluster with anything fall
// back to the rules engine in categorizer.js.

const SG_STOPWORDS = new Set([
  // english
  "a", "an", "the", "and", "or", "but", "if", "of", "at", "by", "for",
  "with", "about", "to", "from", "in", "on", "is", "are", "was", "were",
  "be", "been", "it", "its", "this", "that", "these", "those", "as", "not",
  "no", "so", "do", "does", "did", "can", "could", "will", "would", "should",
  "you", "your", "yours", "we", "our", "they", "their", "he", "she", "his",
  "her", "i", "me", "my", "us", "them", "what", "which", "who", "whom",
  "when", "where", "why", "how", "all", "any", "both", "each", "more",
  "most", "other", "some", "such", "than", "too", "very", "just", "also",
  "up", "out", "over", "under", "again", "then", "once", "here", "there",
  "vs", "via", "per", "new", "get", "got", "one", "two",
  // web noise
  "www", "com", "org", "net", "html", "php", "index", "home", "page",
  "pages", "official", "website", "site", "online", "free", "best", "top",
  "login", "signin", "sign", "log", "welcome", "search", "results",
  "watch", "video", "untitled", "document", "docs", "google", "wiki",
  "wikipedia", "youtube", "reddit", "linkedin", "twitter", "facebook",
  // format words — they describe the *kind* of page, not its topic, and
  // cause false clusters ("Ultimate Guide to X" + "Y Travel Guide")
  "guide", "tutorial", "review", "introduction", "intro", "beginner",
  "ultimate", "complete", "definitive", "comprehensive", "overview",
  "explained", "tips", "tricks", "part", "episode", "chapter", "edition",
  "update", "updated", "latest", "full", "easy", "simple", "quick"
]);

const SG_COLORS = ["purple", "cyan", "orange", "pink", "yellow", "green", "blue", "red", "grey"];

// Light stemmer so "recipes"/"recipe" and "designing"/"design" match.
function sgStem(token) {
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("ing") && token.length > 6) token = token.slice(0, -3);
  else if (token.endsWith("es") && token.length > 4) token = token.slice(0, -2);
  else if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) token = token.slice(0, -1);
  return token;
}

function sgTokenize(tab) {
  const counts = new Map();
  const add = (raw, weight) => {
    if (raw.length < 3 || raw.length > 24) return;
    if (/^\d+$/.test(raw)) return;
    const token = sgStem(raw);
    if (SG_STOPWORDS.has(raw) || SG_STOPWORDS.has(token)) return;
    counts.set(token, (counts.get(token) || 0) + weight);
  };

  const title = (tab.title || "").toLowerCase();
  for (const t of title.split(/[^a-z0-9]+/)) add(t, 1);

  // URL slug words carry signal too, at lower weight.
  try {
    const path = new URL(tab.url).pathname.toLowerCase();
    for (const t of path.split(/[^a-z0-9]+/)) add(t, 0.5);
  } catch { /* ignore */ }

  return counts;
}

// Builds a normalized TF-IDF vector per tab. IDF is computed over the
// current window's tabs, so boilerplate shared by many tabs (like a
// "- LeetCode" suffix) weighs itself down automatically.
function sgVectorize(tabs) {
  const docs = tabs.map((tab) => ({ tab, counts: sgTokenize(tab) }));
  const df = new Map();
  for (const doc of docs) {
    for (const token of doc.counts.keys()) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const n = docs.length;
  for (const doc of docs) {
    const vec = new Map();
    let normSq = 0;
    for (const [token, count] of doc.counts) {
      // Square-root-dampened IDF: rare words still dominate, but a single
      // shared topical word ("recipe") is enough to pull two tabs together.
      const idf = Math.sqrt(Math.log(1 + n / df.get(token)));
      const w = (1 + Math.log(count)) * idf;
      vec.set(token, w);
      normSq += w * w;
    }
    const norm = Math.sqrt(normSq) || 1;
    for (const [token, w] of vec) vec.set(token, w / norm);
    doc.vec = vec;
  }
  return docs;
}

function sgCosine(a, b) {
  // iterate the smaller vector
  if (a.size > b.size) [a, b] = [b, a];
  let dot = 0;
  for (const [token, w] of a) {
    const wb = b.get(token);
    if (wb) dot += w * wb;
  }
  return dot;
}

// Average-linkage agglomerative clustering. Fine for a window of tabs
// (n ≲ 200); merging stops when no two clusters are similar enough.
function sgCluster(docs, threshold) {
  const n = docs.length;
  const sim = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sim[i][j] = sim[j][i] = sgCosine(docs[i].vec, docs[j].vec);
    }
  }

  let clusters = docs.map((_, i) => [i]);
  const linkage = (a, b) => {
    let total = 0;
    for (const i of a) for (const j of b) total += sim[i][j];
    return total / (a.length * b.length);
  };

  for (;;) {
    let best = threshold;
    let bi = -1, bj = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const link = linkage(clusters[i], clusters[j]);
        if (link > best) { best = link; bi = i; bj = j; }
      }
    }
    if (bi === -1) break;
    clusters[bi] = clusters[bi].concat(clusters[bj]);
    clusters.splice(bj, 1);
  }
  return clusters;
}

// Labels a cluster with its 2 most distinctive tokens.
function sgLabel(docs, cluster) {
  const scores = new Map();
  for (const idx of cluster) {
    for (const [token, w] of docs[idx].vec) {
      scores.set(token, (scores.get(token) || 0) + w);
    }
  }
  const top = [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => t.charAt(0).toUpperCase() + t.slice(1));
  return top.join(" · ") || "Topic";
}

// Main entry: groups tabs by topic. Returns the same Map shape as
// Tabrarian.buildGroups. Unclustered tabs are handed to the rules engine.
function buildTopicGroups(tabs, { threshold = 0.10, minClusterSize = 2 } = {}) {
  const groupable = tabs.filter((t) => Tabrarian.getHostname(t.url || ""));
  if (groupable.length === 0) return new Map();

  const docs = sgVectorize(groupable);
  const clusters = sgCluster(docs, threshold);

  const groups = new Map();
  const leftovers = [];
  let colorIdx = 0;

  for (const cluster of clusters.sort((a, b) => b.length - a.length)) {
    if (cluster.length < minClusterSize) {
      leftovers.push(...cluster.map((i) => docs[i].tab));
      continue;
    }
    let name = sgLabel(docs, cluster);
    while (groups.has(name)) name += " ·"; // avoid rare collisions
    groups.set(name, {
      color: SG_COLORS[colorIdx++ % SG_COLORS.length],
      tabs: cluster.map((i) => docs[i].tab)
    });
  }

  // Whatever didn't cluster gets the normal rules treatment.
  if (leftovers.length > 0) {
    for (const [name, group] of Tabrarian.buildGroups(leftovers)) {
      if (groups.has(name)) groups.get(name).tabs.push(...group.tabs);
      else groups.set(name, group);
    }
  }

  return new Map([...groups].sort((a, b) => b[1].tabs.length - a[1].tabs.length));
}

if (typeof self !== "undefined") {
  self.SmartGroup = { buildTopicGroups };
}
