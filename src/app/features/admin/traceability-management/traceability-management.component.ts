import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { TraceabilityService } from '../../../core/services/traceability.service';
import { MessageService } from '../../../core/services/message.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../general/barcode-scanner/barcode-scanner.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import {
  CrisisActivationRequest,
  CrisisResponseDTO
} from '../../../shared/models/crisis.model';
import { Product } from '../../../shared/models/product.model';
import { Supplier } from '../../../shared/models/supplier.model';

type CrisisView = 'active' | 'history';

@Component({
  selector: 'app-traceability-management',
  standalone: true,
  imports: [FormsModule, ToastComponent, BaseModalComponent, BarcodeScannerComponent, AsyncPipe, DatePipe, DecimalPipe, KeyValuePipe],
  templateUrl: './traceability-management.component.html',
  styleUrl: './traceability-management.component.css'
})
export class TraceabilityManagementComponent implements OnInit {
  private traceabilityService = inject(TraceabilityService);
  private supplierService = inject(SupplierService);
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);
  messageService = inject(MessageService);

  activeView: CrisisView = 'active';
  activating = false;
  searching = false;
  showActivationModal = false;

  // -- Supplier Selection State --
  suppliers: Supplier[] = [];
  selectedSupplier: Supplier | null = null;
  selectedSupplierId: number | null = null;
  showSupplierDropdown = false;
  supplierSearchTerm = '';
  loadingSuppliers = false;
  supplierPage = 0;
  supplierTotalPages = 0;
  private supplierSearchSubject = new Subject<string>();

  // -- Product Selection State --
  products: Product[] = [];
  selectedProducts: Product[] = [];
  selectedProductIds: number[] = [];
  showProductDropdown = false;
  productSearchTerm = '';
  loadingProducts = false;
  productPage = 0;
  productTotalPages = 0;
  showProductScannerModal = false;
  private productSearchSubject = new Subject<string>();

  dateFrom = '';
  dateTo = '';
  reason = '';

  activeSearchTerm = '';
  historySearchTerm = '';
  
  selectedCrisis: CrisisResponseDTO | null = null;
  showCrisisDetailModal = false;

  activeCrises: CrisisResponseDTO[] = [];
  filteredActiveCrises: CrisisResponseDTO[] = [];
  liftedCrises: CrisisResponseDTO[] = [];
  filteredHistoryCrises: CrisisResponseDTO[] = [];
  liftAvailabilityByCrisis: Record<number, string> = {};

  historyPage = 0;
  historySize = 10;
  historyTotalPages = 0;
  historyTotalElements = 0;
  loadingHistory = false;
  private historySearchSubject = new Subject<string>();

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadSuppliers();
    this.loadProducts();
    this.loadCrises();
    this.loadHistory();
    
    const now = new Date();
    const previousWeek = new Date();
    previousWeek.setDate(now.getDate() - 7);
    this.dateFrom = this.toDateTimeLocal(previousWeek);
    this.dateTo = this.toDateTimeLocal(now);
  }

  loadCrises(): void {
    this.traceabilityService.getCrises().subscribe({
      next: crises => {
        crises.forEach(c => {
          if (c.status === 'ACTIVE') {
            this.addOrUpdateCrisis(c);
          }
        });
        this.onActiveSearch();
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError('No se pudieron cargar las alertas de trazabilidad.')
    });
  }

  private setupSearchDebounce(): void {
    this.supplierSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.supplierPage = 0;
      this.suppliers = [];
      this.loadSuppliers();
    });

    this.productSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.productPage = 0;
      this.products = [];
      this.loadProducts();
    });

    this.historySearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.historyPage = 0;
      this.loadHistory();
    });
  }

  // -- Supplier Dropdown Logic --
  toggleSupplierDropdown(): void {
    this.showSupplierDropdown = !this.showSupplierDropdown;
    if (this.showSupplierDropdown) {
      this.showProductDropdown = false;
      this.supplierPage = 0;
      this.suppliers = [];
      this.loadSuppliers();
    }
  }

  closeSupplierDropdown(): void {
    this.showSupplierDropdown = false;
  }

  onSupplierSearchInput(): void {
    this.supplierSearchSubject.next(this.supplierSearchTerm);
  }

  onSupplierDropdownScroll(event: any): void {
    const target = event.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10 && !this.loadingSuppliers && this.supplierPage < this.supplierTotalPages - 1) {
      this.supplierPage++;
      this.loadSuppliers();
    }
  }

  loadSuppliers(): void {
    this.loadingSuppliers = true;
    this.cdr.markForCheck();
    
    // Using getAll for simplicity if searchByTerm doesn't support pagination
    // Actually our SupplierService has searchByTerm but it returns Supplier[] directly
    // Let's use getAll with search if we can, or just getAll with page
    this.supplierService.getAll(this.supplierPage, 20, 'name,asc').pipe(
      finalize(() => {
        this.loadingSuppliers = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page: any) => {
        const content = page.content || [];
        // Filter by search term locally if backend doesn't support it in getAll
        const term = this.supplierSearchTerm.toLowerCase();
        const filtered = term ? content.filter((s: Supplier) => s.name.toLowerCase().includes(term)) : content;
        
        if (this.supplierPage === 0) this.suppliers = filtered;
        else this.suppliers = [...this.suppliers, ...filtered];
        
        this.supplierTotalPages = page.totalPages;
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError('No se pudieron cargar los proveedores.')
    });
  }

  onSupplierSelect(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.selectedSupplierId = supplier.id;
    this.showSupplierDropdown = false;
    this.clearSelection();
    this.productPage = 0;
    this.products = [];
    this.loadProducts();
    this.cdr.markForCheck();
  }

  // -- Product Dropdown Logic --
  toggleProductDropdown(): void {
    this.showProductDropdown = !this.showProductDropdown;
    if (this.showProductDropdown) {
      this.showSupplierDropdown = false;
      this.productPage = 0;
      this.products = [];
      this.loadProducts();
    }
  }

  closeProductDropdown(): void {
    this.showProductDropdown = false;
  }

  onProductSearchInput(): void {
    this.productSearchSubject.next(this.productSearchTerm);
  }

  openProductBarcodeScanner(): void {
    this.showProductScannerModal = true;
  }

  closeProductBarcodeScanner(): void {
    this.showProductScannerModal = false;
  }

  onScannedProductFound(product: Product): void {
    this.closeProductBarcodeScanner();

    if (!this.selectedProductIds.includes(product.id)) {
      this.selectedProductIds = [...this.selectedProductIds, product.id];
    }

    this.showProductDropdown = false;
    this.productSearchTerm = '';
    this.cdr.markForCheck();
  }

  onProductDropdownScroll(event: any): void {
    const target = event.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10 && !this.loadingProducts && this.productPage < this.productTotalPages - 1) {
      this.productPage++;
      this.loadProducts();
    }
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.cdr.markForCheck();

    // In a real app, we would use a specialized search endpoint that takes supplierId
    // For now, let's use getAll and filter
    this.productService.getAll(this.productPage, 50, 'name,asc').pipe(
      finalize(() => {
        this.loadingProducts = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page: any) => {
        let content = (page.content || []).filter((p: Product) => !p.hidden);
        
        // Filter by supplier if one is selected
        if (this.selectedSupplierId) {
          content = content.filter((p: Product) => p.supplier?.id === this.selectedSupplierId);
        }

        // Filter by search term
        const term = this.productSearchTerm.toLowerCase();
        if (term) {
          content = content.filter((p: Product) => p.name.toLowerCase().includes(term));
        }

        if (this.productPage === 0) this.products = content;
        else this.products = [...this.products, ...content];

        this.productTotalPages = page.totalPages;
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError('No se pudieron cargar los productos.')
    });
  }

  get filteredProducts(): Product[] {
    return this.products;
  }

  toggleProductSelection(productId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedProductIds.includes(productId)) {
        this.selectedProductIds = [...this.selectedProductIds, productId];
      }
      return;
    }

    this.selectedProductIds = this.selectedProductIds.filter(id => id !== productId);
  }

  selectAllFilteredProducts(): void {
    const filteredIds = this.filteredProducts.map(p => p.id);
    this.selectedProductIds = Array.from(new Set([...this.selectedProductIds, ...filteredIds]));
  }

  clearSelection(): void {
    this.selectedProductIds = [];
  }

  activateCrisis(): void {
    if (!this.selectedSupplierId) {
      this.messageService.showError('Debes seleccionar un proveedor.');
      return;
    }

    if (!this.selectedProductIds.length) {
      this.messageService.showError('Debes seleccionar al menos un producto.');
      return;
    }

    if (!this.reason.trim()) {
      this.messageService.showError('Debes indicar un motivo de crisis.');
      return;
    }

    if (!this.dateFrom || !this.dateTo) {
      this.messageService.showError('Debes completar el rango de fechas.');
      return;
    }

    const request: CrisisActivationRequest = {
      supplierId: this.selectedSupplierId,
      productIds: this.selectedProductIds,
      dateFrom: this.toIsoDateTime(this.dateFrom),
      dateTo: this.toIsoDateTime(this.dateTo),
      reason: this.reason.trim()
    };

    this.activating = true;
    this.traceabilityService.activateCrisis(request).pipe(
      finalize(() => this.activating = false)
    ).subscribe({
      next: crisis => {
        this.addOrUpdateCrisis(crisis);
        this.messageService.showSuccess(`Crisis ${crisis.crisisCode} activada correctamente.`);
        this.closeActivationModal();
      },
      error: (error) => {
        this.messageService.showError(error?.error?.message || 'No se pudo activar la crisis.');
      }
    });
  }

  openActivationModal(): void {
    this.showActivationModal = true;
    this.cdr.markForCheck();
  }

  closeActivationModal(): void {
    this.showActivationModal = false;
    this.selectedSupplier = null;
    this.selectedSupplierId = null;
    this.selectedProductIds = [];
    this.reason = '';
    // Keep dates as they are or reset them to current week
    this.cdr.markForCheck();
  }



  async liftCrisis(crisis: CrisisResponseDTO): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Levantar crisis',
      `¿Seguro que deseas levantar ${crisis.crisisCode}?`
    );

    if (!confirmed) {
      return;
    }

    const availabilityValue = this.liftAvailabilityByCrisis[crisis.crisisId];
    const parsedAvailability = availabilityValue === undefined || availabilityValue === ''
      ? undefined
      : Number(availabilityValue);

    if (parsedAvailability !== undefined && (Number.isNaN(parsedAvailability) || parsedAvailability < 0 || parsedAvailability > 100)) {
      this.messageService.showError('La disponibilidad debe estar entre 0 y 100.');
      return;
    }

    this.traceabilityService.liftCrisis({
      crisisId: crisis.crisisId,
      availabilityPercentage: parsedAvailability
    }).subscribe({
      next: () => {
        const lifted: CrisisResponseDTO = { ...crisis, status: 'LIFTED' };
        this.addOrUpdateCrisis(lifted);
        this.messageService.showSuccess(`Crisis ${crisis.crisisCode} levantada correctamente.`);
      },
      error: (error) => {
        this.messageService.showError(error?.error?.message || 'No se pudo levantar la crisis.');
      }
    });
  }

  async downloadReport(crisis: CrisisResponseDTO): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.traceabilityService.downloadCrisisReport(crisis.crisisId).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${crisis.crisisCode || `crisis-${crisis.crisisId}`}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      },
      error: () => this.messageService.showError('No se pudo descargar el reporte PDF.')
    });
  }

  openCrisisDetail(crisis: CrisisResponseDTO): void {
    this.selectedCrisis = crisis;
    this.showCrisisDetailModal = true;
    this.cdr.markForCheck();
  }

  closeCrisisDetail(): void {
    this.showCrisisDetailModal = false;
    setTimeout(() => {
      this.selectedCrisis = null;
      this.cdr.markForCheck();
    }, 300); // Wait for translation / animation
  }

  onActiveSearch(): void {
    const term = this.activeSearchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredActiveCrises = [...this.activeCrises];
      return;
    }
    this.filteredActiveCrises = this.activeCrises.filter(c => 
      c.crisisId.toString().includes(term) ||
      (c.crisisCode && c.crisisCode.toLowerCase().includes(term)) ||
      (c.supplierName && c.supplierName.toLowerCase().includes(term)) ||
      (c.reason && c.reason.toLowerCase().includes(term))
    );
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.cdr.markForCheck();
    this.traceabilityService.getCrisisHistory(this.historyPage, this.historySize, this.historySearchTerm).pipe(
      finalize(() => {
        this.loadingHistory = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.filteredHistoryCrises = response.content;
        this.historyTotalPages = response.totalPages;
        this.historyTotalElements = response.totalElements;
      },
      error: () => this.messageService.showError('No se pudo cargar el historial.')
    });
  }

  onHistorySearch(): void {
    this.historySearchSubject.next(this.historySearchTerm);
  }

  prevHistoryPage(): void {
    if (this.historyPage > 0) {
      this.historyPage--;
      this.loadHistory();
    }
  }

  nextHistoryPage(): void {
    if (this.historyPage < this.historyTotalPages - 1) {
      this.historyPage++;
      this.loadHistory();
    }
  }

  get currentCrises(): CrisisResponseDTO[] {
    return this.activeView === 'active' ? this.filteredActiveCrises : this.filteredHistoryCrises;
  }

  getBadgeClass(status: string): string {
    return status === 'ACTIVE' ? 'badge-active' : 'badge-lifted';
  }

  private addOrUpdateCrisis(crisis: CrisisResponseDTO): void {
    this.activeCrises = this.activeCrises.filter(c => c.crisisId !== crisis.crisisId);

    if (crisis.status === 'ACTIVE') {
      this.activeCrises = [crisis, ...this.activeCrises];
      this.onActiveSearch();
    }
  }

  private toIsoDateTime(dateTimeLocal: string): string {
    return dateTimeLocal.length === 16 ? `${dateTimeLocal}:00` : dateTimeLocal;
  }

  private toDateTimeLocal(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
