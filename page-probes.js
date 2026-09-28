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

  patchCanvas();
  patchWebSocket();
  patchEventSource();
  patchFetchAndXhr();
  patchStorageAccess();
})();
