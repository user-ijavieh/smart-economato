import { Component, Input, Output, EventEmitter, ViewChild, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-product-create-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent],
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
    unitPrice: 0,
    currentStock: 0,
    availabilityPercentage: undefined as number | undefined,
    unit: 'KG',
    supplierId: undefined as number | undefined,
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

    if (currentStock > 0 && !this.formData.expirationDate) {
      this.messageService.showError('La fecha de caducidad es obligatoria cuando se introduce stock inicial.');
      return;
    }

    // Enviar JSON en el formato exacto del backend
    const productData: ProductRequest = {
      availabilityPercentage: availabilityPercentage,
      name: this.formData.name.trim(),
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

  resetForm(): void {
    this.formData = {
      name: '',
      productCode: '',
      availabilityPercentage: undefined,
      unitPrice: 0,
      currentStock: 0,
      unit: 'KG',
      supplierId: undefined,
      expirationDate: ''
    };
  }
}