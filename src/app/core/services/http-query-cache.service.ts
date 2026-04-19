import { Injectable } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';

export type CacheDomain =
  | 'product'
  | 'supplier'
  | 'recipe'
  | 'order'
  | 'weekly_plan'
  | 'ledger'
  | 'batch'
  | 'stock_alerts';

interface CacheEntry<T> {
  value$: Observable<T>;
  createdAt: number;
  domain: CacheDomain;
}

@Injectable({ providedIn: 'root' })
export class HttpQueryCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly domainIndex = new Map<CacheDomain, Set<string>>();
  private readonly maxEntries = 300;

  getOrFetch<T>(domain: CacheDomain, key: string, fetcher: () => Observable<T>): Observable<T> {
    const cacheKey = this.buildCacheKey(domain, key);
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached) {
      return cached.value$;
    }

    const value$ = fetcher().pipe(
      catchError(error => {
        this.deleteByCacheKey(cacheKey, domain);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache.set(cacheKey, {
      value$,
      createdAt: Date.now(),
      domain
    });

    const domainKeys = this.domainIndex.get(domain) ?? new Set<string>();
    domainKeys.add(cacheKey);
    this.domainIndex.set(domain, domainKeys);

    this.evictOldestEntriesIfNeeded();

    return value$;
  }

  invalidateDomain(domain: CacheDomain): void {
    const keys = this.domainIndex.get(domain);
    if (!keys) {
      return;
    }

    for (const cacheKey of keys) {
      this.cache.delete(cacheKey);
    }

    this.domainIndex.delete(domain);
  }

  invalidateDomains(domains: CacheDomain[]): void {
    for (const domain of domains) {
      this.invalidateDomain(domain);
    }
  }

  invalidateEntry(domain: CacheDomain, key: string): void {
    const cacheKey = this.buildCacheKey(domain, key);
    const domainKeys = this.domainIndex.get(domain);
    if (domainKeys) {
      domainKeys.delete(cacheKey);
      if (domainKeys.size === 0) {
        this.domainIndex.delete(domain);
      }
    }

    this.cache.delete(cacheKey);
  }

  clearAll(): void {
    this.cache.clear();
    this.domainIndex.clear();
  }

  private buildCacheKey(domain: CacheDomain, key: string): string {
    return `${domain}::${key}`;
  }

  private deleteByCacheKey(cacheKey: string, domain: CacheDomain): void {
    this.cache.delete(cacheKey);
    const keys = this.domainIndex.get(domain);
    if (!keys) {
      return;
    }

    keys.delete(cacheKey);
    if (keys.size === 0) {
      this.domainIndex.delete(domain);
    }
  }

  private evictOldestEntriesIfNeeded(): void {
    if (this.cache.size <= this.maxEntries) {
      return;
    }

    const excessEntries = this.cache.size - this.maxEntries;
    const oldest = [...this.cache.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, excessEntries);

    for (const [cacheKey, entry] of oldest) {
      this.deleteByCacheKey(cacheKey, entry.domain);
    }
  }
}
