import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: NotificationAction[];
  data?: any;
}

interface NotificationAction {
  action: string;
  title: string;
}

@Injectable({
  providedIn: 'root',
})
export class PwaNotificationService {
  private permission$ = new BehaviorSubject<NotificationPermission | null>(
    this.getNotificationPermission()
  );

  constructor() {
    this.initializeNotificationListeners();
  }

  /**
   * Get current notification permission
   */
  private getNotificationPermission(): NotificationPermission | null {
    if (!('Notification' in window)) return null;
    return Notification.permission as NotificationPermission;
  }

  /**
   * Get notification permission observable
   */
  getPermission(): Observable<NotificationPermission | null> {
    return this.permission$.asObservable();
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        this.permission$.next(permission);
        return permission === 'granted';
      } catch (error) {
        console.error('[PWA Notification] Error requesting permission:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Show a local notification
   */
  async showNotification(options: NotificationOptions): Promise<Notification | null> {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      return null;
    }

    if (Notification.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const notificationOptions: any = {
        body: options.body || '',
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/icon-192x192.png',
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        data: options.data || {},
      };

      // Add vibrate if supported
      if (options.vibrate) {
        notificationOptions.vibrate = options.vibrate;
      }

      await registration.showNotification(options.title, notificationOptions);

      return null;
    } catch (error) {
      console.error('[PWA Notification] Error showing notification:', error);
      return null;
    }
  }

  /**
   * Show success notification
   */
  async showSuccess(title: string, body?: string): Promise<Notification | null> {
    return this.showNotification({
      title,
      body: body || 'Operación completada correctamente',
      tag: 'success',
      vibrate: [100, 50, 100],
    });
  }

  /**
   * Show error notification
   */
  async showError(title: string, body?: string): Promise<Notification | null> {
    return this.showNotification({
      title: title || 'Error',
      body: body || 'Algo salió mal',
      tag: 'error',
      vibrate: [500],
      requireInteraction: true,
    });
  }

  /**
   * Show warning notification
   */
  async showWarning(title: string, body?: string): Promise<Notification | null> {
    return this.showNotification({
      title,
      body: body || 'Aviso importante',
      tag: 'warning',
      vibrate: [300, 100, 300],
      requireInteraction: true,
    });
  }

  /**
   * Show info notification
   */
  async showInfo(title: string, body?: string): Promise<Notification | null> {
    return this.showNotification({
      title,
      body: body || '',
      tag: 'info',
      vibrate: [100],
    });
  }

  /**
   * Close a specific notification by tag
   */
  async closeNotification(tag: string): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag });
      notifications.forEach((n) => n.close());
    } catch (error) {
      console.error('[PWA Notification] Error closing notification:', error);
    }
  }

  /**
   * Close all notifications
   */
  async closeAllNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach((n) => n.close());
    } catch (error) {
      console.error('[PWA Notification] Error closing all notifications:', error);
    }
  }

  /**
   * Get all active notifications
   */
  async getActiveNotifications(): Promise<Notification[]> {
    if (!('serviceWorker' in navigator)) return [];

    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.getNotifications();
    } catch (error) {
      console.error('[PWA Notification] Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Initialize notification click listeners
   */
  private initializeNotificationListeners(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'NOTIFICATION_CLICK') {
        // Handle notification click if needed
      }
    });
  }

  /**
   * Subscribe to push notifications (setup for VAPID)
   */
  async subscribeToPushNotifications(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any,
      });
      return subscription;
    } catch (error) {
      console.error('[PWA Notification] Error subscribing to push:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PWA Notification] Error unsubscribing:', error);
      return false;
    }
  }

  /**
   * Helper: Convert VAPID public key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }
}
