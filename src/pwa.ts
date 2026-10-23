// Service worker registration: precaches the build so the game runs offline after the first visit.

import { registerSW } from 'virtual:pwa-register';

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onOfflineReady() {
      document.body.dataset.offlineReady = 'true';
    },
  });
}
