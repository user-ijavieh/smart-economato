import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';

@Injectable({ providedIn: 'root' })
export class PresenceTrackingService {
  private readonly router = inject(Router);
  private readonly websocketService = inject(WebSocketService);

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentScreen = 'DASHBOARD';
  private currentContext: string | null = null;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.currentScreen = this.mapUrlToScreen(this.router.url);
    this.currentContext = null;
    this.websocketService.publishPresenceUpdate(this.currentScreen, this.currentContext, false);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.currentScreen = this.mapUrlToScreen(event.urlAfterRedirects);
        this.currentContext = null;
        this.websocketService.publishPresenceUpdate(this.currentScreen, this.currentContext, false);
      });

    this.startHeartbeat();
  }

  reportContext(context: string | null): void {
    this.currentContext = context;
    this.websocketService.publishPresenceUpdate(this.currentScreen, this.currentContext, false);
  }

  clearContext(): void {
    this.reportContext(null);
  }

  reportModal(modalTitle: string, itemName?: string | null): void {
    const safeTitle = (modalTitle || '').trim();
    const safeItem = (itemName || '').trim();

    if (!safeTitle) {
      this.clearContext();
      return;
    }

    if (safeItem) {
      this.reportContext(`Modal abierto: ${safeTitle} (${safeItem})`);
      return;
    }

    this.reportContext(`Modal abierto: ${safeTitle}`);
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.initialized = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.websocketService.publishPresenceUpdate(this.currentScreen, this.currentContext, true);
    }, 20000);
  }

  private mapUrlToScreen(url: string): string {
    const normalizedUrl = (url || '').toLowerCase();

    if (normalizedUrl.includes('/admin-panel/orders')) return 'ORDER_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/stock')) return 'STOCK_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/recipes')) return 'RECIPE_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/products')) return 'PRODUCT_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/users')) return 'USER_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/notifications')) return 'NOTIFICATIONS_MANAGEMENT';
    if (normalizedUrl.includes('/admin-panel/incidents') || normalizedUrl.includes('/incidents')) return 'INCIDENTS';
    if (normalizedUrl.includes('/orders')) return 'ORDERS';
    if (normalizedUrl.includes('/reception')) return 'ORDER_RECEPTION';
    if (normalizedUrl.includes('/recipes')) return 'RECIPES';
    if (normalizedUrl.includes('/inventario')) return 'INVENTORY';
    if (normalizedUrl.includes('/profile')) return 'PROFILE';
    if (normalizedUrl.includes('/welcome')) return 'DASHBOARD';

    return 'DASHBOARD';
  }
}
