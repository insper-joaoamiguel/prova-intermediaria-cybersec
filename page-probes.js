(function installPageProbes() {
  "use strict";

  if (window.__privacyTrackerInspectorInstalled) return;
  window.__privacyTrackerInspectorInstalled = true;
  const SOURCE = "privacy-tracker-inspector";

  function emit(eventType, data) {
    try { window.postMessage({ source: SOURCE, eventType, data: data || {} }, "*"); } catch (_error) { /* no-op */ }
  }

  function describeUrl(value) {
    try { return new URL(String(value), window.location.href).href; } catch (_error) { return String(value || ""); }
  }

  function patchCanvas() {
    const canvas = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
    if (!canvas) return;
    for (const methodName of ["toDataURL", "toBlob"]) {
      const original = canvas[methodName];
      if (typeof original !== "function") continue;
      try {
        canvas[methodName] = function patchedCanvasMethod(...args) {
          emit("canvas", { method: methodName, width: this.width, height: this.height });
          return original.apply(this, args);
        };
      } catch (_error) { /* native property may be read-only */ }
    }
    const context = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    if (!context || typeof context.getImageData !== "function") return;
    const originalGetImageData = context.getImageData;
    try {
      context.getImageData = function patchedGetImageData(...args) {
        emit("canvas", { method: "getImageData", width: this.canvas && this.canvas.width, height: this.canvas && this.canvas.height });
        return originalGetImageData.apply(this, args);
      };
    } catch (_error) { /* native property may be read-only */ }
  }

  function patchWebSocket() {
    const NativeWebSocket = window.WebSocket;
    if (typeof NativeWebSocket !== "function") return;
    try {
      window.WebSocket = new Proxy(NativeWebSocket, {
        construct(target, args, newTarget) {
          emit("websocket", { url: describeUrl(args[0]) });
          return Reflect.construct(target, args, newTarget);
        },
        apply(target, thisArg, args) {
          emit("websocket", { url: describeUrl(args[0]) });
          return Reflect.apply(target, thisArg, args);
        }
      });
    } catch (_error) { /* native property may be read-only */ }
  }

  function patchEventSource() {
    const NativeEventSource = window.EventSource;
    if (typeof NativeEventSource !== "function") return;
    try {
      window.EventSource = new Proxy(NativeEventSource, {
        construct(target, args, newTarget) {
          emit("eventsource", { url: describeUrl(args[0]) });
          return Reflect.construct(target, args, newTarget);
        }
      });
    } catch (_error) { /* native property may be read-only */ }
  }

  function patchFetchAndXhr() {
    if (typeof window.fetch === "function") {
      const originalFetch = window.fetch;
      try {
        window.fetch = function patchedFetch(input, init) {
          const value = input && input.url ? input.url : input;
          emit("fetch", { url: describeUrl(value), method: (init && init.method) || "GET" });
          return originalFetch.apply(this, arguments);
        };
      } catch (_error) { /* native property may be read-only */ }
    }
    const xhr = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!xhr) return;
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    if (typeof originalOpen === "function") {
      try {
        xhr.open = function patchedOpen(method, url, ...args) {
          this.__privacyTrackerInspectorRequest = { method: method || "GET", url: describeUrl(url) };
          return originalOpen.call(this, method, url, ...args);
        };
      } catch (_error) { /* native property may be read-only */ }
    }
    if (typeof originalSend === "function") {
      try {
        xhr.send = function patchedSend(...args) {
          if (this.__privacyTrackerInspectorRequest) emit("xhr", this.__privacyTrackerInspectorRequest);
          return originalSend.apply(this, args);
        };
      } catch (_error) { /* native property may be read-only */ }
    }
  }

  function patchStorageAccess() {
    const documentPrototype = window.Document && window.Document.prototype;
    if (!documentPrototype) return;
    for (const methodName of ["hasStorageAccess", "requestStorageAccess"]) {
      const original = documentPrototype[methodName];
      if (typeof original !== "function") continue;
      try {
        documentPrototype[methodName] = function patchedStorageAccessMethod(...args) {
          emit("storage-access", { method: methodName });
          const result = original.apply(this, args);
          if (result && typeof result.then === "function") {
            result.then((value) => emit("storage-access-result", { method: methodName, value: Boolean(value) })).catch(() => undefined);
          }
          return result;
        };
      } catch (_error) { /* native property may be read-only */ }
    }
  }

  function patchWindowHooks() {
    const initialNames = new Set(Object.getOwnPropertyNames(window));
    const suspiciousName = (name) => /(^|_)(analytics|dataLayer|fbq|finger|hook|leak|pixel|track|uid)(_|$)/i.test(name);

    const scanGlobals = () => {
      const added = Object.getOwnPropertyNames(window)
        .filter((name) => !initialNames.has(name) && suspiciousName(name));
      if (added.length) emit("global-change", { names: added.slice(0, 20) });
    };
    window.setTimeout(scanGlobals, 2000);
    window.setTimeout(scanGlobals, 5000);

    const observer = window.MutationObserver && new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!node || node.nodeType !== 1 || String(node.tagName).toLowerCase() !== "script") continue;
          emit("script-injection", {
            src: node.src || "",
            inline: !node.src,
            snippet: node.src ? "" : String(node.textContent || "").slice(0, 120)
          });
        }
      }
    });
    if (observer && document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });

    const objectDefineProperty = Object.defineProperty;
    try {
      Object.defineProperty = function patchedDefineProperty(target, property, descriptor) {
        if (target === window && suspiciousName(String(property))) {
          emit("global-change", { names: [String(property)], operation: "defineProperty" });
        }
        return objectDefineProperty.call(this, target, property, descriptor);
      };
    } catch (_error) { /* native property may be read-only */ }

    const eventTarget = window.EventTarget && window.EventTarget.prototype;
    if (eventTarget && typeof eventTarget.addEventListener === "function") {
      const originalAddEventListener = eventTarget.addEventListener;
      try {
        eventTarget.addEventListener = function patchedAddEventListener(type, listener, options) {
          if (["beforeinput", "click", "input", "keydown", "mousemove", "pointermove"].includes(String(type).toLowerCase())) {
            emit("interaction-hook", { type: String(type).toLowerCase(), target: this === document ? "document" : "window-or-element" });
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
      } catch (_error) { /* native property may be read-only */ }
    }

    if (window.navigator && typeof window.navigator.sendBeacon === "function") {
      const originalSendBeacon = window.navigator.sendBeacon.bind(window.navigator);
      try {
        window.navigator.sendBeacon = function patchedSendBeacon(url, data) {
          emit("beacon", { url: describeUrl(url), bytes: data && data.size ? data.size : null });
          return originalSendBeacon(url, data);
        };
      } catch (_error) { /* native property may be read-only */ }
    }
  }

  patchCanvas();
  patchWebSocket();
  patchEventSource();
  patchFetchAndXhr();
  patchStorageAccess();
  patchWindowHooks();
})();
