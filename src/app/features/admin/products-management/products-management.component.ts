import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { ProductAuditService } from '../../../core/services/product-audit.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { StatsService } from '../../../core/services/stats.service';
import { MessageService } from '../../../core/services/message.service';
import { Product, ProductRequest } from '../../../shared/models/product.model';
import { ProductAudit } from '../../../shared/models/product-audit.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { ProductCreateModalComponent } from '../../general/inventory/product-create-modal/product-create-modal.component';
import { ProductEditModalComponent } from '../../general/inventory/product-edit-modal/product-edit-modal.component';
import { ProductDetailModalComponent } from '../../general/inventory/product-detail-modal/product-detail-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { PresenceTrackingService } from '../../../core/services/presence-tracking.service';
import { finalize, catchError, forkJoin } from 'rxjs';
import { of } from 'rxjs';

@Component({
  selector: 'app-products-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductCreateModalComponent,
    ProductEditModalComponent,
    ProductDetailModalComponent,
    ConfirmDialogComponent,
    ToastComponent
  ],
  templateUrl: './products-management.component.html',
  styleUrl: './products-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsManagementComponent implements OnInit {
  private productService = inject(ProductService);
  private productAuditService = inject(ProductAuditService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private statsService = inject(StatsService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);
  private presenceTrackingService = inject(PresenceTrackingService);
  messageService = inject(MessageService);

  // ── Tab state ──
  activeTab: 'products' | 'audits' = 'products';

  // ── Products state ──
  products: Product[] = [];
  filteredProducts: Product[] = [];
  suppliers: Supplier[] = [];
  loading = true;
  searchTerm = '';
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
    this.loadProducts();
    this.loadSuppliers();
    this.loadStats();
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
        this.messageService.showError('Error al cargar los productos');
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
    this.supplierService.getAll(0, 100).subscribe({
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
    this.currentPage = 0;
    this.loadProducts();
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
        this.messageService.showError('Error al cargar las auditorías');
      }
    });
  }

  onAuditSearch(): void {
    this.currentAuditPage = 0;
    this.loadAudits(0);
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
          this.userMap[user.id] = user.username || user.name || 'Usuario desconocido';
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
      'HIDE_PRODUCT': 'Producto desactivado',
      'SHOW_PRODUCT': 'Producto activado',
      'UPDATE_PRODUCT': 'Producto actualizado',
      'CREATE_PRODUCT': 'Producto creado',
      'DELETE_PRODUCT': 'Producto eliminado',
      'STOCK_ADJUSTMENT': 'Ajuste de stock',
      'STOCK_IN': 'Entrada de stock',
      'STOCK_OUT': 'Salida de stock',
      'PRICE_UPDATE': 'Actualización de precio',
      'SUPPLIER_CHANGE': 'Cambio de proveedor'
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
        this.messageService.showSuccess('Producto creado correctamente');
        this.showCreateModal = false;
        this.presenceTrackingService.clearContext();
        this.loadProducts(this.currentPage);
        this.loadStats();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Error al crear producto';
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
    this.selectedProduct = null;
    this.presenceTrackingService.clearContext();
  }

  onSaveEditedProduct(productData: ProductRequest): void {
    if (!this.selectedProduct) return;

    this.productService.update(this.selectedProduct.id, productData).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto actualizado correctamente');
        this.showEditModal = false;
        this.selectedProduct = null;
        this.presenceTrackingService.clearContext();
        this.loadProducts(this.currentPage);
        this.loadStats();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Error al actualizar producto';
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
        this.messageService.showSuccess(`Producto ${actionText} correctamente`);
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
    this.showDetailModal = false;
    this.openEditModal(product);
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
        const errorMessage = err.error?.message || err.message || 'Error al descargar Excel';
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
      label: 'Nombre',
      prev: prev.nombre ?? '',
      next: next.nombre ?? '',
      changed: prev.nombre !== next.nombre
    });

    // Código de Producto
    fields.push({
      label: 'Código',
      prev: prev.codigoProducto ?? '',
      next: next.codigoProducto ?? '',
      changed: prev.codigoProducto !== next.codigoProducto
    });

    // Unidad
    fields.push({
      label: 'Unidad',
      prev: prev.unidad ?? '',
      next: next.unidad ?? '',
      changed: prev.unidad !== next.unidad
    });

    // Precio Unitario
    const prevPrice = prev.precioUnitario?.toFixed(2) ?? '0.00';
    const nextPrice = next.precioUnitario?.toFixed(2) ?? '0.00';
    fields.push({
      label: 'Precio Unitario',
      prev: prevPrice + ' €',
      next: nextPrice + ' €',
      changed: prevPrice !== nextPrice
    });

    // Stock Actual
    const prevStock = prev.stockActual?.toFixed(3) ?? '0.000';
    const nextStock = next.stockActual?.toFixed(3) ?? '0.000';
    fields.push({
      label: 'Stock Actual',
      prev: prevStock,
      next: nextStock,
      changed: prevStock !== nextStock
    });

    // Stock Mínimo (si existe)
    if (prev.stockMinimo !== undefined || next.stockMinimo !== undefined) {
      const prevMinStock = prev.stockMinimo?.toFixed(3) ?? 'No definido';
      const nextMinStock = next.stockMinimo?.toFixed(3) ?? 'No definido';
      fields.push({
        label: 'Stock Mínimo',
        prev: prevMinStock,
        next: nextMinStock,
        changed: prevMinStock !== nextMinStock
      });
    }

    // Disponibilidad (si existe)
    if (prev.disponibilidad !== undefined || next.disponibilidad !== undefined) {
      const prevAvail = prev.disponibilidad !== undefined ? prev.disponibilidad + '%' : 'No definido';
      const nextAvail = next.disponibilidad !== undefined ? next.disponibilidad + '%' : 'No definido';
      fields.push({
        label: 'Disponibilidad',
        prev: prevAvail,
        next: nextAvail,
        changed: prevAvail !== nextAvail
      });
    }

    // Oculto
    fields.push({
      label: 'Oculto',
      prev: prev.oculto ? 'Sí' : 'No',
      next: next.oculto ? 'Sí' : 'No',
      changed: prev.oculto !== next.oculto
    });

    return fields;
  }
}
