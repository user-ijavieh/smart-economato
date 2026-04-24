import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Product, ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { SearchableDropdownComponent, SearchableItem } from '../../../../shared/components/searchable-dropdown/searchable-dropdown.component';

export interface ProductFormState {
  name: string;
  productCode: string;
  price: number;
  stock: number;
  unit: string;
  lotQuantity: number | undefined;
  supplierId: number | undefined;
  expirationDate: string;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableDropdownComponent, TranslateModule],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css'
})
export class ProductFormComponent implements OnChanges {
  private translate = inject(TranslateService);
  @Input() product: Product | null = null;
  @Input() suppliers: Supplier[] = [];
  
  @Output() save = new EventEmitter<ProductRequest>();
  @Output() cancel = new EventEmitter<void>();
  // @Output() delete = new EventEmitter<void>(); // Removido: ahora se usa toggleHidden

  formProduct: ProductFormState = {
    name: '',
    productCode: '',
    price: 0,
    stock: 0,
    unit: 'UND', // Default to valid unit
    lotQuantity: undefined,
    supplierId: undefined,
    expirationDate: ''
  };

  allowedUnits = [
    // Peso
    "KG", "G", "MG", "ONZA", "LIBRA",
    // Volumen
    "L", "ML", "CL", "DL", "GARRAFA",
    // Medidas de cocina
    "CUCHARADA", "CUCHARADITA", "TAZA", "PIZCA", "VASO",
    // Unidades discretas
    "UNIDAD", "UND", "UDS", "PIEZA", "DOCENA",
    // Envases/Empaquetado
    "BOTE", "LATA", "PAQUETE", "SOBRE", "BOLSA", "CAJA", "SACO", "BANDEJA", "TUBO",
    // Formas específicas de cocina
    "MANOJO", "HOJA", "LONCHA", "DIENTE", "RAMA", "FILETE", "RODAJA", "REBANADA"
  ];
  
  get supplierSearchItems(): SearchableItem[] {
    return this.suppliers.map(s => ({
      id: s.id,
      name: s.name
    }));
  }

  get selectedSupplierName(): string {
    const supplier = this.suppliers.find(s => s.id === this.formProduct.supplierId);
    return supplier ? supplier.name : '';
  }

  onSupplierSelected(item: SearchableItem): void {
    this.formProduct.supplierId = item.id;
  }
  
  isEditing = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.isEditing = true;
      this.formProduct = {
        name: this.product.name,
        productCode: this.product.productCode || '',
        price: this.product.unitPrice || 0,
        stock: this.product.currentStock || 0,
        unit: this.product.unit || 'UND',
        lotQuantity: this.product.lotQuantity,
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
      price: 0,
      stock: 0,
      unit: 'UND',
      lotQuantity: undefined,
      supplierId: undefined,
      expirationDate: ''
    };
  }

  onSubmit(): void {
    const stockValue = this.formProduct.stock !== null ? this.formProduct.stock : 0;

    if (stockValue > 0 && !this.formProduct.expirationDate) {
      alert(this.translate.instant('PRODUCT_FORM.EXPIRATION_REQUIRED'));
      return;
    }

    const productData: ProductRequest = {
      name: this.formProduct.name,
      productCode: this.formProduct.productCode,
      price: this.formProduct.price,
      unitPrice: this.formProduct.price,
      stock: stockValue,
      currentStock: stockValue,
      unit: this.formProduct.unit,
      lotQuantity: this.formProduct.lotQuantity,
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
