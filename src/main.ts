import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

const appLogger = {
  warn: (...args: any[]) => {
    if (!environment.production) console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  }
};

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => appLogger.error(err));

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]';

  // In development we must avoid SW caching dynamic chunks to prevent random
  // "Failed to fetch dynamically imported module" errors after rebuilds.
  if (!environment.production || isLocalhost) {
    cleanupServiceWorkersAndCaches();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {

        // Check for updates periodically
        setInterval(() => {
          reg.update().catch((err) => appLogger.warn('[SW] Error checking updates:', err));
        }, 60000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {

              reg.active?.postMessage({ type: 'SKIP_WAITING' });

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  reg.showNotification('SmartEconomato', {
                    body: 'Nueva versión disponible. Recargando...',
                    icon: '/icon-192x192.png',
                    tag: 'sw-update',
                  });
                } catch {
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
      .catch((err) => appLogger.warn('[SW] ✗ Error al registrar:', err));
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
    .catch((err) => appLogger.warn('[SW] Error limpiando SW/caché en desarrollo:', err));
}
