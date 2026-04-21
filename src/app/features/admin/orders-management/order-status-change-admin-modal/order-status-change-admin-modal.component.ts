import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order, OrderStatus } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-order-status-change-admin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './order-status-change-admin-modal.component.html',
  styleUrl: './order-status-change-admin-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderStatusChangeAdminModalComponent implements OnInit {
  @Input() order: Order | null = null;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<Order>();

  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  messageService = inject(MessageService);

  newStatusValue: string = '';
  saving = false;

  readonly allStatuses: { value: OrderStatus; label: string }[] = [
    { value: 'CREATED', label: 'Creada' },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'REVIEW', label: 'Revisión' },
    { value: 'CONFIRMED', label: 'Confirmada' },
    { value: 'INCOMPLETE', label: 'Incompleta' },
    { value: 'CANCELLED', label: 'Cancelada' },
  ];

  ngOnInit(): void {
    if (this.order) {
      this.newStatusValue = this.order.status;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  confirmStatusChange(): void {
    if (!this.order || !this.newStatusValue || this.saving) return;
    if (this.newStatusValue === this.order.status) {
      this.onClose();
      return;
    }

    const orderId = this.order.id;
    const status = this.newStatusValue;

    this.saving = true;
    this.cdr.markForCheck();

    this.orderService.updateStatus(orderId, status).subscribe({
      next: (updatedOrder) => {
        const result = { ...this.order!, status: (updatedOrder?.status || status) as OrderStatus };
        this.messageService.showSuccess(`Estado de la orden #${orderId} actualizado a ${this.formatStatus(status as OrderStatus)}`);
        this.updated.emit(result);
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.message || 'Error al actualizar el estado de la orden';
        this.messageService.showError(msg);
        this.cdr.markForCheck();
      }
    });
  }

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
}
