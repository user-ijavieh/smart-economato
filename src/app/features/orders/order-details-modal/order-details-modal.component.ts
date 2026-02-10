import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../shared/models/order.model';

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-details-modal.component.html',
  styleUrl: './order-details-modal.component.css'
})
export class OrderDetailsModalComponent {
  @Input() order: Order | null = null;
  @Output() closeModal = new EventEmitter<void>();

  close(): void {
    this.closeModal.emit();
  }

  getOrderTotal(): number {
    if (!this.order) return 0;
    return (this.order.details || []).reduce((sum, detail) => 
      sum + (detail.quantity * detail.unitPrice), 0
    );
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'CREATED': 'Creado',
      'PENDING': 'Pendiente',
      'REVIEW': 'En Revisión',
      'CONFIRMED': 'Confirmado',
      'INCOMPLETE': 'Incompleto',
      'CANCELLED': 'Cancelado'
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'CREATED': '#3b82f6',
      'PENDING': '#f59e0b',
      'REVIEW': '#8b5cf6',
      'CONFIRMED': '#10b981',
      'INCOMPLETE': '#6b7280',
      'CANCELLED': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }
}
