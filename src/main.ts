import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => console.error(err));

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] ✓ Service Worker registrado. Scope:', reg.scope);

          // Check for updates periodically
          setInterval(() => {
            reg.update().catch((err) => console.warn('[SW] Error checking updates:', err));
          }, 60000); // Check every minute

          // Notify user when a new version is available
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] ⚠ Nueva versión disponible');
                
                // Send message to all clients about new version
                reg.active?.postMessage({
                  type: 'SKIP_WAITING',
                });

                // Show notification to user (optional)
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    reg.showNotification('SmartEconomato', {
                      body: 'Nueva versión disponible. Recargando...',
                      icon: '/icon-192x192.png',
                      tag: 'sw-update',
                    });
                  } catch (e) {
                    console.log('[SW] Could not show update notification');
                  }
                }

                // Listen for the controlling service worker change
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  if (refreshing) return;
                  refreshing = true;
                  window.location.reload();
                });

                // Tell the new worker to take control
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => console.warn('[SW] ✗ Error al registrar:', err));
    });
  } else {
    console.warn('[SW] Service Workers no soportados en este navegador');
  }
}
