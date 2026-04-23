import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => console.error(err));

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers no soportados en este navegador');
    return;
  }


  // In development we must avoid SW caching dynamic chunks to prevent random
  // "Failed to fetch dynamically imported module" errors after rebuilds.
  if (!environment.production) {
    cleanupServiceWorkersAndCaches();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] ✓ Service Worker registrado. Scope:', reg.scope);

        // Check for updates periodically
        setInterval(() => {
          reg.update().catch((err) => console.warn('[SW] Error checking updates:', err));
        }, 60000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] ⚠ Nueva versión disponible');

              reg.active?.postMessage({ type: 'SKIP_WAITING' });

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  reg.showNotification('SmartEconomato', {
                    body: 'Nueva versión disponible. Recargando...',
                    icon: '/icon-192x192.png',
                    tag: 'sw-update',
                  });
                } catch {
                  console.log('[SW] Could not show update notification');
                }
              }

              let refreshing = false;
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
              });

              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.warn('[SW] ✗ Error al registrar:', err));
  });
}

function cleanupServiceWorkersAndCaches(): void {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => {
      if (!('caches' in window)) return;
      return caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('smart-economato-'))
            .map((key) => caches.delete(key))
        )
      );
    })
    .then(() => console.log('[SW] Desarrollo/local: service worker desregistrado y caché limpiada'))
    .catch((err) => console.warn('[SW] Error limpiando SW/caché en desarrollo:', err));
}
