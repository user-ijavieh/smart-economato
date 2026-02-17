import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Product, ProductRequest } from '../../../../shared/models/product.model';

@Component({
  selector: 'app-stock-update-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-update-modal.component.html',
  styleUrl: './stock-update-modal.component.css'
})
export class StockUpdateModalComponent implements OnChanges {
  @Input() product: Product | null = null;
  @Output() save = new EventEmitter<ProductRequest>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('stockForm') stockForm?: NgForm;

  currentStock = 0;
  productName = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.currentStock = this.product.currentStock || 0;
      this.productName = this.product.name;
    }
  }

  onSubmit(): void {
    if (this.stockForm && !this.stockForm.valid) {
      return;
    }

    if (!this.product) return;

    // Build the ProductRequest with ONLY stock updated, and existing values for others
    // The backend logic checks stockDelta, so currentStock is crucial.
    // Other fields are required by ProductRequestDTO validity checks (e.g. valid unit), so we pass them along.

    // We must ensure we don't accidentally wipe out other fields if the product has them.
    // However, the backend logic for updateStockManually validates existing vs new name, etc.
    // Ideally we send the exact same data as the product has, just with new stock.

    const productRequest: ProductRequest = {
      name: this.product.name,
      productCode: this.product.productCode,
      type: this.product.type,
      unit: this.product.unit,
      unitPrice: this.product.unitPrice,
      supplierId: this.product.supplier?.id,
      currentStock: this.currentStock,

      // Legacy/Compat fields just in case
      price: this.product.unitPrice,
      stock: this.currentStock,
      minStock: this.product.minStock
    };

    this.save.emit(productRequest);
  }

  onClose(): void {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    // Optional: close on backdrop click if desired
  }
}
