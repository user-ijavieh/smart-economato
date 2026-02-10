import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { MessageService } from '../../core/services/message.service';
import { Order } from '../../shared/models/order.model';
import { OrderModalComponent } from './order-modal/order-modal.component';
import { OrderDetailsModalComponent } from './order-details-modal/order-details-modal.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderModalComponent, OrderDetailsModalComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  orders: Order[] = [];
  loading = false;
  showModal = false;
  showDetailsModal = false;
  selectedOrder: Order | null = null;

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    // Load only CREATED orders
    this.orderService.getByStatus('CREATED').subscribe({
      next: (orders) => {
        this.orders = orders;
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

  openCreateOrderModal(): void {
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  onOrderCreated(): void {
    this.loadOrders();
    this.showModal = false;
  }

  getOrderTotal(order: Order): number {
    return (order.details || []).reduce((sum, d) => sum + d.quantity * d.unitPrice, 0);
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

  confirmOrder(order: Order): void {
    if (!confirm(`¿Confirmar y enviar el pedido #${order.id} a recepción?`)) {
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

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrder = null;
  }

  printOrder(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (!order?.id) return;

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
