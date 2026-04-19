import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { Order, OrderStatus } from '../../../shared/models/order.model';
import { OrderModalComponent } from './order-modal/order-modal.component';
import { OrderDetailsModalComponent } from './order-details-modal/order-details-modal.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderModalComponent, OrderDetailsModalComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit, OnDestroy {
  public orders: Order[] = [];
  public loading = false;
  public showModal = false;
  public showDetailsModal = false;
  public selectedOrder: Order | null = null;
  public orderToEdit: Order | null = null;
  public prefillUserId: number | null = null;
  public prefillSupplierId: number | null = null;
  public prefillOrderItems: Array<{ productId: number; productName: string; unit: string; quantity: number; unitPrice: number }> = [];

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pendingOpenOrderId: number | null = null;
  private destroy$ = new Subject<void>();

  // Paginación
  public displayCount = 1;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const rawOrderId = params.get('openOrderId');
      const parsedOrderId = rawOrderId ? Number(rawOrderId) : NaN;
      this.pendingOpenOrderId = Number.isFinite(parsedOrderId) ? parsedOrderId : null;
      this.tryOpenOrderFromQueryParam();
    });

    this.loadOrders();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (!domains.includes('order')) {
          return;
        }

        this.loadOrders();
      });

    const orderPrefill = history.state?.orderPrefill;
    if (orderPrefill) {
      this.prefillUserId = orderPrefill.userId ?? null;
      this.prefillSupplierId = orderPrefill.supplierId ?? null;
      this.prefillOrderItems = orderPrefill.items || [];
      this.openCreateOrderModal();
      history.replaceState({}, '', this.router.url);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public loadOrders(): void {
    this.loading = true;
    // Load only CREATED orders
    this.orderService.getByStatus('CREATED').subscribe({
      next: (response) => {
        let ordersArray: Order[] = [];
        
        if (Array.isArray(response)) {
          ordersArray = response;
        } else if (response && Array.isArray((response as any).content)) {
          ordersArray = (response as any).content;
        }
        
        this.orders = [...ordersArray].sort((a, b) => b.id - a.id);
        this.displayCount = 1;
        this.tryOpenOrderFromQueryParam();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar pedidos');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  public openCreateOrderModal(): void {
    this.showModal = true;
  }

  public closeModal(): void {
    this.showModal = false;
    this.orderToEdit = null;
    this.prefillUserId = null;
    this.prefillSupplierId = null;
    this.prefillOrderItems = [];
    this.cdr.markForCheck();
  }

  public onOrderCreated(): void {
    this.loadOrders();
    this.closeModal();
  }

  public onOrderDeleted(): void {
    this.loadOrders();
    this.closeDetailsModal();
  }

  public onEditOrderRequested(order: Order): void {
    this.orderToEdit = order;
    this.closeDetailsModal();
    this.openCreateOrderModal();
  }

  // Paginación
  get displayedOrders(): Order[] {
    return this.orders.slice(0, this.displayCount);
  }

  get hasMoreOrders(): boolean {
    return this.displayCount < this.orders.length;
  }

  public loadMore(): void {
    this.displayCount += 10;
  }

  public getOrderTotal(order: Order): number {
    return (order.details || []).reduce((sum, d) => sum + d.quantity * d.unitPrice, 0);
  }

  public formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  public getStatusBgColor(status: OrderStatus): string {
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

  public async confirmOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar pedido',
      `¿Confirmar y enviar el pedido #${order.id} a recepción?`
    );

    if (!confirmed) {
      return;
    }

    this.orderService.updateStatus(order.id, 'PENDING').subscribe({
      next: () => {
        this.messageService.showSuccess('Pedido enviado a recepción');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al confirmar pedido');
      }
    });
  }

  public viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showDetailsModal = true;
  }

  private tryOpenOrderFromQueryParam(): void {
    if (!this.pendingOpenOrderId) return;

    const orderInList = this.orders.find(order => order.id === this.pendingOpenOrderId);
    if (orderInList) {
      this.viewOrderDetails(orderInList);
      this.clearOpenOrderQueryParam();
      return;
    }

    const targetOrderId = this.pendingOpenOrderId;
    this.orderService.getById(targetOrderId).subscribe({
      next: (order) => {
        this.viewOrderDetails(order);
        this.clearOpenOrderQueryParam();
      },
      error: () => {
        this.messageService.showError(`No se pudo abrir el pedido #${targetOrderId}.`);
        this.clearOpenOrderQueryParam();
      }
    });
  }

  private clearOpenOrderQueryParam(): void {
    this.pendingOpenOrderId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { openOrderId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrder = null;
  }

  public async printOrder(order: Order, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

    if (!order?.id) return;

    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.orderService.downloadPdf(order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pedido-${order.id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.messageService.showSuccess('PDF descargado correctamente');
      },
      error: (error) => {
        console.error('Error al descargar el PDF:', error);
        this.messageService.showError('Error al descargar el PDF');
      }
    });
  }
}
