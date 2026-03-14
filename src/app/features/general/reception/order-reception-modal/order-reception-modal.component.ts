import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order, OrderReceptionRequest } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';

@Component({
  selector: 'app-order-reception-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-reception-modal.component.html',
  styleUrl: './order-reception-modal.component.css'
})
export class OrderReceptionModalComponent implements OnInit {
  @Input({ required: true }) order!: Order;
  @Output() closeModal = new EventEmitter<void>();
  @Output() receptionProcessed = new EventEmitter<void>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);

  isProcessing = false;

  ngOnInit(): void {
    // Inicializar quantityReceived con la original quantity para facilitar la recepción
    if (this.order && this.order.details) {
      this.order.details.forEach(detail => {
        if (detail.quantityReceived === undefined) {
          detail.quantityReceived = detail.quantity;
        }
      });
    }
  }

  close(): void {
    this.closeModal.emit();
  }

  async processReception(): Promise<void> {
    if (!this.order.details || this.order.details.length === 0) {
      this.messageService.showError('La orden no tiene productos.');
      return;
    }

    // Validar cantidades negativas o nulas (opcional pero recomendado)
    const hasInvalidQuantities = this.order.details.some(d => d.quantityReceived === undefined || d.quantityReceived === null || d.quantityReceived < 0);
    if (hasInvalidQuantities) {
      this.messageService.showError('Por favor revisa que todas las cantidades recibidas sean números válidos o 0.');
      return;
    }

    const hasInvalidExpirationDate = this.order.details.some(d => d.expirationDate !== undefined && d.expirationDate !== null && d.expirationDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(d.expirationDate));
    if (hasInvalidExpirationDate) {
      this.messageService.showError('Revisa el formato de fecha de caducidad.');
      return;
    }

    const confirmed = await this.messageService.confirm(
      'Procesar Recepción',
      `¿Confirmar recepción de la orden #${this.order.id}?`
    );

    if (!confirmed) {
      return;
    }

    this.isProcessing = true;

    const request: OrderReceptionRequest = {
      orderId: this.order.id,
      items: this.order.details.map(d => ({
        productId: d.productId,
        quantityReceived: d.quantityReceived ?? 0,
        expirationDate: d.expirationDate ?? null
      }))
    };

    this.orderService.processReception(request).subscribe({
      next: () => {
        this.messageService.showSuccess('Recepción procesada correctamente');
        this.isProcessing = false;
        this.receptionProcessed.emit();
        this.close();
      },
      error: () => {
        this.messageService.showError('Error al procesar la recepción');
        this.isProcessing = false;
      }
    });
  }
}
