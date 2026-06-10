// WebUI is served as a live LAN app. This service worker is now a kill-switch
// for older installs: activate, clear old offline caches, unregister, and stop
// intercepting requests. It intentionally does not navigate clients.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.includes('aionui-webui')).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
