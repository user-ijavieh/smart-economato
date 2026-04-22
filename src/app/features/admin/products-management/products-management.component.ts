import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { ProductAuditService } from '../../../core/services/product-audit.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { StatsService } from '../../../core/services/stats.service';
import { MessageService } from '../../../core/services/message.service';
import { Product, ProductRequest } from '../../../shared/models/product.model';
import { TranslateService } from '@ngx-translate/core';
import { Supplier } from '../../../shared/models/supplier.model';
import { ProductCreateModalComponent } from '../../general/inventory/product-create-modal/product-create-modal.component';
import { ProductEditModalComponent } from '../../general/inventory/product-edit-modal/product-edit-modal.component';
import { ProductDetailModalComponent } from '../../general/inventory/product-detail-modal/product-detail-modal.component';
import { BarcodeScannerComponent } from '../../general/barcode-scanner/barcode-scanner.component';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { ScrollService } from '../../../core/services/scroll.service';
import { PresenceTrackingService } from '../../../core/services/presence-tracking.service';
import { finalize, catchError, forkJoin, takeUntil } from 'rxjs';
import { of, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';
import { ProductAudit } from '../../../shared/models/product-audit.model';

@Component({
  selector: 'app-products-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductCreateModalComponent,
    ProductEditModalComponent,
    ProductDetailModalComponent,
    BarcodeScannerComponent,
    BaseModalComponent
  ],
  templateUrl: './products-management.component.html',
  styleUrl: './products-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsManagementComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private productAuditService = inject(ProductAuditService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private statsService = inject(StatsService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);
  private presenceTrackingService = inject(PresenceTrackingService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  messageService = inject(MessageService);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  // ── Tab state ──
  activeTab: 'products' | 'audits' = 'products';

  // ── Products state ──
  products: Product[] = [];
  filteredProducts: Product[] = [];
  suppliers: Supplier[] = [];
  loading = true;
  searchTerm = '';
  private searchSubject = new Subject<string>();
  showHiddenProducts = false; // Estado para mostrar/ocultar productos ocultos

  // Pagination state (Products)
  currentPage = 0;
  pageSize = 20;
  totalPages = 0;
  totalElements = 0;

  // Sorting state (Products)
  sortColumnProducts = 'name';
  sortDirProducts: 'asc' | 'desc' = 'asc';
  sortInteractedProducts = false;

  // Modal state
  showCreateModal = false;
  showEditModal = false;
  showDetailModal = false;
  showScannerModal = false;
  selectedProduct: Product | null = null;

  // Stats
  statTotalProducts = 0;
  statTotalValue = 0;
  statAveragePrice = 0;

  get totalProducts(): number { return this.statTotalProducts; }
  get totalValue(): number { return this.statTotalValue; }
  get averagePrice(): number { return this.statAveragePrice; }

  // ── Audits state ──
  audits: ProductAudit[] = [];
  filteredAudits: ProductAudit[] = [];
  loadingAudits = false;
  auditsLoaded = false;
  auditSearchTerm = '';
  private auditSearchSubject = new Subject<string>();
  auditMovementTypeFilter = '';
  auditStartDate = '';
  auditEndDate = '';
  userMap: { [id: number]: string } = {};
  loadingUsers = false;
  currentAuditPage = 0;
  totalAuditsCount = 0;
  totalAuditPages = 0;
  auditPageSize = 20;
  selectedAudit: ProductAudit | null = null;
  showAuditDetailModal = false;

  // Sorting state (Audits)
  sortColumnAudits = 'movementDate';
  sortDirAudits: 'asc' | 'desc' = 'desc';
  sortInteractedAudits = false;

  // Cache for audits by page + filters
  auditCache = new Map<string, any>();

  movementTypeOptions = [
    { value: 'MOSTRAR', label: 'Mostrar' },
    { value: 'OCULTAR', label: 'Ocultar' },
    { value: 'MODIFICACION', label: 'Modificación' },
    { value: 'CREACION', label: 'Creación' }
  ];

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadProducts();
    });

    this.auditSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentAuditPage = 0;
      this.loadAudits(0);
    });

    this.loadProducts();
    this.loadSuppliers();
    this.loadStats();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains, event }) => {
        let shouldReloadProducts = false;

        if (domains.includes('product')) {
          if (event.entityIds && event.entityIds.length > 0) {
            const hasVisibleIds = event.entityIds.some(id => this.products.some(p => p.id === id));
            if (hasVisibleIds) {
              shouldReloadProducts = true;
            } else if (event.action === 'CREATE' && this.currentPage === 0 && !this.searchTerm) {
              shouldReloadProducts = true;
            } else if (event.entityType !== 'product') {
              // If it comes from another entity (like Order), and we have IDs but none visible, don't reload.
              // Wait, if it comes from an order, maybe it affected stats of visible products?
              // `hasVisibleIds` handles it because the IDs extracted are product IDs!
              // So if none of our visible products were in the order, we don't need to reload.
            }
          } else {
            // No specific entity IDs provided = global invalidation or operation like DELETE order
            // that affects products but couldn't isolate the IDs. Reload to be safe.
            shouldReloadProducts = true;
          }
        }

        if (shouldReloadProducts && !this.loading) {
          this.loadProducts(this.currentPage);
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
    this.auditSearchSubject.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Tab switching ──

  switchTab(tab: 'products' | 'audits'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.scrollService.scrollToTop();

    if (tab === 'audits' && !this.auditsLoaded) {
      this.loadAudits();
    }
  }

  // ── Products ──

  loadProducts(page: number = 0): void {
    this.currentPage = page;
    this.loading = true;
    this.cdr.detectChanges();

    const sortParam = `${this.sortColumnProducts},${this.sortDirProducts}`;
    let source$;

    if (this.showHiddenProducts) {
      // Cargar productos ocultos
      source$ = this.productService.getHidden(page, this.pageSize, sortParam);
    } else if (this.searchTerm.trim()) {
      source$ = this.productService.searchByName(this.searchTerm.trim(), page, this.pageSize, sortParam);
    } else {
      source$ = this.productService.getAll(page, this.pageSize, sortParam);
    }

    source$.pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.products = response.content;
        this.filteredProducts = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error al cargar productos:', err);
        this.messageService.showError(this.translate.instant('PRODUCTS_MGMT.MESSAGES.LOAD_ERROR'));
        this.products = [];
        this.filteredProducts = [];
        this.cdr.markForCheck();
      }
    });
  }

  toggleShowHidden(): void {
    this.showHiddenProducts = !this.showHiddenProducts;
    this.searchTerm = ''; // Limpiar búsqueda al cambiar vista
    this.currentPage = 0;
    this.loading = true; // Forzar loading state
    this.products = []; // Limpiar productos anteriores
    this.filteredProducts = [];
    this.cdr.detectChanges();

    setTimeout(() => {
      this.loadProducts();
    });
  }

  loadSuppliers(): void {
    this.supplierService.getAll(0, 50).subscribe({
      next: (page) => {
        this.suppliers = page.content;
        this.cdr.markForCheck();
      },
      error: () => {
        this.suppliers = [];
      }
    });
  }

  loadStats(): void {
    this.statsService.getProductStats().subscribe({
      next: (stats) => {
        this.statTotalProducts = stats.totalProducts || 0;
        this.statTotalValue = stats.totalInventoryValue || 0;
        this.statAveragePrice = stats.averagePrice || 0;
        this.cdr.markForCheck();
      },
      error: () => {
        // Silent fail
      }
    });
  }

  onSortProductsChange(column: string): void {
    this.sortInteractedProducts = true;
    if (this.sortColumnProducts === column) {
      this.sortDirProducts = this.sortDirProducts === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumnProducts = column;
      this.sortDirProducts = 'asc';
    }
    this.currentPage = 0;
    this.loadProducts(0);
  }

  getSortProductsDir(column: string): string {
    if (!this.sortInteractedProducts && this.sortColumnProducts !== column) return 'none';
    return this.sortColumnProducts === column ? this.sortDirProducts : 'none';
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

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

  clearFilters(): void {
    this.searchTerm = '';
    this.currentPage = 0;
    this.loadProducts();
  }

  changePage(delta: number): void {
    const newPage = this.currentPage + delta;
    if (newPage >= 0 && newPage < this.totalPages) {
      this.scrollService.scrollToTop();
      this.loadProducts(newPage);
    }
  }

  hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0;
  }

  isLowStock(product: Product): boolean {
    return false; // He eliminado el stock mínimo
  }

  getSupplierName(supplierId?: number): string {
    if (!supplierId) return '—';
    const supplier = this.suppliers.find(s => s.id === supplierId);
    return supplier?.name || '—';
  }

  // ── Audits ──

  loadAudits(page: number = 0): void {
    this.currentAuditPage = page;
    
    // Construir clave de cache con todos los filtros
    const cacheKey = [
      `page:${page}`,
      `sort:${this.sortColumnAudits},${this.sortDirAudits}`,
      this.auditSearchTerm ? `search:${this.auditSearchTerm}` : '',
      this.auditMovementTypeFilter ? `type:${this.auditMovementTypeFilter}` : '',
      this.auditStartDate ? `start:${this.auditStartDate}` : '',
      this.auditEndDate ? `end:${this.auditEndDate}` : ''
    ].filter(Boolean).join('-');

    if (this.auditCache.has(cacheKey)) {
      const cachedData = this.auditCache.get(cacheKey);
      this.audits = cachedData.content;
      this.filteredAudits = cachedData.content;
      this.totalAuditsCount = cachedData.totalElements;
      this.totalAuditPages = cachedData.totalPages;
      this.loadingAudits = false;
      this.loadUsersForAudits();
      this.auditsLoaded = true;
      this.cdr.detectChanges();
      return;
    }

    this.loadingAudits = true;
    this.cdr.detectChanges();

    // Construir filtros para el backend
    const filters: any = {};
    
    if (this.auditSearchTerm.trim()) {
      filters.productName = this.auditSearchTerm.trim();
    }
    
    if (this.auditMovementTypeFilter) {
      filters.type = this.auditMovementTypeFilter;
    }
    
    if (this.auditStartDate && this.auditEndDate) {
      filters.startDate = `${this.auditStartDate}T00:00:00`;
      filters.endDate = `${this.auditEndDate}T23:59:59`;
    }

    const auditSortParam = [`${this.sortColumnAudits},${this.sortDirAudits}`];

    this.productAuditService.getAll(filters, this.currentAuditPage, this.auditPageSize, auditSortParam).pipe(
      finalize(() => {
        this.loadingAudits = false;
        this.auditsLoaded = true;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        let auditsArray: any[] = [];
        if (Array.isArray(response)) {
          auditsArray = response;
          this.totalAuditsCount = auditsArray.length;
          this.totalAuditPages = 1;
        } else if (response && Array.isArray((response as any).content)) {
          auditsArray = (response as any).content;
          this.totalAuditsCount = (response as any).totalElements;
          this.totalAuditPages = (response as any).totalPages;
        } else {
          console.warn('Respuesta inesperada del servicio de auditorías:', response);
        }

        this.audits = auditsArray;
        this.filteredAudits = auditsArray; // Ahora son lo mismo (backend filtra)

        this.auditCache.set(cacheKey, {
          content: this.audits,
          totalElements: this.totalAuditsCount,
          totalPages: this.totalAuditPages
        });

        this.loadUsersForAudits();
        this.cdr.detectChanges();
      },
      error: () => {
        this.messageService.showError(this.translate.instant('PRODUCTS_MGMT.AUDITS.MESSAGES.LOAD_ERROR'));
      }
    });
  }

  onAuditSearch(): void {
    this.auditSearchSubject.next(this.auditSearchTerm);
  }

  onAuditMovementTypeFilterChange(): void {
    this.currentAuditPage = 0;
    this.loadAudits(0);
  }

  onSortAuditsChange(column: string): void {
    this.sortInteractedAudits = true;
    if (this.sortColumnAudits === column) {
      this.sortDirAudits = this.sortDirAudits === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumnAudits = column;
      this.sortDirAudits = 'desc';
    }
    this.currentAuditPage = 0;
    this.loadAudits(0);
  }

  getSortAuditsDir(column: string): string {
    if (!this.sortInteractedAudits && this.sortColumnAudits !== column) return 'none';
    return this.sortColumnAudits === column ? this.sortDirAudits : 'none';
  }

  changeAuditPage(delta: number): void {
    const newPage = this.currentAuditPage + delta;
    if (newPage >= 0 && newPage < this.totalAuditPages) {
      this.scrollService.scrollToTop();
      this.loadAudits(newPage);
    }
  }

  onAuditDateFilterChange(): void {
    this.currentAuditPage = 0;
    this.loadAudits(0);
  }

  clearAuditFilters(): void {
    this.auditSearchTerm = '';
    this.auditMovementTypeFilter = '';
    this.auditStartDate = '';
    this.auditEndDate = '';
    this.currentAuditPage = 0;
    this.auditCache.clear();
    this.loadAudits(0);
  }

  hasActiveAuditFilters(): boolean {
    return this.auditSearchTerm.trim().length > 0 ||
      this.auditMovementTypeFilter.length > 0 ||
      this.auditStartDate.length > 0 ||
      this.auditEndDate.length > 0;
  }

  loadUsersForAudits(): void {
    const userIds = [...new Set(this.audits.map(a => a.userId))];
    
    // Filtrar solo los IDs de usuarios que NO están en el mapa
    const missingUserIds = userIds.filter(id => !this.userMap[id]);
    
    if (missingUserIds.length === 0) {
      this.loadingUsers = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadingUsers = true;
    this.cdr.detectChanges();

    forkJoin(
      missingUserIds.map(id =>
        this.userService.getById(id).pipe(
          catchError(() => of({ id, username: 'Usuario desconocido' }))
        )
      )
    ).pipe(
      finalize(() => {
        this.loadingUsers = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (users: any[]) => {
        users.forEach(user => {
          this.userMap[user.id] = user.username || user.name || this.translate.instant('COMMON.UNKNOWN_USER');
        });
        this.cdr.markForCheck();
      }
    });
  }

  getUserName(userId: number): string {
    return this.userMap[userId] || 'Cargando...';
  }

  translateActionDescription(description: string): string {
    const translations: { [key: string]: string } = {
      'HIDE_PRODUCT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.HIDE_PRODUCT'),
      'SHOW_PRODUCT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.SHOW_PRODUCT'),
      'UPDATE_PRODUCT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.UPDATE_PRODUCT'),
      'CREATE_PRODUCT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.CREATE_PRODUCT'),
      'DELETE_PRODUCT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.DELETE_PRODUCT'),
      'STOCK_ADJUSTMENT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.STOCK_ADJUSTMENT'),
      'STOCK_IN': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.STOCK_IN'),
      'STOCK_OUT': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.STOCK_OUT'),
      'PRICE_UPDATE': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.PRICE_UPDATE'),
      'SUPPLIER_CHANGE': this.translate.instant('PRODUCTS_MGMT.AUDITS.ACTIONS.SUPPLIER_CHANGE')
    };
    return translations[description] || description;
  }

  openAuditDetailModal(audit: ProductAudit): void {
    this.selectedAudit = audit;
    this.showAuditDetailModal = true;
    this.presenceTrackingService.reportModal('Detalle de movimiento de producto');
  }

  closeAuditDetailModal(): void {
    this.showAuditDetailModal = false;
    this.selectedAudit = null;
    this.presenceTrackingService.clearContext();
  }

  // ── Product Modals ──

  openCreateModal(): void {
    this.showCreateModal = true;
    this.presenceTrackingService.reportModal('Creación de producto');
  }

  onCloseCreateModal(): void {
    this.showCreateModal = false;
    this.presenceTrackingService.clearContext();
  }

  onSaveProduct(productData: ProductRequest): void {
    this.productService.create(productData).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('PRODUCTS_MGMT.MESSAGES.CREATE_SUCCESS'));
        this.showCreateModal = false;
        this.presenceTrackingService.clearContext();
        this.loadProducts(this.currentPage);
        this.loadStats();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || this.translate.instant('PRODUCTS_MGMT.MESSAGES.CREATE_ERROR');
        this.messageService.showError(errorMessage);
      }
    });
  }

  openEditModal(product: Product): void {
    this.selectedProduct = product;
    this.showEditModal = true;
    this.presenceTrackingService.reportModal('Edición de producto', product.name);
  }

  onCloseEditModal(): void {
    this.showEditModal = false;

    // If detail modal is still open, keep selected product so parent modal remains mounted.
    if (!this.showDetailModal) {
      this.selectedProduct = null;
    }

    this.presenceTrackingService.clearContext();
  }

  onSaveEditedProduct(productData: ProductRequest): void {
    if (!this.selectedProduct) return;

    const editingProductId = this.selectedProduct.id;
    const keepDetailOpen = this.showDetailModal;

    this.productService.update(editingProductId, productData).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('PRODUCTS_MGMT.MESSAGES.UPDATE_SUCCESS'));
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

        this.presenceTrackingService.clearContext();
        this.loadProducts(this.currentPage);
        this.loadStats();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || this.translate.instant('PRODUCTS_MGMT.MESSAGES.UPDATE_ERROR');
        this.messageService.showError(errorMessage);
      }
    });
  }

  onToggleHiddenFromModal(): void {
    if (!this.selectedProduct) return;

    // El estado actual es el inverso: si están mostrándose ocultos, el producto está oculto
    const currentlyHidden = this.showHiddenProducts;
    const newHiddenState = !currentlyHidden;
    const actionText = newHiddenState ? 'desactivado' : 'activado';

    this.productService.toggleHidden(this.selectedProduct.id, newHiddenState).subscribe({
      next: () => {
        const actionLabel = newHiddenState ? 
          this.translate.instant('PRODUCTS_MGMT.MESSAGES.ACTION_HIDDEN') : 
          this.translate.instant('PRODUCTS_MGMT.MESSAGES.ACTION_SHOWN');
        
        this.messageService.showSuccess(this.translate.instant('PRODUCTS_MGMT.MESSAGES.TOGGLE_HIDDEN_SUCCESS', { action: actionLabel }));
        this.showEditModal = false;
        this.selectedProduct = null;
        this.presenceTrackingService.clearContext();
        
        // Recargar la vista actual - el producto desaparecerá de la lista actual
        // porque ya no cumple el criterio (oculto vs activo)
        this.currentPage = 0; // Volver a la primera página
        this.loadProducts(0);
        this.loadStats();
      },
      error: (err: any) => {
        const errorMessage = err.error?.message || err.message || `Error al ${newHiddenState ? 'desactivar' : 'activar'} producto`;
        this.messageService.showError(errorMessage);
      }
    });
  }

  openDetailModal(product: Product): void {
    this.selectedProduct = product;
    this.showDetailModal = true;
    this.presenceTrackingService.reportModal('Detalle de producto', product.name);
  }

  onCloseDetailModal(): void {
    this.showDetailModal = false;
    this.selectedProduct = null;
    this.presenceTrackingService.clearContext();
  }

  onEditFromDetail(product: Product): void {
    // Keep detail open and show edit as a stacked modal above it.
    this.openEditModal(product);
  }


  async exportToExcel(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('COMMON.PDF_CONFIRM_TITLE'),
      this.translate.instant('COMMON.PDF_CONFIRM_MSG')
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
        this.messageService.showSuccess(this.translate.instant('PRODUCTS_MGMT.MESSAGES.EXCEL_SUCCESS'));
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || this.translate.instant('PRODUCTS_MGMT.MESSAGES.EXCEL_ERROR');
        this.messageService.showError(errorMessage);
      }
    });
  }

  // ── Diff Helpers ──

  get parsedPreviousState(): any | null {
    if (!this.selectedAudit?.previousState) return null;
    try { return JSON.parse(this.selectedAudit.previousState); }
    catch { return null; }
  }

  get parsedNewState(): any | null {
    if (!this.selectedAudit?.newState) return null;
    try { return JSON.parse(this.selectedAudit.newState); }
    catch { return null; }
  }

  get hasDiffData(): boolean {
    return this.parsedPreviousState !== null && this.parsedNewState !== null;
  }

  getDiffFields(): { label: string; prev: string; next: string; changed: boolean }[] {
    const prev = this.parsedPreviousState;
    const next = this.parsedNewState;
    if (!prev || !next) return [];

    const fields: { label: string; prev: string; next: string; changed: boolean }[] = [];

    // Nombre
    fields.push({
      label: 'PRODUCTS_MGMT.AUDITS.FIELDS.NAME',
      prev: prev.nombre ?? '',
      next: next.nombre ?? '',
      changed: prev.nombre !== next.nombre
    });

    // Código de Producto
    fields.push({
      label: 'PRODUCTS_MGMT.AUDITS.FIELDS.CODE',
      prev: prev.codigoProducto ?? '',
      next: next.codigoProducto ?? '',
      changed: prev.codigoProducto !== next.codigoProducto
    });

    // Unidad
    fields.push({
      label: 'PRODUCTS_MGMT.AUDITS.FIELDS.UNIT',
      prev: prev.unidad ?? '',
      next: next.unidad ?? '',
      changed: prev.unidad !== next.unidad
    });

    // Precio Unitario
    const prevPrice = prev.precioUnitario?.toFixed(2) ?? '0.00';
    const nextPrice = next.precioUnitario?.toFixed(2) ?? '0.00';
    fields.push({
      label: 'PRODUCTS_MGMT.AUDITS.FIELDS.UNIT_PRICE',
      prev: prevPrice + ' €',
      next: nextPrice + ' €',
      changed: prevPrice !== nextPrice
    });

    // Disponibilidad (si existe)
    if (prev.disponibilidad !== undefined || next.disponibilidad !== undefined) {
      const prevAvail = prev.disponibilidad !== undefined ? prev.disponibilidad + '%' : 'PRODUCTS_MGMT.AUDITS.FIELDS.NOT_DEFINED';
      const nextAvail = next.disponibilidad !== undefined ? next.disponibilidad + '%' : 'PRODUCTS_MGMT.AUDITS.FIELDS.NOT_DEFINED';
      fields.push({
        label: 'PRODUCTS_MGMT.AUDITS.FIELDS.AVAILABILITY',
        prev: prevAvail,
        next: nextAvail,
        changed: prevAvail !== nextAvail
      });
    }

    // Oculto
    fields.push({
      label: 'PRODUCTS_MGMT.AUDITS.FIELDS.HIDDEN',
      prev: prev.oculto ? 'PRODUCTS_MGMT.AUDITS.FIELDS.YES' : 'PRODUCTS_MGMT.AUDITS.FIELDS.NO',
      next: next.oculto ? 'PRODUCTS_MGMT.AUDITS.FIELDS.YES' : 'PRODUCTS_MGMT.AUDITS.FIELDS.NO',
      changed: prev.oculto !== next.oculto
    });

    return fields;
  }
}
