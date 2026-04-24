import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { Order, OrderStatus } from '../../../shared/models/order.model';
import { OrderDetailsModalComponent } from '../orders/order-details-modal/order-details-modal.component';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
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

  // Paginación por sección
  pages: Record<string, number> = {
    PENDING: 0,
    REVIEW: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    INCOMPLETE: 0
  };

  hasMoreByStatus: Record<string, boolean> = {
    PENDING: false,
    REVIEW: false,
    CONFIRMED: false,
    CANCELLED: false,
    INCOMPLETE: false
  };

  ngOnInit(): void {
    this.loadOrders();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('order')) {
          this.loadOrders();
        }
      });


  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    const statuses: (keyof OrdersByStatus)[] = ['PENDING', 'REVIEW', 'CONFIRMED', 'CANCELLED', 'INCOMPLETE'];
    statuses.forEach(status => this.loadStatus(status, 0));
  }

  loadStatus(status: keyof OrdersByStatus, page: number, append: boolean = false): void {
    if (!append) {
      this.loading = true;
    }
    
    this.orderService.getByStatus(status, page, 1).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        const normalizeOrders = (orders: any[]): Order[] => orders.map(order => this.normalizeOrderPayload(order));
        let newOrders: Order[] = [];
        
        if (response && Array.isArray(response.content)) {
          newOrders = normalizeOrders(response.content);
          this.hasMoreByStatus[status] = !response.last;
        } else if (Array.isArray(response)) {
          newOrders = normalizeOrders(response);
          this.hasMoreByStatus[status] = false;
        }

        if (append) {
          // Filtrar duplicados preventivamente
          const existingIds = new Set(this.ordersByStatus[status].map(o => o.id));
          const uniqueNewOrders = newOrders.filter(o => !existingIds.has(o.id));
          this.ordersByStatus[status] = [...this.ordersByStatus[status], ...uniqueNewOrders];
        } else {
          this.ordersByStatus[status] = newOrders;
        }
        
        this.pages[status] = page;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError(`Error al cargar órdenes (${status})`);
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
    const statuses: (keyof OrdersByStatus)[] = ['PENDING', 'REVIEW', 'CONFIRMED', 'CANCELLED', 'INCOMPLETE'];
    statuses.forEach(s => {
      this.pages[s] = 0;
      this.hasMoreByStatus[s] = false;
    });
  }

  getDisplayedOrders(status: string): Order[] {
    return (this.ordersByStatus as any)[status] || [];
  }

  hasMore(status: string): boolean {
    return this.hasMoreByStatus[status] || false;
  }

  loadMoreOrders(status: string): void {
    const nextPage = this.pages[status] + 1;
    this.loadStatus(status as keyof OrdersByStatus, nextPage, true);
  }

  getRemainingCount(status: string): number {
    return 0; // Ya no aplica con paginación de servidor pura
  }





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
