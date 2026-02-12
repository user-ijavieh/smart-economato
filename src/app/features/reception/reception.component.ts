import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { MessageService } from '../../core/services/message.service';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { OrderDetailsModalComponent } from '../orders/order-details-modal/order-details-modal.component';

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
  imports: [CommonModule, FormsModule, OrderDetailsModalComponent],
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
    // Load all orders except CREATED (which are shown in Pedidos)
    this.orderService.getAll(0, 200).subscribe({
      next: (orders) => {
        // Ordenar las órdenes de más reciente a más antigua
        const sortedOrders = orders.sort((a, b) => b.id - a.id);
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
      REVIEW: 'En Revisión',
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

  getUserInitials(user: { name: string }): string {
    if (!user || !user.name) return 'U';
    return user.name.substring(0, 2).toUpperCase();
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

  async confirmOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar orden',
      `¿Confirmar la orden #${order.id}? Esto guardará el stock en el sistema.`
    );

    if (!confirmed) {
      return;
    }

    // Construir el request de recepción con las cantidades recibidas
    const receptionRequest = {
      orderId: order.id,
      status: 'CONFIRMED' as const,
      items: (order.details || []).map(detail => ({
        productId: detail.productId,
        quantityReceived: detail.quantityReceived || detail.quantity // Usar cantidad recibida o la solicitada
      }))
    };

    this.orderService.processReception(receptionRequest).subscribe({
      next: () => {
        this.messageService.showSuccess('Orden confirmada y stock actualizado');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al confirmar orden');
      }
    });
  }

  async markIncomplete(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Marcar como incompleta',
      `¿Marcar la orden #${order.id} como incompleta?`
    );

    if (!confirmed) {
      return;
    }
    
    this.orderService.updateStatus(order.id, 'INCOMPLETE').subscribe({
      next: () => {
        this.messageService.showWarning('Orden marcada como incompleta');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al marcar como incompleta');
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
