// Shared categorization engine.
// Loaded by both the popup (via <script>) and the service worker (via importScripts).

const CATEGORIES = [
  {
    name: "Dev",
    color: "blue",
    domains: [
      "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
      "stackexchange.com", "npmjs.com", "pypi.org", "crates.io",
      "codepen.io", "jsfiddle.net", "codesandbox.io", "replit.com",
      "vercel.com", "netlify.com",
      "developer.mozilla.org", "developer.chrome.com", "devdocs.io"
    ],
    // hostPatterns match a hostname *label*, so self-hosted internal tools
    // are caught on any company domain: jenkins.corp.io, gitlab.acme.dev...
    hostPatterns: [
      "jenkins", "gitlab", "argocd", "argo", "artifactory", "sonarqube",
      "nexus", "backstage", "harbor", "drone", "teamcity", "buildkite"
    ],
    keywords: ["api reference", "sdk", "changelog", "pull request", "merge request"]
  },
  {
    name: "Cloud",
    color: "orange",
    domains: [
      "aws.amazon.com", "cloud.google.com", "portal.azure.com",
      "azure.microsoft.com", "cloud.digitalocean.com", "dashboard.heroku.com",
      "railway.app", "fly.io", "dash.cloudflare.com", "console.hetzner.cloud",
      "app.supabase.com", "console.firebase.google.com"
    ],
    keywords: []
  },
  {
    name: "Monitoring",
    color: "red",
    domains: [
      "grafana.com", "datadoghq.com", "newrelic.com", "sentry.io",
      "splunk.com", "pagerduty.com", "opsgenie.com", "prometheus.io",
      "statuspage.io", "betterstack.com", "honeycomb.io"
    ],
    hostPatterns: [
      "grafana", "kibana", "prometheus", "alertmanager", "datadog",
      "sentry", "splunk", "jaeger", "zipkin", "nagios", "zabbix",
      "uptime", "metrics", "monitoring", "observability"
    ],
    keywords: []
  },
  {
    name: "Docs",
    color: "blue",
    domains: ["readthedocs.io", "gitbook.io", "docusaurus.io"],
    hostPatterns: [
      "wiki", "confluence", "docs", "kb", "handbook", "intranet", "runbook"
    ],
    keywords: ["documentation", "runbook", "internal docs"]
  },
  {
    name: "AI",
    color: "purple",
    domains: [
      "claude.ai", "chatgpt.com", "chat.openai.com", "gemini.google.com",
      "perplexity.ai", "huggingface.co", "anthropic.com", "openai.com",
      "poe.com", "midjourney.com"
    ],
    keywords: []
  },
  {
    name: "Video",
    color: "red",
    domains: [
      "youtube.com", "youtu.be", "netflix.com", "primevideo.com",
      "hotstar.com", "twitch.tv", "vimeo.com", "hulu.com",
      "disneyplus.com", "jiocinema.com", "sonyliv.com"
    ],
    keywords: ["watch", "episode", "trailer"]
  },
  {
    name: "Social",
    color: "pink",
    domains: [
      "twitter.com", "x.com", "facebook.com", "instagram.com",
      "reddit.com", "linkedin.com", "threads.net", "tiktok.com",
      "pinterest.com", "quora.com", "mastodon.social", "bsky.app",
      "discord.com", "telegram.org", "web.whatsapp.com"
    ],
    keywords: []
  },
  {
    name: "Shopping",
    color: "yellow",
    domains: [
      "amazon.com", "amazon.in", "flipkart.com", "ebay.com",
      "myntra.com", "ajio.com", "etsy.com", "aliexpress.com",
      "walmart.com", "target.com", "meesho.com", "nykaa.com",
      "bigbasket.com", "blinkit.com", "zeptonow.com", "swiggy.com", "zomato.com"
    ],
    keywords: ["cart", "checkout", "buy online", "price", "order"]
  },
  {
    name: "News",
    color: "orange",
    domains: [
      "news.google.com", "bbc.com", "cnn.com", "nytimes.com",
      "theguardian.com", "reuters.com", "bloomberg.com", "techcrunch.com",
      "theverge.com", "arstechnica.com", "wired.com", "hindustantimes.com",
      "timesofindia.indiatimes.com", "thehindu.com", "ndtv.com",
      "indianexpress.com", "news.ycombinator.com"
    ],
    keywords: ["breaking news", "latest news", "headlines"]
  },
  {
    name: "Email",
    color: "cyan",
    domains: [
      "mail.google.com", "outlook.live.com", "outlook.office.com",
      "mail.yahoo.com", "proton.me", "mail.proton.me", "zoho.com"
    ],
    keywords: ["inbox"]
  },
  {
    name: "Work",
    color: "green",
    domains: [
      "docs.google.com", "sheets.google.com", "slides.google.com",
      "drive.google.com", "notion.so", "notion.site", "slack.com",
      "atlassian.net", "jira.com", "trello.com", "asana.com",
      "monday.com", "figma.com", "miro.com", "airtable.com",
      "office.com", "sharepoint.com", "zoom.us", "meet.google.com",
      "calendar.google.com", "linear.app", "clickup.com"
    ],
    hostPatterns: ["jira", "slack"],
    keywords: []
  },
  {
    name: "Finance",
    color: "green",
    domains: [
      "paypal.com", "stripe.com", "zerodha.com", "groww.in",
      "upstox.com", "coinbase.com", "binance.com", "tradingview.com",
      "moneycontrol.com", "screener.in", "hdfcbank.com", "icicibank.com",
      "sbi.co.in", "axisbank.com", "kotak.com", "phonepe.com", "paytm.com"
    ],
    keywords: ["stock price", "portfolio", "mutual fund", "net banking"]
  },
  {
    name: "Learning",
    color: "grey",
    domains: [
      "wikipedia.org", "coursera.org", "udemy.com", "edx.org",
      "khanacademy.org", "medium.com", "dev.to", "freecodecamp.org",
      "geeksforgeeks.org", "w3schools.com", "leetcode.com",
      "hackerrank.com", "kaggle.com", "arxiv.org", "scholar.google.com",
      "baeldung.com", "refactoring.guru", "roadmap.sh",
      "wikihow.com", "fandom.com", "wiktionary.org", "britannica.com",
      "edu", "ac.in", "ac.uk", "edu.au", "nptel.ac.in"
    ],
    keywords: ["tutorial", "how to", "course", "learn"]
  },
  {
    name: "Music",
    color: "purple",
    domains: [
      "spotify.com", "open.spotify.com", "music.youtube.com",
      "soundcloud.com", "music.apple.com", "gaana.com", "jiosaavn.com"
    ],
    keywords: []
  },
  {
    name: "Reading",
    color: "cyan",
    domains: [
      "substack.com", "hashnode.dev", "wordpress.com", "blogspot.com",
      "towardsdatascience.com", "hackernoon.com", "smashingmagazine.com",
      "css-tricks.com", "ghost.io"
    ],
    keywords: []
  },
  {
    name: "Travel",
    color: "cyan",
    domains: [
      "booking.com", "airbnb.com", "makemytrip.com", "goibibo.com",
      "irctc.co.in", "cleartrip.com", "skyscanner.com", "tripadvisor.com",
      "expedia.com", "agoda.com", "maps.google.com", "redbus.in", "ixigo.com"
    ],
    keywords: ["flight", "hotel", "itinerary", "booking"]
  },
  {
    // Placed last so specific rules win first (e.g. irctc.co.in stays Travel).
    // Bare TLD entries like "gov" match any *.gov hostname.
    name: "Government",
    color: "grey",
    domains: [
      "gov", "mil", "gov.in", "nic.in", "gov.uk", "gov.au", "govt.nz",
      "gov.sg", "gc.ca", "canada.ca", "europa.eu", "go.jp", "gov.br"
    ],
    keywords: []
  }
];

// --- Granularity settings ---------------------------------------------------

// If a single site contributes this many tabs to a category, it gets broken
// out into its own group (e.g. 10 LeetCode tabs leave "Learning" and become
// a "LeetCode" group).
const SITE_SPLIT_MIN = 4;

// Coding-problem sites additionally get split by topic once they have this
// many tabs (e.g. "LeetCode · Trees", "LeetCode · DP").
const TOPIC_SPLIT_MIN = 8;
const PROBLEM_SITES = [
  "leetcode.com", "hackerrank.com", "geeksforgeeks.org",
  "codeforces.com", "interviewbit.com", "codechef.com"
];

// Checked in order — first match wins, so more specific topics come first.
const TOPIC_RULES = [
  ["Trees", ["tree", "bst", "traversal", "ancestor", "depth of"]],
  ["Graphs", ["graph", "island", "bfs", "dfs", "course schedule", "network", "topological"]],
  ["DP", ["dynamic programming", "knapsack", "climbing stairs", "longest common",
          "edit distance", "house robber", "coin change", "subsequence", "uncrossed"]],
  ["Linked Lists", ["linked list", "list node", "cycle", "reorder list", "sorted list"]],
  ["Strings", ["string", "palindrome", "substring", "anagram", "parenthes"]],
  ["Arrays", ["array", "matrix", "interval", "two sum", "subarray", "rotate", "merge sorted"]]
];

// Nicer display names for split-out site groups. Subdomain products get
// their own labels so e.g. 6 spreadsheets and 5 documents become
// "Google Sheets" and "Google Docs" rather than one blob.
const SITE_LABELS = {
  leetcode: "LeetCode", linkedin: "LinkedIn", github: "GitHub",
  youtube: "YouTube", stackoverflow: "StackOverflow", geeksforgeeks: "GeeksForGeeks",
  hackerrank: "HackerRank", hackernoon: "HackerNoon",
  "docs.google": "Google Docs", "sheets.google": "Google Sheets",
  "slides.google": "Google Slides", "drive.google": "Google Drive",
  "mail.google": "Gmail", "meet.google": "Google Meet",
  "calendar.google": "Calendar", "maps.google": "Google Maps",
  "news.ycombinator": "Hacker News", "web.whatsapp": "WhatsApp",
  "open.spotify": "Spotify", "music.youtube": "YouTube Music",
  wikipedia: "Wikipedia",
  "console.aws.amazon": "AWS", "aws.amazon": "AWS",
  "console.cloud.google": "GCP", "cloud.google": "GCP",
  "portal.azure": "Azure", localhost: "Local"
};

function siteLabel(hostname) {
  const base = hostname.split(".").slice(0, -1).join(".") || hostname;
  return SITE_LABELS[base] || base.charAt(0).toUpperCase() + base.slice(1);
}

// Some hosts serve several products distinguished only by URL path —
// docs.google.com hosts Docs, Sheets, Slides and Forms. These rules let the
// site splitter treat each product as its own site.
const URL_PRODUCTS = [
  { host: "docs.google.com", path: "/document", label: "Google Docs" },
  { host: "docs.google.com", path: "/spreadsheets", label: "Google Sheets" },
  { host: "docs.google.com", path: "/presentation", label: "Google Slides" },
  { host: "docs.google.com", path: "/forms", label: "Google Forms" },
  { host: "atlassian.net", path: "/wiki", label: "Confluence" },
  { host: "atlassian.net", path: "/browse", label: "Jira" },
  { host: "atlassian.net", path: "/jira", label: "Jira" },
  // AWS console: the service lives in the URL path (region is a subdomain,
  // handled by the suffix match on host).
  { host: "console.aws.amazon.com", path: "/ec2", label: "AWS EC2" },
  { host: "console.aws.amazon.com", path: "/s3", label: "AWS S3" },
  { host: "console.aws.amazon.com", path: "/lambda", label: "AWS Lambda" },
  { host: "console.aws.amazon.com", path: "/cloudwatch", label: "AWS CloudWatch" },
  { host: "console.aws.amazon.com", path: "/rds", label: "AWS RDS" },
  { host: "console.aws.amazon.com", path: "/iam", label: "AWS IAM" },
  { host: "console.aws.amazon.com", path: "/ecs", label: "AWS ECS" },
  { host: "console.aws.amazon.com", path: "/eks", label: "AWS EKS" },
  { host: "console.aws.amazon.com", path: "/dynamodb", label: "AWS DynamoDB" },
  { host: "console.aws.amazon.com", path: "/sqs", label: "AWS SQS" },
  { host: "console.aws.amazon.com", path: "/sns", label: "AWS SNS" },
  { host: "console.aws.amazon.com", path: "/vpc", label: "AWS VPC" },
  { host: "console.aws.amazon.com", path: "/cloudformation", label: "AWS CloudFormation" },
  { host: "console.aws.amazon.com", path: "/apigateway", label: "AWS API Gateway" },
  { host: "console.aws.amazon.com", path: "/secretsmanager", label: "AWS Secrets Manager" },
  // GCP console
  { host: "console.cloud.google.com", path: "/compute", label: "GCP Compute" },
  { host: "console.cloud.google.com", path: "/storage", label: "GCP Storage" },
  { host: "console.cloud.google.com", path: "/bigquery", label: "GCP BigQuery" },
  { host: "console.cloud.google.com", path: "/kubernetes", label: "GCP GKE" },
  { host: "console.cloud.google.com", path: "/run", label: "GCP Cloud Run" },
  { host: "console.cloud.google.com", path: "/functions", label: "GCP Functions" },
  { host: "console.cloud.google.com", path: "/sql", label: "GCP SQL" },
  { host: "console.cloud.google.com", path: "/logs", label: "GCP Logging" },
  { host: "console.cloud.google.com", path: "/monitoring", label: "GCP Monitoring" },
  { host: "console.cloud.google.com", path: "/iam", label: "GCP IAM" }
];

// Returns the clustering key for a tab: a product label when a URL_PRODUCTS
// rule matches, otherwise the hostname.
function splitKey(tab) {
  const host = getHostname(tab.url);
  try {
    const u = new URL(tab.url);
    // Local apps: different ports are different apps.
    if (isLocalHostname(host) && u.port) {
      return { key: `${host}:${u.port}`, label: `Local :${u.port}`, host };
    }
    for (const p of URL_PRODUCTS) {
      if (matchesDomain(host, p.host) && u.pathname.startsWith(p.path)) {
        return { key: p.label, label: p.label, host };
      }
    }
  } catch {
    // fall through to hostname key
  }
  return { key: host, label: null, host };
}

// Local development: localhost, loopback, private networks, and common
// local-only TLDs. These get their own "Local" group, split by port since
// different ports are usually different apps.
const LOCAL_CATEGORY = { name: "Local", color: "green" };

function isLocalHostname(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return true;
  if (/\.(local|localhost|test|internal)$/.test(hostname)) return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}

// Heuristic for blog posts / articles on sites we don't know: article-ish
// path segments or a date in the path.
function isArticleLike(url) {
  try {
    const u = new URL(url);
    if (u.hostname.startsWith("blog.")) return true;
    return /\/(blog|articles?|posts?|stor(y|ies)|essays?)\//i.test(u.pathname)
      || /\/\d{4}\/\d{1,2}\//.test(u.pathname);
  } catch {
    return false;
  }
}

// Extracts a normalized hostname ("www." stripped) from a tab URL, or null
// for non-http pages (chrome://, about:, etc.) that shouldn't be grouped.
function getHostname(url) {
  try {
    const u = new URL(url);
    if (!["http:", "https:", "file:"].includes(u.protocol)) return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith("." + domain);
}

// Returns { name, color } for a tab, or null if nothing matches.
function categorizeTab(tab) {
  const hostname = getHostname(tab.url || "");
  if (!hostname) return null;

  if (isLocalHostname(hostname)) {
    return { ...LOCAL_CATEGORY };
  }

  for (const cat of CATEGORIES) {
    if (cat.domains.some((d) => matchesDomain(hostname, d))) {
      return { name: cat.name, color: cat.color };
    }
  }

  // Hostname-label patterns catch self-hosted internal tools on any company
  // domain (grafana.acme.com, wiki.internal.corp, jenkins-prod.acme.io).
  const labels = hostname.split(".");
  for (const cat of CATEGORIES) {
    if (!cat.hostPatterns) continue;
    const hit = cat.hostPatterns.some((p) =>
      labels.some((l) => l === p || l.startsWith(p + "-"))
    );
    if (hit) return { name: cat.name, color: cat.color };
  }

  const title = (tab.title || "").toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => title.includes(k))) {
      return { name: cat.name, color: cat.color };
    }
  }

  if (isArticleLike(tab.url)) {
    const reading = CATEGORIES.find((c) => c.name === "Reading");
    return { name: reading.name, color: reading.color };
  }

  return null;
}

// Groups a list of tabs into a Map of groupName -> { color, tabs }.
// Tabs with no category match fall back to a per-domain group when 2+ tabs
// share a domain, otherwise they land in "Other".
const FALLBACK_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

function buildGroups(tabs) {
  const groups = new Map();
  const uncategorized = [];

  for (const tab of tabs) {
    const cat = categorizeTab(tab);
    if (cat) {
      if (!groups.has(cat.name)) groups.set(cat.name, { color: cat.color, tabs: [] });
      groups.get(cat.name).tabs.push(tab);
    } else if (getHostname(tab.url || "")) {
      uncategorized.push(tab);
    }
    // Tabs with no usable hostname (chrome://newtab etc.) are left alone.
  }

  // Fallback: cluster uncategorized tabs by domain.
  const byDomain = new Map();
  for (const tab of uncategorized) {
    const host = getHostname(tab.url);
    if (!byDomain.has(host)) byDomain.set(host, []);
    byDomain.get(host).push(tab);
  }

  let colorIdx = 0;
  const leftovers = [];
  for (const [host, domainTabs] of byDomain) {
    if (domainTabs.length >= 2) {
      // Use the site name (second-level domain) as the group label.
      const label = host.split(".").slice(0, -1).join(".") || host;
      groups.set(label, {
        color: FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length],
        tabs: domainTabs
      });
    } else {
      leftovers.push(...domainTabs);
    }
  }

  if (leftovers.length > 0) {
    groups.set("Other", { color: "grey", tabs: leftovers });
  }

  const refined = refineGroups(groups);

  // Biggest groups first — makes the popup preview and tab strip scannable.
  return new Map([...refined].sort((a, b) => b[1].tabs.length - a[1].tabs.length));
}

// Second pass over the category groups: breaks out sites that dominate a
// category into their own groups, and sub-splits big coding-problem-site
// groups by topic.
function refineGroups(groups) {
  const refined = new Map();

  for (const [name, group] of groups) {
    const bySite = new Map();
    for (const tab of group.tabs) {
      const { key, label, host } = splitKey(tab);
      if (!bySite.has(key)) bySite.set(key, { host, label, tabs: [] });
      bySite.get(key).tabs.push(tab);
    }

    const remainder = [];
    for (const [, site] of bySite) {
      const isProblemSite = PROBLEM_SITES.some((d) => matchesDomain(site.host, d));

      if (isProblemSite && site.tabs.length >= TOPIC_SPLIT_MIN) {
        splitByTopic(site.host, site.tabs, refined);
      } else if (site.tabs.length >= SITE_SPLIT_MIN && bySite.size > 1) {
        refined.set(site.label || siteLabel(site.host), { color: group.color, tabs: site.tabs });
      } else {
        remainder.push(...site.tabs);
      }
    }

    if (remainder.length > 0) {
      refined.set(name, { color: group.color, tabs: remainder });
    }
  }

  return refined;
}

function splitByTopic(host, tabs, refined) {
  const label = siteLabel(host);
  const byTopic = new Map();
  const rest = [];

  for (const tab of tabs) {
    const title = (tab.title || "").toLowerCase();
    const topic = TOPIC_RULES.find(([, kws]) => kws.some((k) => title.includes(k)));
    if (topic) {
      if (!byTopic.has(topic[0])) byTopic.set(topic[0], []);
      byTopic.get(topic[0]).push(tab);
    } else {
      rest.push(tab);
    }
  }

  for (const [topicName, topicTabs] of byTopic) {
    // A one-tab topic group is just noise — fold it back into the site group.
    if (topicTabs.length < 2) {
      rest.push(...topicTabs);
      continue;
    }
    const idx = TOPIC_RULES.findIndex(([t]) => t === topicName);
    refined.set(`${label} · ${topicName}`, {
      color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      tabs: topicTabs
    });
  }

  if (rest.length > 0) {
    refined.set(label, { color: "grey", tabs: rest });
  }
}

// --- Matching computed groups to the user's existing groups -----------------

// Common shorthands people use in their own group names.
const TITLE_ALIASES = {
  lc: "leetcode", gfg: "geeksforgeeks", yt: "youtube", fb: "facebook",
  ig: "instagram", so: "stackoverflow", gh: "github", hn: "hackernews"
};

function titleTokens(title) {
  return (title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => TITLE_ALIASES[t] || t);
}

// Given a computed group name (e.g. "LeetCode · Trees") and the window's
// existing groups, returns the existing group the tabs should join, or null.
// A user group matches when every word in its title is contained in the
// computed name (after alias expansion) — so "LC Trees" adopts
// "LeetCode · Trees", and "AI" adopts "AI", but "LC Revisit" adopts nothing.
function findMatchingGroup(computedName, existingGroups) {
  const computed = new Set(titleTokens(computedName));
  let best = null;
  let bestOverlap = 0;

  for (const group of existingGroups) {
    const tokens = titleTokens(group.title);
    if (tokens.length === 0) continue;
    if (!tokens.every((t) => computed.has(t))) continue;
    // Prefer the most specific match (largest token overlap), and exact
    // matches above all.
    const overlap = tokens.length + (tokens.length === computed.size ? 100 : 0);
    if (overlap > bestOverlap) {
      best = group;
      bestOverlap = overlap;
    }
  }
  return best;
}

// Finds exact-duplicate tabs (same URL). Returns the tabs that are safe to
// close (all but the first occurrence of each URL).
function findDuplicateTabs(tabs) {
  const seen = new Set();
  const dupes = [];
  for (const tab of tabs) {
    if (!tab.url) continue;
    if (seen.has(tab.url)) dupes.push(tab);
    else seen.add(tab.url);
  }
  return dupes;
}

// Expose for the service worker (importScripts) and popup (global scope).
if (typeof self !== "undefined") {
  self.Tabrarian = { CATEGORIES, categorizeTab, buildGroups, findDuplicateTabs, getHostname, findMatchingGroup };
}
