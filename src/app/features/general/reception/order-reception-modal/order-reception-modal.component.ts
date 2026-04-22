import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';
import {
  Order,
  OrderDetail,
  OrderReceptionRequest
} from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { ProductService } from '../../../../core/services/product.service';
import { Product } from '../../../../shared/models/product.model';
import { ScaleService } from '../../../../core/services/scale.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';

@Component({
  selector: 'app-order-reception-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DatePipe, DecimalPipe, BarcodeScannerComponent],
  templateUrl: './order-reception-modal.component.html',
  styleUrl: './order-reception-modal.component.css'
})
export class OrderReceptionModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Output() closeModal = new EventEmitter<void>();
  @Output() receptionProcessed = new EventEmitter<void>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private productService = inject(ProductService);
  private scaleService = inject(ScaleService);
  private authService = inject(AuthService);

  isProcessing = false;
  isScaleListening = false;
  searchTerm = '';
  showScannerModal = false;
  filteredDetails: OrderDetail[] = [];
  roundingMode: 'lots' | 'units' = 'lots';

  private scaleSubscription?: Subscription;
  private listeningSubscription?: Subscription;
  private activeScaleTarget: { productId: number; lotIndex: number } | null = null;

  beforeCloseHandler = async (): Promise<boolean> => {
    if (this.isProcessing) {
      return false;
    }

    return await this.messageService.confirm(
      'Salir de recepción',
      '¿Salir sin guardar? Los datos introducidos no se conservarán.',
      'Salir sin guardar',
      'Volver'
    );
  };

  ngOnInit(): void {
    this.filteredDetails = [...(this.order.details || [])];

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
          detail.lots = [{ quantity: 0, expirationDate: null, batchCode: null }];
        }
      });
    }

    this.applySearch();
  }

  ngOnDestroy(): void {
    this.scaleSubscription?.unsubscribe();
    this.listeningSubscription?.unsubscribe();
    void this.scaleService.stopListening();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.applySearch();
  }

  applySearch(): void {
    const details = this.order.details || [];
    const term = this.searchTerm.trim();

    if (!term) {
      this.filteredDetails = [...details];
      return;
    }

    const normalizedTerm = this.normalizeText(term);
    const nameMatches = details.filter(detail =>
      this.normalizeText(detail.productName).includes(normalizedTerm)
    );

    if (nameMatches.length > 0) {
      this.filteredDetails = nameMatches;
      return;
    }

    this.productService.getByBarcode(term).pipe(
      catchError(() => of(null))
    ).subscribe(product => {
      if (!product) {
        this.filteredDetails = [];
        return;
      }

      this.filteredDetails = details.filter(detail => detail.productId === product.id);
      this.searchTerm = product.productCode || product.name || term;
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredDetails = [...(this.order.details || [])];
  }

  openBarcodeScanner(): void {
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
  }

  onProductFound(product: Product): void {
    this.searchTerm = product.productCode || product.name || '';
    this.showScannerModal = false;
    this.applySearch();
  }

  get visibleDetails(): OrderDetail[] {
    return this.filteredDetails;
  }

  addLot(detail: any): void {
    if (!detail.lots) detail.lots = [];
    detail.lots.push({ quantity: 0, expirationDate: null, batchCode: null });
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  onRoundingModeChange(mode: 'units' | 'lots'): void {
    this.roundingMode = mode;
  }

  getLotCount(quantity: number, lotQuantity: number | undefined): number {
    if (!lotQuantity || lotQuantity <= 0) return 0;
    return quantity / lotQuantity;
  }

  updateLotQuantity(detail: OrderDetail, lotIndex: number, lotCount: number): void {
    if (detail.lotQuantity && detail.lotQuantity > 0) {
      const parsedLotCount = Number(lotCount);
      const safeLotCount = Number.isFinite(parsedLotCount) && parsedLotCount >= 0 ? parsedLotCount : 0;
      const newQuantity = safeLotCount * detail.lotQuantity;
      detail.lots![lotIndex].quantity = Math.round(newQuantity * 10000) / 10000;
    }
  }

  formatUnit(unit: string | undefined, compact = true): string {
    if (!unit) return '';
    if (!compact) return unit;
    return unit.length > 5 ? unit.substring(0, 4) + '.' : unit;
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

  getComparisonSymbol(detail: any): string {
    const expected = detail.quantity || 0;
    const received = this.getTotalReceived(detail);
    
    if (received === expected) {
      return '✓';
    } else if (received < expected) {
      return '✕';
    } else {
      return '▲';
    }
  }

  getFormattedQuantity(detail: any): string {
    const expected = detail.quantity || 0;
    const received = this.getTotalReceived(detail);
    const unit = detail.unit || 'uds';
    return `${expected} / ${received} ${unit}`;
  }

  async confirmCancel() {
    const confirmed = await this.messageService.confirm(
      'Salir de recepción',
      '¿Salir sin guardar? Los datos introducidos no se conservarán.',
      'Salir sin guardar',
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

  isInputDisabled(): boolean {
    return this.isProcessing;
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
    } catch (error: any) {
      this.activeScaleTarget = null;
      const detail = error?.message || 'Error desconocido';
      this.messageService.showError(`Error de báscula: ${detail}`);
      console.error('Error abriendo báscula:', error);
    }
  }

  isScaleActiveForLot(detail: any, lotIndex: number): boolean {
    if (!this.isScaleListening || !this.activeScaleTarget) {
      return false;
    }
    return this.activeScaleTarget.productId === Number(detail.productId) && this.activeScaleTarget.lotIndex === lotIndex;
  }

  manualRefresh(): void {

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
    if (this.order.status !== 'REVIEW') {
      this.messageService.showInfo(`La orden #${this.order.id} ya no está en revisión. Se actualizará la vista.`);
      this.close();
      return;
    }

    if (!this.order.details || this.order.details.length === 0) {
      this.messageService.showError('La orden no tiene productos.');
      return;
    }

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
        lots: d.lots?.map(l => ({
          quantity: l.quantity,
          expirationDate: l.expirationDate || null,
          batchCode: l.batchCode?.trim() ? l.batchCode.trim() : null
        })) || []
      }))
    };

    this.orderService.processReception(request).subscribe({
      next: () => {
        this.messageService.showSuccess('Recepción procesada correctamente');
        this.isProcessing = false;
        this.receptionProcessed.emit();
        this.close();
      },
      error: (error) => {
        const serverMessage = typeof error?.error?.message === 'string' ? error.error.message : '';
        this.messageService.showError(serverMessage || 'Error al procesar la recepción');
        this.isProcessing = false;
      }
    });
  }

  isCurrentUserAdmin(): boolean {
    return this.authService.getRole() === 'ADMIN';
  }
}
