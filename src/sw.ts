// The service worker (vite-plugin-pwa, injectManifest). Everything the game needs is kept on the device so it
// runs offline, but the page itself comes from the web whenever there is a connection: a device that played
// before gets the newest game on its first visit after an update, not the copy it kept (found on a real phone,
// 1 Nov 2026). Offline, or when the network is too slow, the page kept on the device is used.

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]; skipWaiting(): Promise<void> };

/** Waiting longer than this for the page on a poor connection, the kept one is used. */
const PAGE_TIMEOUT_S = 4;

void self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(
    new NetworkOnly({
      networkTimeoutSeconds: PAGE_TIMEOUT_S,
      plugins: [{ handlerDidError: async () => (await matchPrecache('index.html')) ?? Response.error() }],
    }),
  ),
);
