import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, map, of, tap } from 'rxjs';
import { OrderService } from './order.service';
import { WebSocketService } from './websocket.service';
import { OrderReviewCollaborationState } from '../../shared/models/order.model';
import { SyncEvent } from '../../shared/models/sync-event.model';

@Injectable({ providedIn: 'root' })
export class OrderReviewCollaborationStateService {
  private readonly orderService = inject(OrderService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly usernameKey = 'user_username';

  private readonly stateSubject = new BehaviorSubject<Record<number, OrderReviewCollaborationState>>({});
  readonly state$ = this.stateSubject.asObservable();

  private subscription?: Subscription;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.subscription = this.webSocketService.syncEvents$.subscribe(event => {
      if (!this.isCollaborationEvent(event)) {
        return;
      }

      const orderId = typeof event.entityId === 'number' ? event.entityId : null;
      if (!orderId) {
        return;
      }

      if (event.action === 'COLLAB_STATE_CLEARED') {
        this.removeOrderState(orderId);
        return;
      }

      if (event.action === 'COLLAB_FIELD_PATCHED' && event.metadata) {
        this.applyPatchMetadata(orderId, event);
        return;
      }

      if (event.action === 'COLLAB_FIELD_UNLOCKED' && event.metadata) {
        this.applyUnlockMetadata(orderId, event);
        return;
      }

      this.refresh(orderId).subscribe({ error: () => {} });
    });
  }

  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.initialized = false;
    this.stateSubject.next({});
  }

  watchOrder(orderId: number): Observable<OrderReviewCollaborationState | null> {
    return this.state$.pipe(map(state => state[orderId] ?? null));
  }

  getSnapshot(orderId: number): OrderReviewCollaborationState | null {
    return this.stateSubject.value[orderId] ?? null;
  }

  refresh(orderId: number): Observable<OrderReviewCollaborationState> {
    return this.orderService.getReviewCollaborationState(orderId).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  requestSharedReview(orderId: number): Observable<OrderReviewCollaborationState> {
    return this.orderService.requestSharedReview(orderId).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  admitSharedReview(orderId: number, userId: number): Observable<OrderReviewCollaborationState> {
    return this.orderService.admitSharedReview(orderId, userId).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  lockField(orderId: number, fieldPath: string): Observable<OrderReviewCollaborationState> {
    return this.orderService.lockReviewCollaborationField(orderId, fieldPath).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  unlockField(orderId: number, fieldPath: string): Observable<OrderReviewCollaborationState> {
    return this.orderService.unlockReviewCollaborationField(orderId, fieldPath).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  patchField(orderId: number, fieldPath: string, value: unknown): Observable<OrderReviewCollaborationState> {
    return this.orderService.patchReviewCollaborationField(orderId, fieldPath, value).pipe(
      tap(state => this.updateOrderState(orderId, state))
    );
  }

  private isCollaborationEvent(event: SyncEvent): boolean {
    return event.entityType?.toLowerCase() === 'order_collab';
  }

  private applyPatchMetadata(orderId: number, event: SyncEvent): void {
    const metadata = event.metadata ?? {};
    const fieldPath = typeof metadata['fieldPath'] === 'string' ? metadata['fieldPath'] : null;

    if (!fieldPath) {
      this.refresh(orderId).subscribe({ error: () => {} });
      return;
    }

    const current = this.getSnapshot(orderId);
    if (!current) {
      this.refresh(orderId).subscribe({ error: () => {} });
      return;
    }

    const changedByCurrentUser = (event.changedBy || '').toLowerCase() === (localStorage.getItem(this.usernameKey) || '').toLowerCase();
    if (changedByCurrentUser) {
      return;
    }

    const updated: OrderReviewCollaborationState = {
      ...current,
      fieldValues: {
        ...(current.fieldValues || {}),
        [fieldPath]: metadata['value']
      }
    };
    this.updateOrderState(orderId, updated);
  }

  private applyUnlockMetadata(orderId: number, event: SyncEvent): void {
    const metadata = event.metadata ?? {};
    const fieldPath = typeof metadata['fieldPath'] === 'string' ? metadata['fieldPath'] : null;

    if (!fieldPath) {
      this.refresh(orderId).subscribe({ error: () => {} });
      return;
    }

    const current = this.getSnapshot(orderId);
    if (!current) {
      this.refresh(orderId).subscribe({ error: () => {} });
      return;
    }

    const updated: OrderReviewCollaborationState = {
      ...current,
      fieldLocks: (current.fieldLocks || []).filter(lock => lock.fieldPath !== fieldPath)
    };
    this.updateOrderState(orderId, updated);
  }

  private updateOrderState(orderId: number, state: OrderReviewCollaborationState): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      [orderId]: {
        ...state,
        collaborators: state.collaborators || [],
        pendingRequests: state.pendingRequests || [],
        fieldLocks: state.fieldLocks || [],
        fieldValues: state.fieldValues || {}
      }
    });
  }

  private removeOrderState(orderId: number): void {
    const current = { ...this.stateSubject.value };
    delete current[orderId];
    this.stateSubject.next(current);
  }
}
