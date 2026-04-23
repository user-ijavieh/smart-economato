import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Product, ProductRequest } from '../../../../shared/models/product.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { MessageService } from '../../../../core/services/message.service';

@Component({
  selector: 'app-stock-update-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, TranslateModule],
  templateUrl: './stock-update-modal.component.html',
  styleUrl: './stock-update-modal.component.css'
})
export class StockUpdateModalComponent implements OnChanges {
  private translate = inject(TranslateService);
  private messageService = inject(MessageService);

  @Input() product: Product | null = null;
  @Input() isAdmin = false;
  @Output() save = new EventEmitter<ProductRequest>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('stockForm') stockForm?: NgForm;

  currentStock = 0;
  productName = '';
  expirationDate: string = '';

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

    if (this.currentStock > (this.product.currentStock || 0) && !this.expirationDate) {
      this.messageService.showWarning(this.translate.instant('STOCK_UPDATE.EXPIRATION_REQUIRED'));
      return;
    }

    const productRequest: ProductRequest = {
      name: this.product.name,
      productCode: this.product.productCode,
      unit: this.product.unit,
      unitPrice: this.product.unitPrice,
      supplierId: this.product.supplier?.id,
      currentStock: this.currentStock,

      // Legacy/Compat fields just in case
      price: this.product.unitPrice,
      stock: this.currentStock,
      expirationDate: this.expirationDate || undefined
    };

    this.save.emit(productRequest);
  }

  onClose(): void {
    this.close.emit();
  }
}
