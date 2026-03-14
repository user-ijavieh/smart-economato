import { Component, Input, Output, EventEmitter, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';

@Component({
  selector: 'app-product-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-create-modal.component.html',
  styleUrl: './product-create-modal.component.css'
})
export class ProductCreateModalComponent {
  @Input() suppliers: Supplier[] = [];
  @Input() isAdmin = false;

  @Output() save = new EventEmitter<ProductRequest>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('createForm') createForm?: NgForm;

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
    supplierId: undefined as number | undefined,
    expirationDate: ''
  };

  allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
  productTypes = ['Ingrediente', 'Producto terminado', 'Bebida', 'Otro'];

  async onSubmit(): Promise<void> {
    // Verificar si el formulario es válido
    if (this.createForm && !this.createForm.valid) {
      return;
    }

    // Mostrar diálogo de confirmación
    const confirmed = await this.messageService.confirm(
      'Confirmar creación',
      `¿Estás seguro de que deseas crear el producto "${this.formData.name}"?`
    );

    if (!confirmed) return;

    // Asegurar que los valores numéricos sean números válidos
    const unitPrice = Number(this.formData.unitPrice);
    const currentStock = Number(this.formData.currentStock);
    const minimumStock = this.formData.minimumStock !== undefined && this.formData.minimumStock !== null
      ? Number(this.formData.minimumStock)
      : undefined;
    const availabilityPercentage = this.formData.availabilityPercentage !== undefined && this.formData.availabilityPercentage !== null
      ? Number(this.formData.availabilityPercentage)
      : undefined;
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
      supplierId: supplierId,
      expirationDate: this.formData.expirationDate || undefined
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

  resetForm(): void {
    this.formData = {
      name: '',
      productCode: '',
      type: 'Ingrediente',
      minimumStock: undefined,
      availabilityPercentage: undefined,
      unitPrice: 0,
      currentStock: 0,
      unit: 'KG',
      supplierId: undefined,
      expirationDate: ''
    };
  }
}