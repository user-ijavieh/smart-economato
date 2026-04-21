import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderStatus } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-order-details-admin-modal',
  standalone: true,
  imports: [CommonModule, BaseModalComponent],
  templateUrl: './order-details-admin-modal.component.html',
  styleUrl: './order-details-admin-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailsAdminModalComponent implements OnInit, OnDestroy {
  @Input() order: Order | null = null;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<Order>();
  @Output() revert = new EventEmitter<Order>();

  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  messageService = inject(MessageService);

  visibleLines = 20;
  readonly linesStep = 20;
  


  ngOnInit(): void {
    if (this.order) {
      this.loadFullOrder(this.order.id);
    }
  }

  ngOnDestroy(): void {
  }

  loadFullOrder(orderId: number): void {
    this.orderService.getById(orderId).subscribe({
      next: (fullOrder) => {
        this.order = this.normalizeOrderPayload(fullOrder as any);
        this.cdr.markForCheck();
      }
    });
  }

  private normalizeOrderPayload(order: any): Order {
    const details = Array.isArray(order?.details)
      ? order.details.map((detail: any) => ({
          ...detail,
          quantityReceived: this.getReceivedQuantity(detail)
        }))
      : [];

    return {
      ...order,
      details
    } as Order;
  }

  private getReceivedQuantity(detail: any): number | null {
    const raw = detail?.quantityReceived ?? detail?.quantityRecieved ?? detail?.quantity_received;
    if (raw === undefined || raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  get visibleDetails() {
    return (this.order?.details || []).slice(0, this.visibleLines);
  }

  get hasMoreDetails(): boolean {
    return (this.order?.details?.length || 0) > this.visibleLines;
  }

  loadMoreLines(): void {
    this.visibleLines += this.linesStep;
  }

  onClose(): void {
    this.close.emit();
  }

  onStatusChange(): void {
    if (this.order) {
      this.statusChange.emit(this.order);
    }
  }

  onRevert(): void {
    if (this.order) {
      this.revert.emit(this.order);
    }
  }

  onDownloadPdf(): void {
    if (!this.order || !this.order.id) return;
    this.orderService.downloadPdf(this.order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orden-${this.order!.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.messageService.showSuccess('PDF descargado correctamente');
      },
      error: () => this.messageService.showError('Error al generar el PDF')
    });
  }





  // ── Format Helpers ──
  formatStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'Creada', PENDING: 'Pendiente', REVIEW: 'Revisión',
      CONFIRMED: 'Confirmada', INCOMPLETE: 'Incompleta', CANCELLED: 'Cancelada'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'status-created', PENDING: 'status-pending', REVIEW: 'status-review',
      CONFIRMED: 'status-confirmed', INCOMPLETE: 'status-incomplete', CANCELLED: 'status-cancelled'
    };
    return map[status] || '';
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  shouldShowReceivedColumn(): boolean {
    if (!this.order) return false;
    if (this.order.status === 'CONFIRMED' || this.order.status === 'INCOMPLETE') return true;
    return (this.order.details || []).some(d => d.quantityReceived !== undefined && d.quantityReceived !== null);
  }
}
