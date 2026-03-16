import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';

export interface ProductFormState {
  name: string;
  productCode: string;
  type: string;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
  supplierId: number | undefined;
  expirationDate: string;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css'
})
export class ProductFormComponent implements OnChanges {
  @Input() product: Product | null = null;
  @Input() suppliers: Supplier[] = [];
  
  @Output() save = new EventEmitter<ProductRequest>();
  @Output() cancel = new EventEmitter<void>();
  // @Output() delete = new EventEmitter<void>(); // Removido: ahora se usa toggleHidden

  formProduct: ProductFormState = {
    name: '',
    productCode: '',
    type: 'Ingrediente',
    price: 0,
    stock: 0,
    minStock: 0,
    unit: 'UND', // Default to valid unit
    supplierId: undefined,
    expirationDate: ''
  };

  allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
  
  isEditing = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.isEditing = true;
      this.formProduct = {
        name: this.product.name,
        productCode: this.product.productCode || '',
        type: this.product.type || 'Ingrediente',
        price: this.product.unitPrice || 0,
        stock: this.product.currentStock || 0,
        minStock: this.product.minStock || 0,
        unit: this.product.unit || 'UND',
        supplierId: this.product.supplier?.id,
        expirationDate: this.product.expirationDate || ''
      };
    } else if (changes['product'] && !this.product) {
      this.isEditing = false;
      this.resetForm();
    }
  }

  resetForm(): void {
    this.formProduct = {
      name: '',
      productCode: '',
      type: 'Ingrediente',
      price: 0,
      stock: 0,
      minStock: 0,
      unit: 'UND',
      supplierId: undefined,
      expirationDate: ''
    };
  }

  onSubmit(): void {
    const stockValue = this.formProduct.stock !== null ? this.formProduct.stock : 0;
    const minStockValue = this.formProduct.minStock !== null ? this.formProduct.minStock : 0;

    if (stockValue > 0 && !this.formProduct.expirationDate) {
      alert('La fecha de caducidad es obligatoria cuando se introduce stock inicial.');
      return;
    }

    const productData: ProductRequest = {
      name: this.formProduct.name,
      productCode: this.formProduct.productCode,
      type: this.formProduct.type,
      price: this.formProduct.price,
      unitPrice: this.formProduct.price,
      stock: stockValue,
      currentStock: stockValue,
      minStock: minStockValue,
      minimumStock: minStockValue,
      unit: this.formProduct.unit,
      supplierId: this.formProduct.supplierId,
      expirationDate: this.formProduct.expirationDate || undefined
    };
    this.save.emit(productData);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // onDelete() removido: ahora se usa toggleHidden en lugar de eliminar productos
}
