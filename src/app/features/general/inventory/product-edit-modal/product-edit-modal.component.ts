import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Product, ProductRequest } from '../../../../shared/models/product.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';
import { SearchableDropdownComponent, SearchableItem } from '../../../../shared/components/searchable-dropdown/searchable-dropdown.component';

@Component({
  selector: 'app-product-edit-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, BarcodeScannerComponent, SearchableDropdownComponent, TranslateModule],
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
  private translate = inject(TranslateService);
  showScannerModal = false;

  formData = {
    name: '',
    productCode: '',
    barcode: '',
    unitPrice: 0,
    currentStock: 0,
    availabilityPercentage: undefined as number | undefined,
    unit: 'KG',
    supplierId: undefined as number | undefined,
    lotQuantity: 1
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
    const supplier = this.suppliers.find(s => s.id === this.formData.supplierId);
    return supplier ? supplier.name : '';
  }

  onSupplierSelected(item: SearchableItem): void {
    this.formData.supplierId = item.id;
  }

  initialLotQuantity: number | undefined = undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.initialLotQuantity = this.product.lotQuantity;
      this.formData = {
        name: this.product.name,
        productCode: this.product.productCode || '',
        barcode: this.product.barcode || '',
        unitPrice: Number(this.product.unitPrice) || 0,
        currentStock: Number(this.product.currentStock) || 0,
        availabilityPercentage: this.product.availabilityPercentage || undefined,
        unit: this.product.unit || 'KG',
        supplierId: this.product.supplier?.id,
        lotQuantity: this.product.lotQuantity || 1
      };
    }
  }

  async onSubmit(): Promise<void> {
    // Verificar si el formulario es válido
    if (this.editForm && !this.editForm.valid) {
      return;
    }

    // Asegurar que los valores numéricos sean números válidos
    const availabilityPercentage = this.formData.availabilityPercentage !== undefined && this.formData.availabilityPercentage !== null
      ? Number(this.formData.availabilityPercentage)
      : undefined;
    const unitPrice = Number(this.formData.unitPrice);
    const currentStock = Number(this.formData.currentStock);
    const supplierId = this.formData.supplierId !== undefined && this.formData.supplierId !== null
      ? Number(this.formData.supplierId)
      : undefined;
    
    const lotQuantity = (this.formData.lotQuantity !== undefined && this.formData.lotQuantity !== null && String(this.formData.lotQuantity) !== '')
      ? Number(this.formData.lotQuantity)
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

    // Confirmación si cambia la cantidad por lote
    if (lotQuantity !== this.initialLotQuantity) {
      const confirmed = await this.messageService.confirm(
        this.translate.instant('PRODUCT_EDIT.LOT_CHANGE_TITLE'),
        this.translate.instant('PRODUCT_EDIT.LOT_CHANGE_MSG')
      );
      if (!confirmed) return;
    }

    // Enviar JSON en el formato exacto del backend
    const productData: ProductRequest = {
      availabilityPercentage: availabilityPercentage,
      name: this.formData.name.trim(),
      unit: this.formData.unit,
      unitPrice: unitPrice,
      productCode: this.formData.productCode.trim(),
      barcode: this.formData.barcode.trim() || undefined,
      currentStock: currentStock,
      supplierId: supplierId,
      lotQuantity: lotQuantity
    };

    this.save.emit(productData);
  }

  onClose(): void {
    this.close.emit();
  }

  async onToggleHidden(): Promise<void> {
    const action = this.showingHidden 
        ? this.translate.instant('PRODUCT_EDIT.ACTIONS.ACTIVATE_VERB') 
        : this.translate.instant('PRODUCT_EDIT.ACTIONS.ARCHIVE_VERB');
    
    const confirmed = await this.messageService.confirm(
      this.translate.instant('PRODUCT_EDIT.CONFIRM_TOGGLE_TITLE', { action }),
      this.translate.instant('PRODUCT_EDIT.CONFIRM_TOGGLE_MSG', { action, name: this.product?.name })
    );

    if (confirmed) {
      this.toggleHidden.emit();
    }
  }

  getToggleButtonText(): string {
    return this.showingHidden 
        ? this.translate.instant('PRODUCT_EDIT.ACTIONS.ACTIVATE') 
        : this.translate.instant('PRODUCT_EDIT.ACTIONS.ARCHIVE');
  }

  openBarcodeScanner(): void {
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
  }

  onCodeScanned(code: string): void {
    this.formData.barcode = code.trim();
    this.showScannerModal = false;

    if (this.formData.barcode) {
      this.messageService.showSuccess(this.translate.instant('PRODUCT_EDIT.SCAN_SUCCESS', { code: this.formData.barcode }));
    } else {
      this.messageService.showWarning(this.translate.instant('PRODUCT_EDIT.SCAN_ERROR'));
    }
  }

  get pricePerLot(): number {
    const price = Number(this.formData.unitPrice) || 0;
    const lot = Number(this.formData.lotQuantity) || 1;
    return Number((price * lot).toFixed(4));
  }

  set pricePerLot(value: number) {
    const lot = Number(this.formData.lotQuantity) || 1;
    if (lot > 0) {
      this.formData.unitPrice = Number((value / lot).toFixed(4));
    }
  }
}
