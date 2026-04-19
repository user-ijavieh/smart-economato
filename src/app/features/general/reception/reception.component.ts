import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { Order, OrderReviewLockStatus, OrderStatus } from '../../../shared/models/order.model';
import { OrderDetailsModalComponent } from '../orders/order-details-modal/order-details-modal.component';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { OrderReviewLockStateService } from '../../../core/services/order-review-lock-state.service';
// DESHABILITADO: import { OrderReviewCollaborationStateService } from '../../../core/services/order-review-collaboration-state.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Subject, takeUntil } from 'rxjs';
import { OrderReceptionModalComponent } from './order-reception-modal/order-reception-modal.component';
interface OrdersByStatus {
  PENDING: Order[];
  REVIEW: Order[];
  CONFIRMED: Order[];
  CANCELLED: Order[];
  INCOMPLETE: Order[];
}

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetailsModalComponent, OrderReceptionModalComponent],
  templateUrl: './reception.component.html',
  styleUrl: './reception.component.css'
})
export class ReceptionComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private orderReviewLockStateService = inject(OrderReviewLockStateService);
  // DESHABILITADO: private orderReviewCollaborationStateService = inject(OrderReviewCollaborationStateService);
  private webSocketService = inject(WebSocketService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  ordersByStatus: OrdersByStatus = {
    PENDING: [],
    REVIEW: [],
    CONFIRMED: [],
    CANCELLED: [],
    INCOMPLETE: []
  };

  loading = false;
  showDetailsModal = false;
  showReceptionModal = false;
  selectedOrder: Order | null = null;
  reviewLocks: Record<number, OrderReviewLockStatus> = {};

  // Paginación por sección
  displayCounts: Record<string, number> = {
    PENDING: 1,
    REVIEW: 1,
    CONFIRMED: 1,
    CANCELLED: 1,
    INCOMPLETE: 1
  };

  ngOnInit(): void {
    this.loadOrders();

    // DESHABILITADO: Sistema de locks y colaboración compartida
    /* this.orderReviewLockStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.reviewLocks = state;
        this.cdr.markForCheck();
      }); */

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('order')) {
          this.loadOrders();
        }
      });

    // DESHABILITADO: Sistema de locks y colaboración compartida
    /* this.webSocketService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isConnected => {
        if (!isConnected || this.ordersByStatus.REVIEW.length === 0) {
          return;
        }

        this.refreshReviewLocks(this.ordersByStatus.REVIEW);
      }); */
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getAll().subscribe({
      next: (response) => {
        const normalizeOrders = (orders: any[]): Order[] => orders.map(order => this.normalizeOrderPayload(order));

        // Verificar si la respuesta es un array directo o un objeto paginado
        let ordersArray: Order[] = [];
        if (Array.isArray(response)) {
          ordersArray = normalizeOrders(response);
        } else if (response && Array.isArray((response as any).content)) {
          // Respuesta paginada con estructura {content: [], ...}
          ordersArray = normalizeOrders((response as any).content);
        }

        // Ordenar las órdenes de más reciente a más antigua (creando una copia)
        const sortedOrders = [...ordersArray].sort((a, b) => b.id - a.id);
        this.ordersByStatus = {
          PENDING: sortedOrders.filter(o => o.status === 'PENDING'),
          REVIEW: sortedOrders.filter(o => o.status === 'REVIEW'),
          CONFIRMED: sortedOrders.filter(o => o.status === 'CONFIRMED'),
          CANCELLED: sortedOrders.filter(o => o.status === 'CANCELLED'),
          INCOMPLETE: sortedOrders.filter(o => o.status === 'INCOMPLETE')
        };
        this.refreshReviewLocks(this.ordersByStatus.REVIEW);
        this.resetDisplayCounts();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar órdenes');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      CREATED: 'Creado',
      PENDING: 'Pendiente',
      REVIEW: 'Revisión',
      CONFIRMED: 'Confirmado',
      CANCELLED: 'Cancelado',
      INCOMPLETE: 'Incompleto'
    };
    return labels[status];
  }

  getStatusColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      CREATED: '#3b82f6',
      PENDING: '#f59e0b',
      REVIEW: '#8b5cf6',
      CONFIRMED: '#10b981',
      CANCELLED: '#6b7280',
      INCOMPLETE: '#ef4444'
    };
    return colors[status];
  }

  getStatusBgColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      CREATED: 'rgba(59, 130, 246, 0.15)',
      PENDING: 'rgba(245, 158, 11, 0.15)',
      REVIEW: 'rgba(139, 92, 246, 0.15)',
      CONFIRMED: 'rgba(16, 185, 129, 0.15)',
      CANCELLED: 'rgba(107, 114, 128, 0.15)',
      INCOMPLETE: 'rgba(239, 68, 68, 0.15)'
    };
    return colors[status];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getOrderTotal(order: Order): number {
    return (order.details || []).reduce((sum, d) => sum + d.quantity * d.unitPrice, 0);
  }

  // Paginación
  resetDisplayCounts(): void {
    for (const key of Object.keys(this.displayCounts)) {
      this.displayCounts[key] = 1;
    }
  }

  getDisplayedOrders(status: string): Order[] {
    const orders = (this.ordersByStatus as any)[status] || [];
    return orders.slice(0, this.displayCounts[status] || 1);
  }

  hasMore(status: string): boolean {
    const orders = (this.ordersByStatus as any)[status] || [];
    return (this.displayCounts[status] || 1) < orders.length;
  }

  loadMoreOrders(status: string): void {
    this.displayCounts[status] = (this.displayCounts[status] || 1) + 10;
  }

  getRemainingCount(status: string): number {
    const orders = (this.ordersByStatus as any)[status] || [];
    return orders.length - (this.displayCounts[status] || 1);
  }

  getReviewLockInfo(order: Order): OrderReviewLockStatus | null {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return null; // Siempre sin bloqueo
    // return this.reviewLocks[order.id] ?? null;
  }

  isReviewBlocked(order: Order): boolean {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return false; // Siempre permite acceso
    /* const lock = this.getReviewLockInfo(order);
    return !!lock?.locked && !lock.currentUserOwner && !lock.currentUserAdmin; */
  }

  getReviewLockLabel(order: Order): string {
    const lock = this.getReviewLockInfo(order);
    if (!lock?.locked) {
      return '';
    }

    if (lock.currentUserOwner) {
      return 'Bloqueo activo';
    }

    const owner = lock.lockedByDisplayName || lock.lockedByUsername || 'Otro usuario';
    if (lock.currentUserAdmin) {
      return `Revisión compartida`;
    }

    return 'Revisión en curso';
  }

  getReviewLockDetail(order: Order): string {
    const lock = this.getReviewLockInfo(order);
    if (!lock?.locked) {
      return '';
    }

    const owner = lock.lockedByDisplayName || lock.lockedByUsername || 'Otro usuario';

    if (lock.currentUserOwner) {
      return 'Se liberará al salir de esta ventana.';
    }

    if (lock.currentUserAdmin) {
      return `${owner} la está revisando. Puedes continuar y confirmar en paralelo como ADMIN.`;
    }

    return `${owner} está revisando esta orden en este momento.`;
  }

  /* DESHABILITADO: canRequestCollaborationFromList feature
  canRequestCollaborationFromList(order: Order): boolean {
    const lock = this.getReviewLockInfo(order);
    if (!lock?.locked) {
      return false;
    }

    if (lock.currentUserOwner || lock.currentUserAdmin) {
      return false;
    }

    return true;
  }
  */

  // Action handlers
  async reviewOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Mover a revisión',
      `¿Mover la orden #${order.id} a revisión?`
    );

    if (!confirmed) {
      return;
    }

    this.messageService.showInfo(`Revisando orden #${order.id}`);
    // Change status from PENDING to REVIEW
    this.orderService.updateStatus(order.id, 'REVIEW').subscribe({
      next: () => {
        this.messageService.showSuccess('Orden movida a revisión');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al actualizar estado');
      }
    });
  }

  openReceptionModal(order: Order): void {
    this.selectedOrder = order;
    this.showReceptionModal = true;
  }

  /* DESHABILITADO: requestCollaborationFromList feature
  requestCollaborationFromList(order: Order): void {
    this.orderReviewCollaborationStateService.requestSharedReview(order.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Solicitud de colaboración enviada.');
      },
      error: () => {
        this.messageService.showError('Error al enviar solicitud de colaboración.');
      }
    });
  }
  */

  closeReceptionModal(): void {
    this.showReceptionModal = false;
    this.selectedOrder = null;
  }

  reclamarFaltantes(order: Order): void {
    this.orderService.getMissingItems(order.id).subscribe({
      next: async (missingItems) => {
        if (!missingItems || missingItems.length === 0) {
          this.messageService.showInfo('No hay items faltantes para esta orden.');
          return;
        }

        const itemsList = missingItems.map(item => `- ${item.productName}: ${item.quantity} uds`).join('\n');

        const confirmed = await this.messageService.confirm(
          'Reclamar Faltantes',
          `Los siguientes productos faltan de esta orden:\n\n${itemsList}\n\n¿Deseas crear una nueva orden con estos productos faltantes?`
        );

        if (confirmed) {
          const newOrderRequest: import('../../../shared/models/order.model').OrderRequest = {
            userId: order.userId,
            supplierId: order.supplierId,
            details: missingItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          };

          this.orderService.create(newOrderRequest).subscribe({
            next: () => {
              this.messageService.showSuccess('Nueva orden creada con los productos faltantes.');
              this.loadOrders();
            },
            error: () => {
              this.messageService.showError('Error al crear la nueva orden.');
            }
          });
        }
      },
      error: () => {
        this.messageService.showError('Error al obtener items faltantes.');
      }
    });
  }

  async cancelOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Cancelar orden',
      `¿Cancelar la orden #${order.id}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    this.orderService.updateStatus(order.id, 'CANCELLED').subscribe({
      next: () => {
        this.messageService.showWarning('Orden cancelada');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al cancelar orden');
      }
    });
  }

  async deleteOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Eliminar orden',
      `¿Eliminar permanentemente la orden #${order.id}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    this.orderService.delete(order.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Orden eliminada correctamente');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al eliminar orden');
      }
    });
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showDetailsModal = true;
  }

  private refreshReviewLocks(orders: Order[]): void {
    orders.forEach(order => {
      this.orderReviewLockStateService.refresh(order.id).subscribe({ error: () => {} });
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrder = null;
  }

  private normalizeOrderPayload(order: any): Order {
    const details = Array.isArray(order?.details)
      ? order.details.map((detail: any) => ({
          ...detail,
          quantityReceived: this.normalizeReceivedQuantity(detail)
        }))
      : [];

    return {
      ...order,
      details
    } as Order;
  }

  private normalizeReceivedQuantity(detail: any): number | undefined {
    const raw = detail?.quantityReceived ?? detail?.quantityRecieved ?? detail?.quantity_received;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
}
