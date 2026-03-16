import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Product, ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';

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
  @Input() isAdmin = false;
  @Input() showingHidden = false; // Indica si estamos en la vista de productos ocultos

  @Output() save = new EventEmitter<ProductRequest>();
  @Output() close = new EventEmitter<void>();
  @Output() toggleHidden = new EventEmitter<void>();

  @ViewChild('editForm') editForm?: NgForm;

  private messageService = inject(MessageService);

  formData = {
    name: '',
    productCode: '',
    type: 'Ingrediente',
    unitPrice: 0,
    currentStock: 0,
    minimumStock: undefined as number | undefined,
    availabilityPercentage: undefined as number | undefined,
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
        minimumStock: this.product.minimumStock || this.product.minStock || undefined,
        availabilityPercentage: this.product.availabilityPercentage || undefined,
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
    const minimumStock = this.formData.minimumStock !== undefined && this.formData.minimumStock !== null
      ? Number(this.formData.minimumStock)
      : undefined;
    const availabilityPercentage = this.formData.availabilityPercentage !== undefined && this.formData.availabilityPercentage !== null
      ? Number(this.formData.availabilityPercentage)
      : undefined;
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
      minimumStock: minimumStock,
      availabilityPercentage: availabilityPercentage,
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

  onOverlayClick(event: MouseEvent): void {
    // Modal no se cierra al hacer click fuera - solo con botones específicos
    // No hacer nada para prevenir el cierre accidental
  }

  async onToggleHidden(): Promise<void> {
    const action = this.showingHidden ? 'mostrar' : 'ocultar';
    const confirmed = await this.messageService.confirm(
      `Confirmar ${action}`,
      `¿Estás seguro de que deseas ${action} "${this.product?.name}"?`
    );

    if (confirmed) {
      this.toggleHidden.emit();
    }
  }

  getToggleButtonText(): string {
    return this.showingHidden ? 'Mostrar' : 'Ocultar';
  }
}
