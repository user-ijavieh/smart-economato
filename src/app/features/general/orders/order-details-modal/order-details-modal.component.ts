import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Order, OrderDetail } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { LoggerService } from '../../../../core/services/logger.service';

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule, BaseModalComponent, DecimalPipe, TranslateModule],
  templateUrl: './order-details-modal.component.html',
  styleUrl: './order-details-modal.component.css'
})
export class OrderDetailsModalComponent implements OnChanges, OnDestroy {
  private logger = inject(LoggerService);
  @Input() order: Order | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() deleteOrder = new EventEmitter<number>();
  @Output() editOrderRequested = new EventEmitter<Order>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

  isDownloading = false;
  visibleDetailsCount = 20;
  readonly detailsPageSize = 20;
  roundingMode: 'units' | 'lots' = 'lots';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      this.visibleDetailsCount = this.detailsPageSize;
    }
  }

  ngOnDestroy(): void {
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
    if (delta === 0) return this.translate.instant('ORDERS.MODAL.DELTA_EXACT');
    if (delta > 0) return `${this.translate.instant('ORDERS.MODAL.DELTA_EXCESS')} +${delta}`;
    return `${this.translate.instant('ORDERS.MODAL.DELTA_MISSING')} ${Math.abs(delta)}`;
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

  getComparisonTitle(detail: OrderDetail): string {
    const symbol = this.getComparisonSymbol(detail);
    if (symbol === '✓') return 'ORDERS.MODAL.DELTA_EXACT_HINT';
    if (symbol === '✕') return 'ORDERS.MODAL.DELTA_MISSING_HINT';
    return 'ORDERS.MODAL.DELTA_EXCESS_HINT';
  }

  getFormattedQuantity(detail: OrderDetail): string {
    const received = this.getReceivedQuantity(detail);
    const unitLabel = detail.unit || this.translate.instant('COMMON.UNITS_SHORT') || 'uds';
    if (received === null) return `${detail.quantity} ${unitLabel}`;
    return `${detail.quantity} / ${received} ${unitLabel}`;
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
    return date.toLocaleDateString(this.translate.currentLang === 'es' ? 'es-ES' : 'en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'CREATED': this.translate.instant('ORDERS.STATUS.CREATED'),
      'PENDING': this.translate.instant('ORDERS.STATUS.PENDING'),
      'REVIEW': this.translate.instant('ORDERS.STATUS.REVIEW'),
      'CONFIRMED': this.translate.instant('ORDERS.STATUS.CONFIRMED'),
      'INCOMPLETE': this.translate.instant('ORDERS.STATUS.INCOMPLETE'),
      'CANCELLED': this.translate.instant('ORDERS.STATUS.CANCELLED')
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
      this.translate.instant('ORDERS.MESSAGES.EDIT_CONFIRM_TITLE'),
      this.translate.instant('ORDERS.MESSAGES.EDIT_CONFIRM_MSG', { id: this.order.id })
    );
    if (confirmed) {
      this.editOrderRequested.emit(this.order);
    }
  }

  async onDelete(): Promise<void> {
    if (!this.order) return;
    const confirmed = await this.messageService.confirm(
      this.translate.instant('ORDERS.MESSAGES.DELETE_CONFIRM_TITLE'),
      this.translate.instant('ORDERS.MESSAGES.DELETE_CONFIRM_MSG', { id: this.order.id })
    );
    if (confirmed) {
      this.orderService.delete(this.order.id).subscribe({
        next: () => {
          this.messageService.showSuccess(this.translate.instant('ORDERS.MESSAGES.DELETE_SUCCESS'));
          this.deleteOrder.emit(this.order!.id);
        },
        error: (err) => {
          this.logger.error('Error al eliminar el pedido:', err);
          this.messageService.showError(this.translate.instant('ORDERS.MESSAGES.DELETE_ERROR'));
        }
      });
    }
  }

  async printOrder(): Promise<void> {
    if (!this.order?.id) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('COMMON.PDF_CONFIRM_TITLE'),
      this.translate.instant('COMMON.PDF_CONFIRM_MSG')
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
        this.messageService.showSuccess(this.translate.instant('COMMON.PDF_SUCCESS'));
        this.isDownloading = false;
      },
      error: (error) => {
        this.logger.error('Error al descargar el PDF:', error);
        this.messageService.showError(this.translate.instant('COMMON.PDF_ERROR'));
        this.isDownloading = false;
      }
    });
  }

  onRoundingModeChange(mode: 'lots' | 'units'): void {
    this.roundingMode = mode;
  }

  getLotCount(detail: OrderDetail): number {
    if (!detail.lotQuantity || detail.lotQuantity <= 0) return 0;
    return detail.quantity / detail.lotQuantity;
  }

  getReceivedLotCount(detail: OrderDetail): number | null {
    if (!detail.lotQuantity || detail.lotQuantity <= 0 || detail.quantityReceived === undefined || detail.quantityReceived === null) return null;
    return detail.quantityReceived / detail.lotQuantity;
  }

  formatUnit(unit: string | undefined): string {
    if (!unit) return '';
    return unit.length > 5 ? unit.substring(0, 4) + '.' : unit;
  }
}
