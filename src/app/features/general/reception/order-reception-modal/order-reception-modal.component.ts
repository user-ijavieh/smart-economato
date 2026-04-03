import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order, OrderReceptionRequest } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-order-reception-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DatePipe],
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

  beforeCloseHandler = async (): Promise<boolean> => {
    if (this.isProcessing) {
      return false;
    }

    return await this.messageService.confirm(
      'Cancelar Recepción',
      '¿Estás seguro de que deseas cancelar? Los datos introducidos no se guardarán.',
      'Cancelar',
      'Volver'
    );
  };

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

    const missingExpiration = this.order.details.some(d => 
      (d.quantityReceived ?? 0) > 0 && !d.expirationDate
    );
    if (missingExpiration) {
      this.messageService.showError('La fecha de caducidad es obligatoria para los productos recibidos.');
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
