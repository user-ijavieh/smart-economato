import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { filter, takeUntil } from 'rxjs/operators';

export interface QueuedRequest {
  id: number;
  method: string;
  url: string;
  body?: any;
  timestamp: number;
  retries?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineSyncService {
  private readonly DB_NAME = 'SmartEconomatoDB';
  private readonly STORE_NAME = 'sync-queue';
  
  private isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);
  private syncInProgress$ = new BehaviorSubject<boolean>(false);
  private queuedRequests$ = new BehaviorSubject<QueuedRequest[]>([]);
  private syncComplete$ = new Subject<{ success: boolean; url: string }>();
  
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {
    this.initializeDB();
    this.setupOnlineOfflineListeners();
    this.setupSyncMessageListener();
    this.loadQueuedRequests();
  }

  /**
   * Initialize IndexedDB
   */
  private initializeDB(): void {
    const request = indexedDB.open(this.DB_NAME, 1);

    request.onerror = () => {
      console.error('[OfflineSync] Error opening DB');
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
      }
    };
  }

  /**
   * Setup online/offline listeners
   */
  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline$.next(true);
      console.log('[OfflineSync] Back online. Syncing queued requests...');
      this.syncQueuedRequests();
    });

    window.addEventListener('offline', () => {
      this.isOnline$.next(false);
      console.log('[OfflineSync] Going offline. Requests will be queued.');
    });
  }

  /**
   * Listen for sync messages from Service Worker
   */
  private setupSyncMessageListener(): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          this.syncComplete$.next({
            success: event.data.success,
            url: event.data.url,
          });
          this.loadQueuedRequests();
        }
      });
    }
  }

  /**
   * Get observables
   */
  isOnline(): Observable<boolean> {
    return this.isOnline$.asObservable();
  }

  isSyncInProgress(): Observable<boolean> {
    return this.syncInProgress$.asObservable();
  }

  getQueuedRequests(): Observable<QueuedRequest[]> {
    return this.queuedRequests$.asObservable();
  }

  onSyncComplete(): Observable<{ success: boolean; url: string }> {
    return this.syncComplete$.asObservable();
  }

  /**
   * Queue a request for later sync
   */
  async queueRequest(
    method: string,
    url: string,
    body?: any
  ): Promise<QueuedRequest> {
    const queuedRequest: QueuedRequest = {
      id: Date.now(),
      method,
      url,
      body,
      timestamp: Date.now(),
      retries: 0,
    };

    try {
      const db = await this.openDB();
      db.put(this.STORE_NAME, queuedRequest);
      this.loadQueuedRequests();
      console.log('[OfflineSync] Request queued:', url);
      return queuedRequest;
    } catch (error) {
      console.error('[OfflineSync] Error queuing request:', error);
      throw error;
    }
  }

  /**
   * Load all queued requests from IndexedDB
   */
  private async loadQueuedRequests(): Promise<void> {
    try {
      const db = await this.openDB();
      const requests = await db.getAll(this.STORE_NAME);
      this.queuedRequests$.next(requests);
    } catch (error) {
      console.error('[OfflineSync] Error loading queued requests:', error);
    }
  }

  /**
   * Manually trigger sync
   */
  async syncQueuedRequests(): Promise<void> {
    if (this.syncInProgress$.value || !this.isOnline$.value) {
      return;
    }

    this.syncInProgress$.next(true);

    try {
      const db = await this.openDB();
      const requests = await db.getAll(this.STORE_NAME);

      if (requests.length === 0) {
        this.syncInProgress$.next(false);
        return;
      }

      for (const req of requests) {
        try {
          const response = await this.http
            .request(req.method, req.url, {
              body: req.body,
              observe: 'response',
            })
            .toPromise();

          if (response?.status && response.status >= 200 && response.status < 300) {
            await db.delete(this.STORE_NAME, req.id);
            this.syncComplete$.next({ success: true, url: req.url });
            console.log('[OfflineSync] Synced:', req.url);
          }
        } catch (error) {
          req.retries = (req.retries || 0) + 1;
          if (req.retries > 3) {
            await db.delete(this.STORE_NAME, req.id);
            this.syncComplete$.next({ success: false, url: req.url });
          } else {
            await db.put(this.STORE_NAME, req);
          }
          console.warn('[OfflineSync] Error syncing request, retrying later:', error);
        }
      }

      this.loadQueuedRequests();
    } catch (error) {
      console.error('[OfflineSync] Error in sync process:', error);
    } finally {
      this.syncInProgress$.next(false);
    }
  }

  /**
   * Clear all queued requests
   */
  async clearQueue(): Promise<void> {
    try {
      const db = await this.openDB();
      await db.clear(this.STORE_NAME);
      this.loadQueuedRequests();
      console.log('[OfflineSync] Queue cleared');
    } catch (error) {
      console.error('[OfflineSync] Error clearing queue:', error);
    }
  }

  /**
   * Get a single queued request
   */
  async getQueuedRequest(id: number): Promise<QueuedRequest | undefined> {
    try {
      const db = await this.openDB();
      return await db.get(this.STORE_NAME, id);
    } catch (error) {
      console.error('[OfflineSync] Error getting queued request:', error);
      return undefined;
    }
  }

  /**
   * Helper: Open IndexedDB connection
   */
  private openDB(): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        resolve({
          get: (store: string, key: number) =>
            new Promise((res, rej) => {
              const tx = db.transaction(store, 'readonly');
              const req = tx.objectStore(store).get(key);
              req.onsuccess = () => res(req.result);
              req.onerror = () => rej(req.error);
            }),
          getAll: (store: string) =>
            new Promise((res, rej) => {
              const tx = db.transaction(store, 'readonly');
              const req = tx.objectStore(store).getAll();
              req.onsuccess = () => res(req.result || []);
              req.onerror = () => rej(req.error);
            }),
          put: (store: string, item: any) =>
            new Promise<void>((res, rej) => {
              const tx = db.transaction(store, 'readwrite');
              const req = tx.objectStore(store).put(item);
              req.onsuccess = () => res();
              req.onerror = () => rej(req.error);
            }),
          delete: (store: string, key: number) =>
            new Promise<void>((res, rej) => {
              const tx = db.transaction(store, 'readwrite');
              const req = tx.objectStore(store).delete(key);
              req.onsuccess = () => res();
              req.onerror = () => rej(req.error);
            }),
          clear: (store: string) =>
            new Promise<void>((res, rej) => {
              const tx = db.transaction(store, 'readwrite');
              const req = tx.objectStore(store).clear();
              req.onsuccess = () => res();
              req.onerror = () => rej(req.error);
            }),
        });
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
