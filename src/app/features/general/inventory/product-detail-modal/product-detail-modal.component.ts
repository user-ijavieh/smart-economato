import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../shared/models/product.model';
import { ProductBatchService } from '../../../../core/services/product-batch.service';
import { ProductBatchResponseDTO } from '../../../../shared/models/product-batch.model';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail-modal.component.html',
  styleUrl: './product-detail-modal.component.css'
})
export class ProductDetailModalComponent implements OnInit {
  private batchService = inject(ProductBatchService);

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

  loadBatches(): void {
    if (!this.product?.id) return;
    this.loadingBatches = true;
    this.batchService.getActiveBatches(this.product.id).subscribe({
      next: (batches) => {
        this.batches = batches;
        this.loadingBatches = false;
      },
      error: () => {
        this.loadingBatches = false;
      }
    });
  }

  shouldShowActions(): boolean {
    // Since showActions input is restored, this method will now depend on it
    return this.showActions ?? this.isAdmin;
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.product) {
      this.edit.emit(this.product);
    }
  }

  getMinimumStock(): number {
    if (!this.product) return 0;
    return this.product.minStock ?? this.product.minimumStock ?? 0;
  }

  getAvailabilityPercentage(): number | null {
    if (!this.product) return null;
    const rawValue = (this.product as any).availabilityPercentage
      ?? (this.product as any).availability
      ?? (this.product as any).disponibilidad;

    if (rawValue === undefined || rawValue === null || rawValue === '') return null;

    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? null : parsed;
  }

  isLowStock(): boolean {
    if (!this.product) return false;
    return this.product.currentStock < this.getMinimumStock();
  }
}
