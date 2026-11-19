// Minimaler Service Worker: macht die Seite installierbar, lädt aber immer frisch aus dem Netz (keine veralteten Daten).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
