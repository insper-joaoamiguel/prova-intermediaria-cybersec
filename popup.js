/* global browser */

(function initializePopup() {
  "use strict";

  const elements = {
    pageUrl: document.querySelector("#page-url"), blocking: document.querySelector("#blocking"),
    refresh: document.querySelector("#refresh"), clear: document.querySelector("#clear"),
    domainCount: document.querySelector("#domain-count"), thirdPartyCount: document.querySelector("#third-party-count"),
    requestCount: document.querySelector("#request-count"), blockedCount: document.querySelector("#blocked-count"),
    domainStatus: document.querySelector("#domain-status"), domains: document.querySelector("#domains"),
    cookieTotal: document.querySelector("#cookie-total"), cookieSummary: document.querySelector("#cookie-summary"),
    storageTotal: document.querySelector("#storage-total"), storageSummary: document.querySelector("#storage-summary"),
    probeTotal: document.querySelector("#probe-total"), probeSummary: document.querySelector("#probe-summary"),
    status: document.querySelector("#status")
  };

  let activeTabId = null;

  function renderDomains(domains) {
    elements.domains.textContent = "";
    if (!domains.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.appendChild(document.createTextNode("Nenhum domínio observado ainda."));
      elements.domains.appendChild(empty);
      return;
    }
    for (const domain of domains.slice(0, 30)) {
      const item = document.createElement("li");
      item.className = domain.siteType === "third-party" ? "third-party" : "";
      const name = document.createElement("span");
      name.className = "domain-name";
      name.title = domain.examples && domain.examples[0] ? domain.examples[0] : domain.host;
      name.appendChild(document.createTextNode(domain.host));
      const meta = document.createElement("span");
      meta.className = "domain-meta";
      meta.appendChild(document.createTextNode(`${domain.requests} req · ${domain.siteType === "third-party" ? "3P" : "1P"}`));
      item.append(name, meta);
      elements.domains.appendChild(item);
    }
  }

  function renderStorage(storage) {
    const frames = Object.values(storage || {});
    const localKeys = frames.reduce((total, frame) => total + ((frame.localStorage && frame.localStorage.keys) || 0), 0);
    const sessionKeys = frames.reduce((total, frame) => total + ((frame.sessionStorage && frame.sessionStorage.keys) || 0), 0);
    const databases = frames.reduce((total, frame) => total + ((frame.indexedDB && frame.indexedDB.databases && frame.indexedDB.databases.length) || 0), 0);
    elements.storageTotal.textContent = localKeys + sessionKeys + databases;
    elements.storageSummary.textContent = `${localKeys} localStorage · ${sessionKeys} sessionStorage · ${databases} IndexedDB`;
  }

  function render(report) {
    const domains = report.domains || [];
    const thirdParty = domains.filter((domain) => domain.siteType === "third-party");
    const cookies = report.cookies || { observed: 0, firstParty: {}, thirdParty: {} };
    const probes = report.probes || { total: 0, byType: {} };
    const probeNames = Object.entries(probes.byType || {}).map(([name, count]) => `${name} ${count}`).join(" · ");
    elements.pageUrl.textContent = report.topUrl || "Página especial do Firefox ou aba sem URL";
    elements.pageUrl.title = report.topUrl || "";
    elements.blocking.checked = Boolean(report.blockingEnabled);
    elements.domainCount.textContent = domains.length;
    elements.thirdPartyCount.textContent = thirdParty.length;
    elements.requestCount.textContent = (report.requests || []).length;
    elements.blockedCount.textContent = report.blockedCount || 0;
    elements.domainStatus.textContent = `${thirdParty.length} de terceiros`;
    elements.cookieTotal.textContent = cookies.observed || 0;
    elements.cookieSummary.textContent = `${(cookies.firstParty && cookies.firstParty.total) || 0} 1P · ${(cookies.thirdParty && cookies.thirdParty.total) || 0} 3P · ${(cookies.firstParty && cookies.firstParty.session) || 0} sessão · ${(cookies.firstParty && cookies.firstParty.persistent) || 0} persistentes`;
    elements.probeTotal.textContent = probes.total || 0;
    elements.probeSummary.textContent = probeNames || "Canvas, WebSocket, EventSource, fetch e XHR ainda não observados.";
    renderDomains(domains);
    renderStorage(report.storage);
    elements.status.textContent = report.lastActivityAt ? `Atualizado às ${new Date(report.lastActivityAt).toLocaleTimeString()}` : "Relatório local da aba ativa.";
  }

  async function refresh() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || typeof tab.id !== "number") throw new Error("Nenhuma aba ativa");
      activeTabId = tab.id;
      const report = await browser.runtime.sendMessage({ type: "get-tab-report", tabId: activeTabId });
      render(report);
    } catch (_error) {
      elements.status.textContent = "Não foi possível obter o relatório desta aba.";
    }
  }

  elements.refresh.addEventListener("click", refresh);
  elements.blocking.addEventListener("change", async () => {
    await browser.runtime.sendMessage({ type: "set-blocking", enabled: elements.blocking.checked });
    await refresh();
  });
  elements.clear.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "clear-tab-report", tabId: activeTabId });
    await refresh();
  });

  refresh();
})();
