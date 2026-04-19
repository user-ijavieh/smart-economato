import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, catchError, tap, throwError, of, filter, groupBy, mergeMap, concatMap, finalize, shareReplay } from 'rxjs';
import { OrderService } from './order.service';
import { WebSocketService } from './websocket.service';
import { OrderReviewLockStatus } from '../../shared/models/order.model';
import { SyncEvent } from '../../shared/models/sync-event.model';

@Injectable({ providedIn: 'root' })
export class OrderReviewLockStateService {
  private readonly orderService = inject(OrderService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly storageKey = 'order_review_locks';

  private readonly stateSubject = new BehaviorSubject<Record<number, OrderReviewLockStatus>>(this.loadPersistedState());
  readonly state$ = this.stateSubject.asObservable();

  private initialized = false;
  private syncSubscription?: Subscription;
  private readonly refreshInFlight = new Map<number, Observable<OrderReviewLockStatus>>();

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    // Process sync events grouped by entityId to prevent HTTP latency race conditions
    this.syncSubscription = this.webSocketService.syncEvents$.pipe(
      filter(event => !!this.isLockEvent(event) && event.entityId !== null),
      groupBy(event => event.entityId as number),
      mergeMap(group$ => group$.pipe(
        concatMap(event => this.refresh(event.entityId as number).pipe(
          catchError(() => of(null)) // Ignore refresh errors in the queue
        ))
      ))
    ).subscribe();
  }

  destroy(): void {
    this.syncSubscription?.unsubscribe();
    this.syncSubscription = undefined;
    this.initialized = false;
    this.stateSubject.next({});
    sessionStorage.removeItem(this.storageKey);
  }

  watchOrder(orderId: number): Observable<OrderReviewLockStatus | null> {
    return new Observable<OrderReviewLockStatus | null>(subscriber => {
      const emit = (state: Record<number, OrderReviewLockStatus>): void => {
        subscriber.next(state[orderId] ?? null);
      };

      emit(this.stateSubject.value);
      const sub = this.state$.subscribe(emit);

      return () => sub.unsubscribe();
    });
  }

  getSnapshot(orderId: number): OrderReviewLockStatus | null {
    return this.stateSubject.value[orderId] ?? null;
  }

  refresh(orderId: number): Observable<OrderReviewLockStatus> {
    const existing = this.refreshInFlight.get(orderId);
    if (existing) {
      return existing;
    }

    const request$ = this.orderService.getReviewLockStatus(orderId).pipe(
      tap(status => this.upsert(status)),
      catchError(err => {
        return throwError(() => err);
      }),
      finalize(() => this.refreshInFlight.delete(orderId)),
      shareReplay(1)
    );

    this.refreshInFlight.set(orderId, request$);
    return request$;
  }

  acquire(orderId: number): Observable<OrderReviewLockStatus> {
    return this.orderService.acquireReviewLock(orderId).pipe(
      tap(status => this.upsert(status))
    );
  }

  heartbeat(orderId: number): Observable<OrderReviewLockStatus> {
    return this.orderService.heartbeatReviewLock(orderId).pipe(
      tap(status => this.upsert(status))
    );
  }

  release(orderId: number): Observable<OrderReviewLockStatus> {
    return this.orderService.releaseReviewLock(orderId).pipe(
      tap(status => this.upsert(status))
    );
  }

  private isLockEvent(event: SyncEvent): boolean {
    return event.entityType?.toLowerCase() === 'order' && (
      event.action === 'LOCK_ACQUIRED'
      || event.action === 'LOCK_RELEASED'
      || event.action === 'LOCK_EXPIRED'
    );
  }

  private upsert(status: OrderReviewLockStatus): void {
    const next = {
      ...this.stateSubject.value,
      [status.orderId]: status,
    };

    if (!status.locked) {
      delete next[status.orderId];
    }

    this.stateSubject.next(next);
    this.persist(next);
  }

  private remove(orderId: number): void {
    const next = { ...this.stateSubject.value };
    delete next[orderId];
    this.stateSubject.next(next);
    this.persist(next);
  }

  private loadPersistedState(): Record<number, OrderReviewLockStatus> {
    const raw = sessionStorage.getItem(this.storageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, OrderReviewLockStatus>;
      const normalized: Record<number, OrderReviewLockStatus> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const id = Number(key);
        if (!Number.isNaN(id) && value && typeof value === 'object') {
          normalized[id] = value;
        }
      });
      return normalized;
    } catch {
      return {};
    }
  }

  private persist(state: Record<number, OrderReviewLockStatus>): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(state));
  }
}
