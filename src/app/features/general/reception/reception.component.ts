import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { Order, OrderStatus } from '../../../shared/models/order.model';
import { OrderDetailsModalComponent } from '../orders/order-details-modal/order-details-modal.component';
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
export class ReceptionComponent implements OnInit {
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

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
  displayCounts: Record<string, number> = {
    PENDING: 1,
    REVIEW: 1,
    CONFIRMED: 1,
    CANCELLED: 1,
    INCOMPLETE: 1
  };

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getAll().subscribe({
      next: (response) => {
        // Verificar si la respuesta es un array directo o un objeto paginado
        let ordersArray: Order[] = [];
        if (Array.isArray(response)) {
          ordersArray = response;
        } else if (response && Array.isArray((response as any).content)) {
          // Respuesta paginada con estructura {content: [], ...}
          ordersArray = (response as any).content;
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
}
