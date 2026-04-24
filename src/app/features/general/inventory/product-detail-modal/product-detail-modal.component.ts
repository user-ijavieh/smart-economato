import { Component, Input, Output, EventEmitter, inject, OnInit, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Product } from '../../../../shared/models/product.model';
import { ProductBatchService } from '../../../../core/services/product-batch.service';
import { ProductBatchResponseDTO } from '../../../../shared/models/product-batch.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  imports: [BaseModalComponent, DatePipe, DecimalPipe, TranslateModule],
  templateUrl: './product-detail-modal.component.html',
  styleUrl: './product-detail-modal.component.css'
})
export class ProductDetailModalComponent implements OnInit, OnChanges {
  private batchService = inject(ProductBatchService);
  private cdr = inject(ChangeDetectorRef);

  @Input() product: Product | null = null;
  @Input() isAdmin = false;
  @Input() showActions: boolean | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Product>();

  batches: ProductBatchResponseDTO[] = [];
  loadingBatches = false;

  ngOnInit(): void {
    this.loadBatches();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange) {
      this.loadBatches();
    }
  }

  loadBatches(): void {
    if (!this.product?.id) return;
    this.loadingBatches = true;
    this.batchService.getActiveBatches(this.product.id).subscribe({
      next: (batches) => {
        this.batches = batches;
        this.loadingBatches = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingBatches = false;
        this.cdr.detectChanges();
      }
    });
  }

  shouldShowActions(): boolean {
    // Since showActions input is restored, this method will now depend on it
    return this.showActions ?? this.isAdmin;
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.product) {
      this.edit.emit(this.product);
    }
  }

  getUsablePercentage(): number | null {
    if (!this.product) return null;
    const rawValue = (this.product as any).availabilityPercentage
      ?? (this.product as any).availability
      ?? (this.product as any).disponibilidad;

    if (rawValue === undefined || rawValue === null || rawValue === '') return null;

    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? null : parsed;
  }

  getMermaPercentage(): number | null {
    const usable = this.getUsablePercentage();
    if (usable === null) return null;
    return 100 - usable;
  }

  getUsableStock(): number | null {
    if (!this.product || this.product.currentStock === undefined || this.product.currentStock === null) return null;
    const usablePct = this.getUsablePercentage() ?? 100;
    return (this.product.currentStock * usablePct) / 100;
  }

  isLowStock(): boolean {
    if (!this.product) return false;
    return false; // Eliminado stock mínimo, por ahora no hay alerta de bajo stock basada en él
  }
}
