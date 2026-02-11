import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Product, ProductRequest } from '../../../shared/models/product.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { MessageService } from '../../../core/services/message.service';

@Component({
  selector: 'app-product-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-edit-modal.component.html',
  styleUrl: './product-edit-modal.component.css'
})
export class ProductEditModalComponent implements OnChanges {
  @Input() product: Product | null = null;
  @Input() suppliers: Supplier[] = [];
  
  @Output() save = new EventEmitter<ProductRequest>();
  @Output() close = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  @ViewChild('editForm') editForm?: NgForm;

  private messageService = inject(MessageService);

  formData = {
    name: '',
    productCode: '',
    type: 'Ingrediente',
    unitPrice: 0,
    currentStock: 0,
    unit: 'KG',
    supplierId: undefined as number | undefined
  };

  allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
  productTypes = ['Ingrediente', 'Producto terminado', 'Bebida', 'Otro'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.formData = {
        name: this.product.name,
        productCode: this.product.productCode || '',
        type: this.product.type || 'Ingrediente',
        unitPrice: Number(this.product.unitPrice) || 0,
        currentStock: Number(this.product.currentStock) || 0,
        unit: this.product.unit || 'KG',
        supplierId: this.product.supplier?.id
      };
    }
  }

  onSubmit(): void {
    // Verificar si el formulario es válido
    if (this.editForm && !this.editForm.valid) {
      return;
    }

    // Asegurar que los valores numéricos sean números válidos
    const unitPrice = Number(this.formData.unitPrice);
    const currentStock = Number(this.formData.currentStock);
    const supplierId = this.formData.supplierId !== undefined && this.formData.supplierId !== null 
      ? Number(this.formData.supplierId) 
      : undefined;

    // Validar que los números sean válidos
    if (isNaN(unitPrice) || isNaN(currentStock)) {
      return;
    }

    if (unitPrice <= 0) {
      return;
    }

    if (currentStock < 0) {
      return;
    }

    // Enviar JSON en el formato exacto del backend
    const productData: ProductRequest = {
      name: this.formData.name.trim(),
      type: this.formData.type,
      unit: this.formData.unit,
      unitPrice: unitPrice,
      productCode: this.formData.productCode.trim(),
      currentStock: currentStock,
      supplierId: supplierId
    };

    this.save.emit(productData);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    // Modal no se cierra al hacer click fuera - solo con botones específicos
    // No hacer nada para prevenir el cierre accidental
  }

  async onDelete(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar "${this.product?.name}"? Esta acción no se puede deshacer.`
    );

    if (confirmed) {
      this.delete.emit();
    }
  }
}
