import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail-modal.component.html',
  styleUrls: ['./product-detail-modal.component.css']
})
export class ProductDetailModalComponent implements OnChanges {
  @Input() product: Product | null = null;
  @Input() isAdmin = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Product>();
  @Output() adjustStock = new EventEmitter<Product>();

  ngOnChanges(changes: SimpleChanges): void {
    // Component receives isAdmin as input
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.product) {
      this.edit.emit(this.product);
    }
  }

  onAdjustStock(): void {
    if (this.product) {
      this.adjustStock.emit(this.product);
    }
  }

  isLowStock(): boolean {
    if (!this.product) return false;
    return this.product.currentStock < (this.product.minStock || 0);
  }
}
