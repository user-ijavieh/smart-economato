import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { MessageService } from '../../../core/services/message.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, ProductRequest } from '../../../shared/models/product.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { ProductFormComponent } from './product-form/product-form.component';
import { ProductEditModalComponent } from './product-edit-modal/product-edit-modal.component';
import { ProductCreateModalComponent } from './product-create-modal/product-create-modal.component';
import { ProductDetailModalComponent } from './product-detail-modal/product-detail-modal.component';
import { BarcodeScannerComponent } from '../barcode-scanner/barcode-scanner.component';
import { ProductBatchService } from '../../../core/services/product-batch.service';
import { ProductBatchResponseDTO } from '../../../shared/models/product-batch.model';
import { ScrollService } from '../../../core/services/scroll.service';
import { finalize, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent, ProductEditModalComponent, ProductCreateModalComponent, ProductDetailModalComponent, BarcodeScannerComponent, BaseModalComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-15px)' }),
        animate('300ms cubic-bezier(0.175, 0.885, 0.32, 1.1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class InventoryComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private supplierService = inject(SupplierService);
  messageService = inject(MessageService);
  private authService = inject(AuthService);
  private productBatchService = inject(ProductBatchService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);

  // Listas de datos
  products: Product[] = [];
  suppliers: Supplier[] = [];

  // Expirations
  expiringBatches: ProductBatchResponseDTO[] = [];
  expiredBatches: ProductBatchResponseDTO[] = [];
  loadingExpirations = false;
  showExpirationsPanel = false;

  // Estado de la vista
  loading = false;
  initialLoad = true;
  searchTerm = '';
  private searchSubject = new Subject<string>();
  showForm = false;
  showEditModal = false;

  showCreateModal = false;
  showDetailModal = false;
  showScannerModal = false;
  selectedProduct: Product | null = null;

  // Pagination State
  page = 0;
  size = 20;
  totalElements = 0;
  totalPages = 0;

  // Sorting
  sortColumn = 'id';
  sortDir: 'asc' | 'desc' = 'asc';
  sortInteracted = false;

  ngOnInit(): void {
    this.loadProducts();
    // Solo cargar proveedores si el usuario puede editar productos
    if (this.isAdmin || this.authService.getRole() === 'CHEF') {
      this.loadSuppliers();
    }
    this.loadExpirations();
    
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  loadProducts(): void {
    this.loading = true;
    const sortParam = `${this.sortColumn},${this.sortDir}`;

    this.productService.getAll(this.page, this.size, sortParam).subscribe({
      next: (page) => {
        this.products = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading products:', err);
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
    this.scrollService.scrollToTop();
    this.cdr.detectChanges();
    // Delay loading to let the scroll start smoothly and button animation finish
    setTimeout(() => {
      this.loadProducts();
    }, 100);
  }

  // --- Expirations & Batches ---

  loadExpirations(): void {
    this.loadingExpirations = true;
    this.productBatchService.getExpiringBatches(15).subscribe({
      next: (batches) => {
        this.expiringBatches = batches;
        this.cdr.markForCheck();
      }
    });

    this.productBatchService.getExpiredBatches().subscribe({
      next: (batches) => {
        this.expiredBatches = batches;
        this.loadingExpirations = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingExpirations = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleExpirationsPanel(): void {
    this.showExpirationsPanel = !this.showExpirationsPanel;
  }

  async onWithdrawBatch(batch: ProductBatchResponseDTO): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Retirar lote',
      `¿Estás seguro de que deseas retirar el lote ${batch.id} de "${batch.productName}"? Se registrará como merma en el ledger.`
    );

    if (!confirmed) return;

    this.productBatchService.withdrawBatch(batch.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Lote retirado correctamente');
        this.loadExpirations();
        this.loadProducts(); // Reload main stock
      },
      error: (err) => {
        // Interceptor handles the message
      }
    });
  }

  onSizeChange(event: any): void {
    this.size = Number(event.target.value);
    this.page = 0; // Reset to first page
    this.loadProducts();
  }

  onSortChange(column: string): void {
    this.sortInteracted = true;
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.page = 0;
    this.scrollService.scrollToTop();
    this.cdr.detectChanges(); // Fix freeze on sort
    setTimeout(() => {
      this.loadProducts();
    }, 100);
  }

  loadSuppliers(): void {
    this.supplierService.getAll(0, 50).subscribe({
      next: (page) => {
        this.suppliers = page.content;
      },
      error: (err) => {
        console.error('Error cargando proveedores:', err);
        // No mostrar mensaje de error al usuario, no es crítico
        this.suppliers = [];
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  performSearch(term: string): void {
    if (!term || term.trim() === '') {
      this.loadProducts();
      return;
    }

    this.loading = true;
    const sortParam = `${this.sortColumn},${this.sortDir}`;

    this.productService.searchByName(term.trim(), this.page, this.size, sortParam).subscribe({
      next: (page) => {
        this.products = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error searching products:', err);
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      }
    });
  }



  clearFilters(): void {
    this.sortColumn = 'id';
    this.sortDir = 'asc';
    this.sortInteracted = false;
    this.page = 0;
    this.loadProducts();
  }

  hasActiveFilters(): boolean {
    return this.sortColumn !== 'id' || this.sortDir !== 'asc';
  }

  async exportToExcel(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo Excel?'
    );
    if (!confirmed) return;

    this.productService.exportToExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `productos_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.messageService.showSuccess('Excel descargado correctamente');
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }



  // --- LÓGICA DEL FORMULARIO ---

  toggleForm(): void {
    this.showCreateModal = true;
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  onCloseCreateModal(): void {
    this.showCreateModal = false;
  }

  editProduct(product: Product): void {
    this.selectedProduct = product;
    this.showEditModal = true;
  }

  onCancelForm(): void {
    this.showForm = false;
    this.selectedProduct = null;
  }

  onCloseEditModal(): void {
    this.showEditModal = false;

    // Keep selected product if the detail modal is still open underneath.
    if (!this.showDetailModal) {
      this.selectedProduct = null;
    }
  }

  onToggleHiddenFromModal(): void {
    if (!this.selectedProduct) return;

    // En el componente general, este método no debería ejecutarse
    // ya que el botón solo se muestra cuando isAdmin=true
    // Pero lo implementamos por compatibilidad
    this.productService.toggleHidden(this.selectedProduct.id, true).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto desactivado correctamente');
        this.showEditModal = false;
        this.selectedProduct = null;
        this.loadProducts();
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }

  onSaveEditedProduct(productData: ProductRequest): void {
    if (!this.selectedProduct) return;

    const editingProductId = this.selectedProduct.id;
    const keepDetailOpen = this.showDetailModal;

    this.productService.update(editingProductId, productData).subscribe({
      next: (response) => {
        this.messageService.showSuccess('Producto actualizado correctamente');

        // Close child modal and preserve parent detail modal state when stacked.
        this.showEditModal = false;

        if (keepDetailOpen && this.selectedProduct) {
          this.selectedProduct = {
            ...this.selectedProduct,
            ...productData,
            supplier: this.suppliers.find(s => s.id === productData.supplierId) || this.selectedProduct.supplier
          } as Product;
        } else {
          this.selectedProduct = null;
        }

        // Recargar la lista completa para asegurar que los datos estén sincronizados
        this.loadProducts();
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }

  onSaveProduct(productData: ProductRequest): void {
    this.productService.create(productData).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto creado correctamente');
        this.showCreateModal = false;
        this.loadProducts();
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }

  // --- LOGICA DEL MODAL DE DETALLES ---

  openDetailModal(product: Product): void {
    this.selectedProduct = product;
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  onCloseDetailModal(): void {
    this.showDetailModal = false;
    this.selectedProduct = null;
  }

  onEditFromDetail(product: Product): void {
    // Keep detail modal open and stack edit modal above it.
    this.editProduct(product);
  }


  // Método eliminado: onDeleteProduct() - ahora se usa toggleHidden en lugar de delete

  private softDeleteProduct(): void {
    if (!this.selectedProduct) return;

    // Validate and sanitize data
    const allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
    let unit = this.selectedProduct.unit || 'UND';
    if (!allowedUnits.includes(unit)) {
      unit = 'UND';
    }

    // Ensure price is valid
    let price = this.selectedProduct.unitPrice;
    if (!price || price < 0.01) {
      price = 0.01;
    }

    const productRequest: ProductRequest = {
      name: this.selectedProduct.name,
      productCode: this.selectedProduct.productCode || `PROD-${this.selectedProduct.id}`,
      unitPrice: price,
      price: price, // legacy?
      currentStock: this.selectedProduct.currentStock || 0,
      stock: this.selectedProduct.currentStock || 0, // legacy?
      unit: unit,
      supplierId: this.selectedProduct.supplier?.id,
      active: false
    };

    this.productService.update(this.selectedProduct.id, productRequest).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto desactivado correctamente');
        this.finalizeSubmit();
      },
      error: (err) => {
        console.error('Error deactivating product:', err);
      }
    });
  }

  private finalizeSubmit(): void {
    this.showForm = false;
    this.selectedProduct = null;
    this.loadProducts();
  }

  // --- LOGICA DEL ESCÁNER DE CÓDIGO DE BARRAS ---

  openBarcodeScanner(): void {
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
  }

  onProductFound(product: Product): void {
    this.closeBarcodeScanner();
    this.openDetailModal(product);
  }

  // --- UTILIDADES ---

  getSortDir(column: string): string {
    if (!this.sortInteracted) return 'none';
    return this.sortColumn === column ? this.sortDir : 'none';
  }

  get totalProducts(): number {
    return this.totalElements;
  }

  get totalValue(): number {
    return this.products.reduce((sum, p) => sum + (p.unitPrice * p.currentStock), 0);
  }

  isLowStock(product: Product): boolean {
    return false; // He eliminado el stock mínimo, así que no hay lógica de stock bajo aquí
  }

  get isAdmin(): boolean {
    return this.authService.getRole() === 'ADMIN';
  }

  get canManageProducts(): boolean {
    const role = this.authService.getRole();
    return role === 'ADMIN' || role === 'CHEF';
  }
}