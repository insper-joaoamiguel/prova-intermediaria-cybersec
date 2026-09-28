/* global browser */

(function initializeContentScript() {
  "use strict";

  const PROBE_SOURCE = "privacy-tracker-inspector";

  function send(message) {
    browser.runtime.sendMessage(message).catch(() => undefined);
  }

  function storageStats(storage) {
    try {
      let bytes = 0;
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key === null) continue;
        const value = storage.getItem(key) || "";
        keys.push(key);
        bytes += key.length + value.length;
      }
      return { supported: true, keys: keys.length, bytes, names: keys.slice(0, 100) };
    } catch (error) {
      return { supported: false, keys: 0, bytes: 0, error: error.name };
    }
  }

  function readStorage(kind) {
    try {
      return storageStats(window[kind]);
    } catch (error) {
      return { supported: false, keys: 0, bytes: 0, error: error.name };
    }
  }

  async function indexedDbStats() {
    if (!window.indexedDB || typeof indexedDB.databases !== "function") return { supported: false, databases: [] };
    try {
      const databases = await indexedDB.databases();
      return {
        supported: true,
        databases: databases.map((database) => ({ name: database.name || "", version: database.version || 0 }))
      };
    } catch (error) {
      return { supported: false, databases: [], error: error.name };
    }
  }

  async function collectStorage() {
    const indexedDBStats = await indexedDbStats();
    send({
      type: "storage-snapshot",
      url: window.location.href,
      localStorage: readStorage("localStorage"),
      sessionStorage: readStorage("sessionStorage"),
      indexedDB: indexedDBStats,
      documentCookieVisible: document.cookie ? document.cookie.split(";").filter(Boolean).length : 0
    });
  }

  function injectPageProbe() {
    const install = () => {
      if (!document.documentElement) return;
      const script = document.createElement("script");
      script.src = browser.runtime.getURL("page-probes.js");
      script.dataset.privacyTrackerInspector = "true";
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    };
    if (document.documentElement) install();
    else document.addEventListener("DOMContentLoaded", install, { once: true });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== PROBE_SOURCE) return;
    send({ type: "probe-event", eventType: event.data.eventType, data: event.data.data, url: window.location.href });
  });

  send({ type: "page-context", href: window.location.href, title: document.title });
  injectPageProbe();
  collectStorage();
  window.setTimeout(collectStorage, 1500);
})();
