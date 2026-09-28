/* global browser */

const MAX_REQUESTS_PER_TAB = 500;
const MAX_EVENTS_PER_TAB = 250;

const TRACKER_HOSTS = [
  "adnxs.com", "adsrvr.org", "amplitude.com", "braze.com", "clarity.ms",
  "cloudflareinsights.com", "connect.facebook.net", "criteo.com", "doubleclick.net",
  "facebook.net", "facebook.com/tr", "fullstory.com", "google-analytics.com",
  "googletagmanager.com", "hotjar.com", "hubspot.com", "linkedin.com/px", "mathtag.com",
  "mixpanel.com", "mouseflow.com", "optimizely.com", "outbrain.com", "pixel.facebook.com",
  "quantserve.com", "scorecardresearch.com", "segment.io", "taboola.com", "thirdparty.me",
  "tiqcdn.com", "tracking.com", "twitter.com/i/adsct", "yandex.ru/metrika", "yieldmo.com"
];

const TRACKING_QUERY_KEYS = new Set([
  "_ga", "_gl", "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid", "ttclid", "twclid", "yclid"
]);

const tabReports = new Map();
let blockingEnabled = false;

function emptyReport(tabId) {
  return {
    tabId,
    topUrl: "",
    topSite: "",
    startedAt: Date.now(),
    requests: [],
    domains: new Map(),
    cookies: { changes: [], headerSetCookies: [], visibleAtEnd: [] },
    storage: new Map(),
    probes: [],
    redirects: [],
    errors: [],
    blockedCount: 0,
    knownRequestHosts: new Set(),
    lastActivityAt: Date.now()
  };
}

function getReport(tabId) {
  if (!tabReports.has(tabId)) tabReports.set(tabId, emptyReport(tabId));
  return tabReports.get(tabId);
}

function safeUrl(value) {
  try { return new URL(value); } catch (_error) { return null; }
}

function normalizedHost(value) {
  if (!value) return "";
  const parsed = safeUrl(String(value).includes("://") ? value : `https://${value}`);
  return parsed ? parsed.hostname.toLowerCase().replace(/^\./, "") : "";
}

function registrableSite(value) {
  const host = normalizedHost(value);
  if (!host) return "";
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return host;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const twoPartSuffixes = new Set([
    "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "com.br", "com.cn", "com.mx", "co.jp", "co.nz", "co.za"
  ]);
  const suffix = labels.slice(-2).join(".");
  return twoPartSuffixes.has(suffix) ? labels.slice(-3).join(".") : labels.slice(-2).join(".");
}

function isThirdParty(pageUrl, resourceUrl) {
  const pageSite = registrableSite(pageUrl);
  const resourceSite = registrableSite(resourceUrl);
  return Boolean(pageSite && resourceSite && pageSite !== resourceSite);
}

function classifySite(pageUrl, resourceUrl) {
  return isThirdParty(pageUrl, resourceUrl) ? "third-party" : "first-party";
}

function isTrackerHost(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  const path = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  return TRACKER_HOSTS.some((entry) => path === entry || path.endsWith(`.${entry}`) || path.includes(`.${entry}/`));
}

function hasTrackingQuery(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  for (const key of parsed.searchParams.keys()) {
    if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

function isBlockCandidate(report, details) {
  return Boolean(
    details && details.type !== "main_frame" &&
    isThirdParty(report.topUrl, details.url) && isTrackerHost(details.url)
  );
}

function resetForMainFrame(tabId, url) {
  const report = emptyReport(tabId);
  report.topUrl = url || "";
  report.topSite = registrableSite(url);
  tabReports.set(tabId, report);
  return report;
}

function ensureTopUrl(report, url, type) {
  if (!report.topUrl || type === "main_frame") {
    report.topUrl = url || report.topUrl;
    report.topSite = registrableSite(report.topUrl);
  }
}

function addDomain(report, details, blocked, trackingQuery) {
  const parsed = safeUrl(details.url);
  if (!parsed) return;
  const host = parsed.hostname.toLowerCase();
  const siteType = classifySite(report.topUrl, details.url);
  const current = report.domains.get(host) || {
    host, siteType, requests: 0, blocked: 0, trackingQueries: 0, types: new Set(), examples: []
  };
  current.requests += 1;
  current.blocked += blocked ? 1 : 0;
  current.trackingQueries += trackingQuery ? 1 : 0;
  current.types.add(details.type || "other");
  if (current.examples.length < 3 && !current.examples.includes(details.url)) current.examples.push(details.url);
  report.domains.set(host, current);
  report.knownRequestHosts.add(host);
}

function addRequest(tabId, details, blocked = false) {
  if (tabId < 0 || !details || !details.url) return;
  const report = getReport(tabId);
  ensureTopUrl(report, details.documentUrl || details.originUrl || details.url, details.type);
  const trackingQuery = hasTrackingQuery(details.url);
  addDomain(report, details, blocked, trackingQuery);
  if (report.requests.length < MAX_REQUESTS_PER_TAB) {
    report.requests.push({
      url: details.url,
      host: normalizedHost(details.url),
      type: details.type || "other",
      frameId: details.frameId ?? 0,
      siteType: classifySite(report.topUrl, details.url),
      blocked,
      trackingQuery,
      timeStamp: details.timeStamp || Date.now()
    });
  }
  if (blocked) report.blockedCount += 1;
  report.lastActivityAt = Date.now();
}

function parseSetCookieHeader(headerValue) {
  const parts = String(headerValue || "").split(";").map((part) => part.trim());
  const first = parts.shift() || "";
  const separator = first.indexOf("=");
  const attributes = {};
  for (const part of parts) {
    const index = part.indexOf("=");
    const key = (index >= 0 ? part.slice(0, index) : part).trim().toLowerCase();
    attributes[key] = index >= 0 ? part.slice(index + 1).trim() : true;
  }
  return {
    name: separator >= 0 ? first.slice(0, separator).trim() : first,
    session: attributes["max-age"] === undefined && attributes.expires === undefined,
    secure: attributes.secure === true,
    httpOnly: attributes.httponly === true,
    sameSite: attributes.samesite || "unspecified"
  };
}

function addSetCookieHeaders(tabId, details) {
  const report = getReport(tabId);
  ensureTopUrl(report, details.documentUrl || details.originUrl || details.url, details.type);
  for (const header of details.responseHeaders || []) {
    if (String(header.name).toLowerCase() !== "set-cookie") continue;
    if (report.cookies.headerSetCookies.length >= MAX_EVENTS_PER_TAB) break;
    report.cookies.headerSetCookies.push({
      ...parseSetCookieHeader(header.value),
      sourceUrl: details.url,
      host: normalizedHost(details.url),
      siteType: classifySite(report.topUrl, details.url),
      timeStamp: details.timeStamp || Date.now()
    });
  }
}

function serializeStorage(storage) {
  const result = {};
  for (const [key, value] of storage.entries()) result[key] = value;
  return result;
}

function serializeDomains(domains) {
  return [...domains.values()].map((domain) => ({ ...domain, types: [...domain.types] }))
    .sort((a, b) => b.requests - a.requests || a.host.localeCompare(b.host));
}

function cookieSummary(report) {
  const all = [
    ...report.cookies.headerSetCookies,
    ...report.cookies.changes.map((entry) => ({
      ...entry,
      siteType: classifySite(report.topUrl, entry.domain || entry.host || "")
    }))
  ];
  const summary = {
    observed: all.length,
    firstParty: { total: 0, session: 0, persistent: 0 },
    thirdParty: { total: 0, session: 0, persistent: 0 },
    visibleAtEnd: report.cookies.visibleAtEnd.length,
    samples: all.slice(-20)
  };
  for (const cookie of all) {
    const group = cookie.siteType === "third-party" ? summary.thirdParty : summary.firstParty;
    group.total += 1;
    if (cookie.session) group.session += 1;
    else group.persistent += 1;
  }
  return summary;
}

function probeSummary(probes) {
  const byType = {};
  for (const event of probes) byType[event.type] = (byType[event.type] || 0) + 1;
  return { total: probes.length, byType, samples: probes.slice(-20) };
}

function publicReport(report) {
  return {
    tabId: report.tabId,
    topUrl: report.topUrl,
    topSite: report.topSite,
    startedAt: report.startedAt,
    lastActivityAt: report.lastActivityAt,
    blockingEnabled,
    blockedCount: report.blockedCount,
    requests: report.requests.slice(-100),
    domains: serializeDomains(report.domains),
    cookies: cookieSummary(report),
    storage: serializeStorage(report.storage),
    probes: probeSummary(report.probes),
    redirects: report.redirects.slice(-20),
    errors: report.errors.slice(-20)
  };
}

async function snapshotVisibleCookies(tabId, url) {
  if (!url || !/^https?:/i.test(url)) return;
  try {
    const cookies = await browser.cookies.getAll({ url });
    const report = getReport(tabId);
    report.cookies.visibleAtEnd = cookies.map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      session: cookie.session,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      siteType: classifySite(report.topUrl, cookie.domain)
    }));
  } catch (error) {
    console.warn("Não foi possível consultar cookies visíveis", error);
  }
}

async function loadSettings() {
  try {
    const result = await browser.storage.local.get({ blockingEnabled: false });
    blockingEnabled = Boolean(result.blockingEnabled);
  } catch (error) {
    console.warn("Não foi possível carregar as preferências", error);
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  const tabId = typeof message.tabId === "number" ? message.tabId : sender.tab && sender.tab.id;
  if (message.type === "page-context" && typeof tabId === "number") {
    const report = getReport(tabId);
    if (sender.frameId === 0 && message.href && report.topUrl !== message.href) resetForMainFrame(tabId, message.href);
    getReport(tabId).storage.set(`frame-${sender.frameId ?? 0}`, {
      frameId: sender.frameId ?? 0, url: message.href || sender.url || "", title: message.title || ""
    });
    return Promise.resolve({ ok: true });
  }

  if (message.type === "storage-snapshot" && typeof tabId === "number") {
    const report = getReport(tabId);
    const frameId = sender.frameId ?? 0;
    report.storage.set(`frame-${frameId}`, {
      frameId, url: message.url || sender.url || "",
      localStorage: message.localStorage || { supported: false, keys: 0, bytes: 0 },
      sessionStorage: message.sessionStorage || { supported: false, keys: 0, bytes: 0 },
      indexedDB: message.indexedDB || { supported: false, databases: [] },
      documentCookieVisible: message.documentCookieVisible || 0
    });
    report.lastActivityAt = Date.now();
    return Promise.resolve({ ok: true });
  }

  if (message.type === "probe-event" && typeof tabId === "number") {
    const report = getReport(tabId);
    if (report.probes.length < MAX_EVENTS_PER_TAB) report.probes.push({
      type: message.eventType || "unknown", url: message.url || sender.url || report.topUrl,
      data: message.data || {}, timeStamp: Date.now()
    });
    report.lastActivityAt = Date.now();
    return Promise.resolve({ ok: true });
  }

  if (message.type === "get-tab-report" && typeof tabId === "number") return Promise.resolve(publicReport(getReport(tabId)));

  if (message.type === "set-blocking") {
    blockingEnabled = Boolean(message.enabled);
    return browser.storage.local.set({ blockingEnabled }).then(() => ({ blockingEnabled }));
  }

  if (message.type === "clear-tab-report" && typeof tabId === "number") {
    const topUrl = getReport(tabId).topUrl;
    resetForMainFrame(tabId, topUrl);
    return Promise.resolve({ ok: true });
  }
  return undefined;
});

browser.webRequest.onBeforeRequest.addListener((details) => {
  if (details.tabId < 0) return undefined;
  if (details.type === "main_frame") {
    resetForMainFrame(details.tabId, details.url);
    addRequest(details.tabId, details, false);
    return undefined;
  }
  const report = getReport(details.tabId);
  ensureTopUrl(report, details.documentUrl || details.originUrl, details.type);
  const shouldBlock = blockingEnabled && isBlockCandidate(report, details);
  addRequest(details.tabId, details, shouldBlock);
  return shouldBlock ? { cancel: true } : undefined;
}, { urls: ["<all_urls>"] }, ["blocking"]);

browser.webRequest.onHeadersReceived.addListener((details) => {
  if (details.tabId >= 0) addSetCookieHeaders(details.tabId, details);
}, { urls: ["<all_urls>"] }, ["responseHeaders"]);

browser.webRequest.onBeforeRedirect.addListener((details) => {
  if (details.tabId < 0) return;
  const report = getReport(details.tabId);
  if (report.redirects.length < MAX_EVENTS_PER_TAB) report.redirects.push({
    from: details.url, to: details.redirectUrl, type: details.type,
    siteChanged: isThirdParty(report.topUrl, details.url) !== isThirdParty(report.topUrl, details.redirectUrl),
    timeStamp: details.timeStamp || Date.now()
  });
}, { urls: ["<all_urls>"] });

browser.webRequest.onErrorOccurred.addListener((details) => {
  if (details.tabId < 0) return;
  const report = getReport(details.tabId);
  if (report.errors.length < MAX_EVENTS_PER_TAB) report.errors.push({
    url: details.url, type: details.type, error: details.error, timeStamp: details.timeStamp || Date.now()
  });
}, { urls: ["<all_urls>"] });

browser.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  if (!cookie) return;
  const host = String(cookie.domain || "").replace(/^\./, "").toLowerCase();
  for (const report of tabReports.values()) {
    const recent = Date.now() - report.lastActivityAt < 5000;
    const relevantRequest = [...report.knownRequestHosts].some((requestHost) => (
      requestHost === host || requestHost.endsWith(`.${host}`) || host.endsWith(`.${requestHost}`)
    ));
    const sameTopSite = report.topSite && (report.topSite === registrableSite(host) || host.endsWith(report.topSite));
    if (!recent || (!relevantRequest && !sameTopSite)) continue;
    if (report.cookies.changes.length >= MAX_EVENTS_PER_TAB) continue;
    report.cookies.changes.push({
      name: cookie.name, domain: cookie.domain, host, session: cookie.session,
      removed: changeInfo.removed, cause: changeInfo.cause,
      siteType: classifySite(report.topUrl, host), timeStamp: Date.now()
    });
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url) resetForMainFrame(tabId, tab.url);
  if (changeInfo.status === "complete" && tab.url) snapshotVisibleCookies(tabId, tab.url);
});

browser.tabs.onRemoved.addListener((tabId) => tabReports.delete(tabId));

loadSettings();
