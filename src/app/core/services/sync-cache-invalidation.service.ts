import { Injectable, inject } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { HttpQueryCacheService, CacheDomain } from './http-query-cache.service';
import { WebSocketService } from './websocket.service';
import { SyncAffectedDomain, SyncEvent } from '../../shared/models/sync-event.model';

@Injectable({ providedIn: 'root' })
export class SyncCacheInvalidationService {
  private readonly cacheService = inject(HttpQueryCacheService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly usernameKey = 'user_username';
  private subscription?: Subscription;
  private initialized = false;

  private readonly invalidatedDomainsSubject = new Subject<{domains: string[], event: SyncEvent}>();
  readonly invalidatedDomains$ = this.invalidatedDomainsSubject.asObservable();

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.subscription = this.webSocketService.syncEvents$.subscribe(event => {
      const cacheDomains = event.affectedDomains
        .map(domain => this.mapToCacheDomain(domain))
        .filter((domain): domain is CacheDomain => domain !== null);

      if (event.entityIds && event.entityIds.length > 0) {
        this.invalidateGranular(event.entityType, event.entityIds, cacheDomains);
      } else if (cacheDomains.length > 0) {
        this.cacheService.invalidateDomains(cacheDomains);
      }
      
      this.invalidatedDomainsSubject.next({ domains: event.affectedDomains, event });
    });
  }

  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.initialized = false;
  }

  private mapToCacheDomain(domain: SyncAffectedDomain): CacheDomain | null {
    switch (domain) {
      case 'product':
      case 'supplier':
      case 'recipe':
      case 'order':
      case 'weekly_plan':
      case 'ledger':
      case 'batch':
      case 'stock_alerts':
        return domain;
      case 'user':
        return 'weekly_plan';
      case 'config':
      case 'allergen':
        return 'product';
      case 'incident':
        return null;
      default:
        return null;
    }
  }

  private invalidateGranular(entityType: string, entityIds: number[], domains: CacheDomain[]): void {
    if (entityType === 'ledger' || (domains.includes('product') && entityIds.length > 0)) {
      for (const productId of entityIds) {
        this.cacheService.invalidateEntry('product', `byId:${productId}`);
      }

      this.cacheService.invalidateDomain('product');

      const otherDomains = domains.filter(domain => domain !== 'product');
      if (otherDomains.length > 0) {
        this.cacheService.invalidateDomains(otherDomains);
      }
      return;
    }

    this.cacheService.invalidateDomains(domains);
  }
}
