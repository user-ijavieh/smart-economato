import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Order, OrderReceptionRequest } from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { ScaleService } from '../../../../core/services/scale.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-order-reception-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DatePipe],
  templateUrl: './order-reception-modal.component.html',
  styleUrl: './order-reception-modal.component.css'
})
export class OrderReceptionModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Output() closeModal = new EventEmitter<void>();
  @Output() receptionProcessed = new EventEmitter<void>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private scaleService = inject(ScaleService);

  isProcessing = false;
  isScaleListening = false;

  private scaleSubscription?: Subscription;
  private listeningSubscription?: Subscription;
  private activeScaleTarget: { productId: number; lotIndex: number } | null = null;

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
    this.scaleSubscription = this.scaleService.weight$.subscribe(weight => {
      this.applyWeightToActiveLot(weight);
    });

    this.listeningSubscription = this.scaleService.listening$.subscribe(isListening => {
      this.isScaleListening = isListening;

      if (!isListening) {
        this.activeScaleTarget = null;
      }
    });

    if (this.order && this.order.details) {
      this.order.details.forEach(detail => {
        if (!detail.lots || detail.lots.length === 0) {
          detail.lots = [{ quantity: detail.quantity, expirationDate: null }];
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.scaleSubscription?.unsubscribe();
    this.listeningSubscription?.unsubscribe();
    void this.scaleService.stopListening();
  }

  addLot(detail: any): void {
    if (!detail.lots) detail.lots = [];
    detail.lots.push({ quantity: 0, expirationDate: null });
  }

  removeLot(detail: any, index: number): void {
    if (detail.lots && detail.lots.length > 1) {
      detail.lots.splice(index, 1);
    }
  }

  getTotalReceived(detail: any): number {
    if (!detail.lots) return 0;
    return detail.lots.reduce((acc: number, lot: any) => acc + (lot.quantity || 0), 0);
  }

  async confirmCancel() {
    const confirmed = await this.messageService.confirm(
      'Cancelar Recepción',
      '¿Estás seguro de que deseas cancelar? Los datos introducidos no se guardarán.',
      'Cancelar',
      'Volver'
    );
    if (confirmed) {
      this.close();
    }
  }

  close(): void {
    void this.scaleService.stopListening();
    this.closeModal.emit();
  }

  async toggleScaleForLot(detail: any, lotIndex: number): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const productId = Number(detail.productId);
    const sameTarget = this.activeScaleTarget?.productId === productId && this.activeScaleTarget?.lotIndex === lotIndex;

    if (this.isScaleListening && sameTarget) {
      await this.scaleService.stopListening();
      return;
    }

    this.activeScaleTarget = { productId, lotIndex };

    if (this.isScaleListening) {
      return;
    }

    if (!this.scaleService.isSupported) {
      this.messageService.showError('Este navegador no soporta conexión serial con báscula. Usa Chrome o Edge recientes.');
      return;
    }

    try {
      await this.scaleService.startListening({ baudRate: 9600 });
      this.messageService.showInfo('Báscula conectada. Se actualizará el peso hasta cancelar.');
    } catch {
      this.activeScaleTarget = null;
      this.messageService.showError('No se pudo iniciar la lectura de la báscula. Revisa permisos o conexión del puerto.');
    }
  }

  isScaleActiveForLot(detail: any, lotIndex: number): boolean {
    if (!this.isScaleListening || !this.activeScaleTarget) {
      return false;
    }

    return this.activeScaleTarget.productId === Number(detail.productId) && this.activeScaleTarget.lotIndex === lotIndex;
  }

  private applyWeightToActiveLot(rawWeight: string): void {
    if (!this.activeScaleTarget || !this.order.details) {
      return;
    }

    const parsedWeight = Number(rawWeight);
    if (!Number.isFinite(parsedWeight)) {
      return;
    }

    const targetDetail = this.order.details.find(detail => Number(detail.productId) === this.activeScaleTarget?.productId);
    if (!targetDetail?.lots) {
      return;
    }

    const targetLot = targetDetail.lots[this.activeScaleTarget.lotIndex];
    if (!targetLot) {
      return;
    }

    targetLot.quantity = Number(parsedWeight.toFixed(4));
  }

  async processReception(): Promise<void> {
    if (!this.order.details || this.order.details.length === 0) {
      this.messageService.showError('La orden no tiene productos.');
      return;
    }

    // Validar cantidades negativas o nulas
    const hasInvalidQuantities = this.order.details.some(d => {
      const total = this.getTotalReceived(d);
      return total < 0 || d.lots?.some(lot => lot.quantity < 0 || lot.quantity === null || lot.quantity === undefined);
    });
    if (hasInvalidQuantities) {
      this.messageService.showError('Por favor revisa que todas las cantidades de los lotes sean números válidos o 0.');
      return;
    }

    const missingExpiration = this.order.details.some(d => 
      d.lots && d.lots.some(lot => lot.quantity > 0 && !lot.expirationDate)
    );
    if (missingExpiration) {
      this.messageService.showError('La fecha de caducidad es obligatoria para los lotes con cantidad recibida.');
      return;
    }

    const hasInvalidExpirationDate = this.order.details.some(d => 
      d.lots && d.lots.some(lot => lot.expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(lot.expirationDate))
    );
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
        quantityReceived: this.getTotalReceived(d),
        lots: d.lots?.map(l => ({ quantity: l.quantity, expirationDate: l.expirationDate || null })) || []
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
