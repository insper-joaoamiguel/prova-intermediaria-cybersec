/* global globalThis */

(function definePrivacyScoring() {
  "use strict";

  const methodology = {
    version: "1.0",
    scale: "0-100; maior valor significa menor exposição observada",
    criteria: [
      { id: "third-party-domains", label: "Domínios de terceira parte", weight: 20, justification: "Cada origem externa aumenta a superfície de compartilhamento e é comparada com a lista de rastreadores observados." },
      { id: "third-party-cookies", label: "Cookies de terceira parte", weight: 20, justification: "Cookies recebidos por Set-Cookie ou pela API de cookies recebem maior penalidade quando são persistentes." },
      { id: "storage", label: "Armazenamento fora da origem", weight: 15, justification: "localStorage, sessionStorage e IndexedDB em frames de terceira parte representam persistência adicional." },
      { id: "fingerprinting", label: "Fingerprinting e hooks de interação", weight: 15, justification: "Canvas, mudanças globais e listeners de interação são sinais comportamentais; a intenção deve ser confirmada no teste." },
      { id: "sync-and-bounce", label: "Cookie sync e bounce tracking", weight: 10, justification: "Identificadores em requisições cross-site e redirects entre sites permitem correlação de navegação." },
      { id: "hijacking", label: "Hijacking, polling e canais persistentes", weight: 10, justification: "WebSocket, EventSource, polling repetido, scripts injetados e alterações de globais podem indicar hook ou abuso." },
      { id: "data-leaks", label: "Vazamento de dados para terceiros", weight: 10, justification: "Chaves de dados em requisições cross-site ou endpoints de JS leaks são candidatos a exfiltração." }
    ]
  };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function storageExposure(report) {
    let thirdPartyOrigins = 0;
    for (const frame of report.storage.values()) {
      if (!frame.url || !report.topUrl) continue;
      try {
        const frameHost = new URL(frame.url).hostname;
        const topHost = new URL(report.topUrl).hostname;
        const frameSite = frameHost.split(".").slice(-2).join(".");
        const topSite = topHost.split(".").slice(-2).join(".");
        const data = ((frame.localStorage && frame.localStorage.keys) || 0) +
          ((frame.sessionStorage && frame.sessionStorage.keys) || 0) +
          ((frame.indexedDB && frame.indexedDB.databases && frame.indexedDB.databases.length) || 0);
        if (frameSite !== topSite && data > 0) thirdPartyOrigins += 1;
      } catch (_error) {
        // Ignore opaque or browser-internal origins.
      }
    }
    return thirdPartyOrigins;
  }

  function cookieExposure(report) {
    const entries = [
      ...report.cookies.headerSetCookies,
      ...report.cookies.changes
    ];
    return entries.filter((cookie) => cookie.siteType === "third-party");
  }

  function criterion(id, weight, observed, penalty, explanation) {
    return { id, weight, observed, penalty: clamp(penalty, 0, weight), explanation };
  }

  function calculatePrivacyScore(report) {
    const domains = [...report.domains.values()];
    const thirdPartyDomains = domains.filter((domain) => domain.siteType === "third-party");
    const thirdPartyCookies = cookieExposure(report);
    const canvasCount = report.probes.filter((event) => event.type === "canvas").length;
    const interactionCount = report.probes.filter((event) => event.type === "interaction-hook").length;
    const globalChanges = report.probes.filter((event) => event.type === "global-change" || event.type === "script-injection").length;
    const hijackingSignals = report.hijackingSignals.length;
    const syncAndBounce = report.syncSignals.length + report.bounceSignals.length;
    const leakSignals = report.leakSignals.length;
    const storageCount = storageExposure(report);
    const criteria = [
      criterion("third-party-domains", 20, thirdPartyDomains.length, Math.min(20, thirdPartyDomains.length * 2), `${thirdPartyDomains.length} domínio(s) de terceira parte observados.`),
      criterion("third-party-cookies", 20, thirdPartyCookies.length, Math.min(20, thirdPartyCookies.reduce((sum, cookie) => sum + (cookie.session ? 3 : 5), 0)), `${thirdPartyCookies.length} cookie(s) de terceira parte observados.`),
      criterion("storage", 15, storageCount, Math.min(15, storageCount * 7.5), `${storageCount} origem(ns) de terceira parte com armazenamento observável.`),
      criterion("fingerprinting", 15, canvasCount + interactionCount + globalChanges, Math.min(15, (canvasCount ? 8 : 0) + Math.min(4, interactionCount) + Math.min(3, globalChanges)), `${canvasCount} canvas, ${interactionCount} hook(s) de interação e ${globalChanges} alteração(ões) de superfície global.`),
      criterion("sync-and-bounce", 10, syncAndBounce, Math.min(10, syncAndBounce * 3), `${report.syncSignals.length} sync e ${report.bounceSignals.length} bounce candidate(s).`),
      criterion("hijacking", 10, hijackingSignals, Math.min(10, hijackingSignals * 2), `${hijackingSignals} sinal(is) de canal persistente, hook ou script injetado.`),
      criterion("data-leaks", 10, leakSignals, Math.min(10, leakSignals * 5), `${leakSignals} candidato(s) a vazamento para terceira parte.`)
    ];
    const penalty = criteria.reduce((total, item) => total + item.penalty, 0);
    const score = Math.round(clamp(100 - penalty, 0, 100));
    const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
    return { score, grade, penalty: Math.round(penalty * 10) / 10, criteria, methodology };
  }

  globalThis.PRIVACY_SCORE_METHODOLOGY = methodology;
  globalThis.calculatePrivacyScore = calculatePrivacyScore;
})();
