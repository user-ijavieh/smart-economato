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
  COMPLETED: Order[];
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
    COMPLETED: [],
    CANCELLED: [],
    INCOMPLETE: []
  };

  loading = false;
  showDetailsModal = false;
  selectedOrder: Order | null = null;

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    // Load all orders except CREATED (which are shown in Pedidos)
    this.orderService.getAll(0, 200).subscribe({
      next: (orders) => {
        // Group orders by status
        this.ordersByStatus = {
          PENDING: orders.filter(o => o.status === 'PENDING'),
          REVIEW: orders.filter(o => o.status === 'REVIEW'),
          COMPLETED: orders.filter(o => o.status === 'COMPLETED'),
          CANCELLED: orders.filter(o => o.status === 'CANCELLED'),
          INCOMPLETE: orders.filter(o => o.status === 'INCOMPLETE')
        };
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
      COMPLETED: 'Completado',
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
      COMPLETED: '#10b981',
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

  // Action handlers
  reviewOrder(order: Order): void {
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

  confirmOrder(order: Order): void {
    this.orderService.updateStatus(order.id, 'COMPLETED').subscribe({
      next: () => {
        this.messageService.showSuccess('Orden confirmada');
        this.loadOrders();
      },
      error: () => {
        this.messageService.showError('Error al confirmar orden');
      }
    });
  }

  markIncomplete(order: Order): void {
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

  cancelOrder(order: Order): void {
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

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrder = null;
  }
}
