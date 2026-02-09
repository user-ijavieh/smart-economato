import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { MessageService } from '../../core/services/message.service';
import { Order } from '../../shared/models/order.model';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);

  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  statusFilter = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getAll(0, 100).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = [...this.orders];
        this.loading = false;
      },
      error: () => {
        this.messageService.showError('Error al cargar pedidos');
        this.loading = false;
      }
    });
  }

  filterByStatus(): void {
    if (!this.statusFilter) {
      this.filteredOrders = [...this.orders];
      return;
    }
    this.filteredOrders = this.orders.filter(o => o.status === this.statusFilter);
  }

  showAll(): void {
    this.statusFilter = '';
    this.filteredOrders = [...this.orders];
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      CREATED: 'Creado',
      PENDING: 'Pendiente',
      REVIEW: 'En revisión',
      COMPLETED: 'Completado',
      INCOMPLETE: 'Incompleto'
    };
    return labels[status] || status;
  }

  getOrderTotal(order: Order): number {
    return order.details.reduce((sum, d) => sum + d.quantity * d.unitPrice, 0);
  }
}
