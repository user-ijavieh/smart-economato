import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Order } from '../../../../shared/models/order.model';
import { OrderDetail } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule, BaseModalComponent, DecimalPipe],
  templateUrl: './order-details-modal.component.html',
  styleUrl: './order-details-modal.component.css'
})
export class OrderDetailsModalComponent implements OnChanges {
  @Input() order: Order | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() deleteOrder = new EventEmitter<number>();
  @Output() editOrderRequested = new EventEmitter<Order>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  isDownloading = false;
  visibleDetailsCount = 20;
  readonly detailsPageSize = 20;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      this.visibleDetailsCount = this.detailsPageSize;
    }
  }

  get displayedDetails() {
    return (this.order?.details || []).slice(0, this.visibleDetailsCount);
  }

  get hasMoreDetails(): boolean {
    return (this.order?.details?.length || 0) > this.visibleDetailsCount;
  }

  loadMoreDetails(): void {
    this.visibleDetailsCount += this.detailsPageSize;
  }

  shouldShowReceptionColumns(): boolean {
    if (!this.order) return false;
    if (this.order.status === 'CONFIRMED' || this.order.status === 'INCOMPLETE') return true;
    return (this.order.details || []).some(detail => detail.quantityReceived !== undefined && detail.quantityReceived !== null);
  }

  getReceivedQuantity(detail: OrderDetail): number | null {
    return detail.quantityReceived ?? null;
  }

  getQuantityDelta(detail: OrderDetail): number | null {
    const received = this.getReceivedQuantity(detail);
    if (received === null) return null;
    return received - detail.quantity;
  }

  getQuantityDeltaLabel(detail: OrderDetail): string {
    const delta = this.getQuantityDelta(detail);
    if (delta === null) return '—';
    if (delta === 0) return 'Exacto';
    if (delta > 0) return `Exceso +${delta}`;
    return `Faltante ${Math.abs(delta)}`;
  }

  getComparisonSymbol(detail: OrderDetail): string {
    const received = this.getReceivedQuantity(detail);
    if (received === null) return '';
    
    if (received === detail.quantity) {
      return '✓';
    } else if (received < detail.quantity) {
      return '✕';
    } else {
      return '▲';
    }
  }

  getFormattedQuantity(detail: OrderDetail): string {
    const received = this.getReceivedQuantity(detail);
    if (received === null) return `${detail.quantity} ${detail.unit || 'uds'}`;
    return `${detail.quantity} / ${received} ${detail.unit || 'uds'}`;
  }

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
      'CREATED': 'rgba(59, 130, 246, 0.25)',
      'PENDING': 'rgba(245, 158, 11, 0.25)',
      'REVIEW': 'rgba(139, 92, 246, 0.25)',
      'CONFIRMED': 'rgba(16, 185, 129, 0.25)',
      'INCOMPLETE': 'rgba(107, 114, 128, 0.25)',
      'CANCELLED': 'rgba(239, 68, 68, 0.25)'
    };
    return colors[status] || 'rgba(107, 114, 128, 0.25)';
  }

  async onEdit(): Promise<void> {
    if (!this.order) return;
    const confirmed = await this.messageService.confirm(
      'Editar pedido',
      `¿Deseas editar el pedido #${this.order.id}?`
    );
    if (confirmed) {
      this.editOrderRequested.emit(this.order);
    }
  }

  async onDelete(): Promise<void> {
    if (!this.order) return;
    const confirmed = await this.messageService.confirm(
      'Eliminar pedido',
      `¿Estás seguro de que deseas eliminar el pedido #${this.order.id}? Esta acción no se puede deshacer.`
    );
    if (confirmed) {
      this.orderService.delete(this.order.id).subscribe({
        next: () => {
          this.messageService.showSuccess('Pedido eliminado correctamente');
          this.deleteOrder.emit(this.order!.id);
        },
        error: () => {
          this.messageService.showError('Error al eliminar el pedido');
        }
      });
    }
  }

  async printOrder(): Promise<void> {
    if (!this.order?.id) return;

    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.isDownloading = true;
    this.orderService.downloadPdf(this.order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pedido-${this.order?.id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.messageService.showSuccess('PDF descargado correctamente');
        this.isDownloading = false;
      },
      error: (error) => {
        console.error('Error al descargar el PDF:', error);
        this.messageService.showError('Error al descargar el PDF');
        this.isDownloading = false;
      }
    });
  }
}
