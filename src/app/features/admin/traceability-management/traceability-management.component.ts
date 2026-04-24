import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';
import { SupplierService } from '../../../core/services/supplier.service';
import { TraceabilityService } from '../../../core/services/traceability.service';
import { ProductService } from '../../../core/services/product.service';
import { MessageService } from '../../../core/services/message.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../general/barcode-scanner/barcode-scanner.component';
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
  imports: [FormsModule, BaseModalComponent, BarcodeScannerComponent, DatePipe, DecimalPipe, TranslateModule],
  templateUrl: './traceability-management.component.html',
  styleUrl: './traceability-management.component.css'
})
export class TraceabilityManagementComponent implements OnInit, OnDestroy {
  private traceabilityService = inject(TraceabilityService);
  private supplierService = inject(SupplierService);
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private translate = inject(TranslateService);
  messageService = inject(MessageService);

  private destroy$ = new Subject<void>();

  activeView: CrisisView = 'active';
  activating = false;
  searching = false;
  showActivationModal = false;
  loadingActive = false;

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
  activeVisibleCrises: CrisisResponseDTO[] = [];
  activePage = 0;
  activeSize = 10;
  loadingActiveMore = false;
  activeHasMore = false;
  liftedCrises: CrisisResponseDTO[] = [];
  filteredHistoryCrises: CrisisResponseDTO[] = [];
  liftAvailabilityByCrisis: Record<number, string> = {};

  historyPage = 0;
  historySize = 10;
  historyTotalPages = 0;
  historyTotalElements = 0;
  loadingHistory = false;
  loadingHistoryMore = false;
  historyHasMore = true;
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

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('crisis')) {
          if (this.activeView === 'active') {
            this.loadCrises();
          } else {
            this.loadHistory();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCrises(): void {
    this.loadingActive = true;
    this.traceabilityService.getCrises().pipe(
      finalize(() => {
        this.loadingActive = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: crises => {
        this.activeCrises = [];
        crises.forEach(c => {
          if (c.status === 'ACTIVE') {
            this.addOrUpdateCrisis(c);
          }
        });
        this.onActiveSearch();
      },
      error: () => this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.LOAD_ERROR'))
    });
  }

  private setupSearchDebounce(): void {
    this.supplierSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.supplierPage = 0;
      this.suppliers = [];
      this.loadSuppliers();
    });

    this.productSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.productPage = 0;
      this.products = [];
      this.loadProducts();
    });

    this.historySearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe((_: string) => {
      this.historyPage = 0;
      this.historyHasMore = true;
      this.loadHistory(false);
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
    
    this.supplierService.getAll(this.supplierPage, 20, 'name,asc').pipe(
      finalize(() => {
        this.loadingSuppliers = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page: any) => {
        const content = page.content || [];
        const term = this.supplierSearchTerm.toLowerCase();
        const filtered = term ? content.filter((s: Supplier) => s.name.toLowerCase().includes(term)) : content;
        
        if (this.supplierPage === 0) this.suppliers = filtered;
        else this.suppliers = [...this.suppliers, ...filtered];
        
        this.supplierTotalPages = page.totalPages;
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError(this.translate.instant('COMMON.ERROR_LOADING_SUPPLIERS'))
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

    this.productService.getWithLedger(
      this.productSearchTerm,
      this.productPage,
      50,
      'name,asc'
    ).pipe(
      finalize(() => {
        this.loadingProducts = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page: any) => {
        let content = page.content || [];

        if (this.selectedSupplierId) {
          content = content.filter((p: Product) => p.supplier?.id === this.selectedSupplierId);
        }

        if (this.productPage === 0) this.products = content;
        else this.products = [...this.products, ...content];

        this.productTotalPages = page.totalPages;
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError(this.translate.instant('COMMON.ERROR_LOADING_PRODUCTS'))
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
      this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.SELECT_SUPPLIER'));
      return;
    }

    if (!this.selectedProductIds.length) {
      this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.SELECT_PRODUCTS'));
      return;
    }

    if (!this.reason.trim()) {
      this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.REASON_REQUIRED'));
      return;
    }

    if (!this.dateFrom || !this.dateTo) {
      this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.DATES_REQUIRED'));
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
        this.messageService.showSuccess(this.translate.instant('TRACEABILITY.MESSAGES.ACTIVATE_SUCCESS', { code: crisis.crisisCode }));
        this.closeActivationModal();
      },
      error: (error) => {
        this.messageService.showError(error?.error?.message || this.translate.instant('TRACEABILITY.MESSAGES.ACTIVATE_ERROR'));
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
    this.cdr.markForCheck();
  }



  async liftCrisis(crisis: CrisisResponseDTO): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('TRACEABILITY.MESSAGES.LIFT_CONFIRM_TITLE'),
      this.translate.instant('TRACEABILITY.MESSAGES.LIFT_CONFIRM_MSG', { code: crisis.crisisCode })
    );

    if (!confirmed) {
      return;
    }

    const availabilityValue = this.liftAvailabilityByCrisis[crisis.crisisId];
    const parsedAvailability = availabilityValue === undefined || availabilityValue === ''
      ? undefined
      : Number(availabilityValue);

    if (parsedAvailability !== undefined && (Number.isNaN(parsedAvailability) || parsedAvailability < 0 || parsedAvailability > 100)) {
      this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.INVALID_AVAILABILITY'));
      return;
    }

    this.traceabilityService.liftCrisis({
      crisisId: crisis.crisisId,
      availabilityPercentage: parsedAvailability
    }).subscribe({
      next: () => {
        const lifted: CrisisResponseDTO = { ...crisis, status: 'LIFTED' };
        this.addOrUpdateCrisis(lifted);
        this.messageService.showSuccess(this.translate.instant('TRACEABILITY.MESSAGES.LIFT_SUCCESS', { code: crisis.crisisCode }));
      },
      error: (error) => {
        this.messageService.showError(error?.error?.message || this.translate.instant('TRACEABILITY.MESSAGES.LIFT_ERROR'));
      }
    });
  }

  async downloadReport(crisis: CrisisResponseDTO): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('COMMON.PDF_CONFIRM_TITLE'),
      this.translate.instant('COMMON.PDF_CONFIRM_MSG')
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
        this.messageService.showSuccess(this.translate.instant('COMMON.PDF_SUCCESS'));
      },
      error: () => this.messageService.showError(this.translate.instant('COMMON.PDF_ERROR'))
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
    }, 300);
  }

  onActiveSearch(): void {
    const term = this.activeSearchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredActiveCrises = [...this.activeCrises];
      this.resetActiveLazyState();
      return;
    }
    this.filteredActiveCrises = this.activeCrises.filter(c => 
      c.crisisId.toString().includes(term) ||
      (c.crisisCode && c.crisisCode.toLowerCase().includes(term)) ||
      (c.supplierName && c.supplierName.toLowerCase().includes(term)) ||
      (c.reason && c.reason.toLowerCase().includes(term))
    );
    this.resetActiveLazyState();
  }

  onActiveScroll(event: Event): void {
    if (this.activeView !== 'active') {
      return;
    }

    const target = event.target as HTMLElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 80;

    if (nearBottom) {
      this.loadNextActivePage();
    }
  }

  loadNextActivePage(): void {
    if (!this.activeHasMore || this.loadingActiveMore) {
      return;
    }

    this.loadingActiveMore = true;
    this.activePage++;
    this.appendActivePage();
    this.loadingActiveMore = false;
    this.cdr.markForCheck();
  }

  private resetActiveLazyState(): void {
    this.activePage = 0;
    this.activeVisibleCrises = [];
    this.activeHasMore = this.filteredActiveCrises.length > 0;
    this.appendActivePage();
  }

  private appendActivePage(): void {
    const endExclusive = (this.activePage + 1) * this.activeSize;
    this.activeVisibleCrises = this.filteredActiveCrises.slice(0, endExclusive);
    this.activeHasMore = this.activeVisibleCrises.length < this.filteredActiveCrises.length;
  }

  loadHistory(append = false): void {
    if (append && (!this.historyHasMore || this.loadingHistory || this.loadingHistoryMore)) {
      return;
    }

    if (append) {
      this.loadingHistoryMore = true;
    } else {
      this.loadingHistory = true;
    }

    this.cdr.markForCheck();
    this.traceabilityService.getCrisisHistory(this.historyPage, this.historySize, this.historySearchTerm).pipe(
      finalize(() => {
        this.loadingHistory = false;
        this.loadingHistoryMore = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        const incoming = response.content || [];

        if (append) {
          const existingIds = new Set(this.filteredHistoryCrises.map(item => item.crisisId));
          const uniqueIncoming = incoming.filter((item: CrisisResponseDTO) => !existingIds.has(item.crisisId));
          this.filteredHistoryCrises = [...this.filteredHistoryCrises, ...uniqueIncoming];
        } else {
          this.filteredHistoryCrises = incoming;
        }

        this.historyTotalPages = response.totalPages;
        this.historyTotalElements = response.totalElements;
        this.historyHasMore = this.historyPage < this.historyTotalPages - 1;
      },
      error: () => this.messageService.showError(this.translate.instant('TRACEABILITY.MESSAGES.HISTORY_LOAD_ERROR'))
    });
  }

  onHistorySearch(): void {
    this.historySearchSubject.next(this.historySearchTerm);
  }

  onHistoryScroll(event: Event): void {
    if (this.activeView !== 'history') {
      return;
    }

    const target = event.target as HTMLElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 80;

    if (nearBottom) {
      this.loadNextHistoryPage();
    }
  }

  loadNextHistoryPage(): void {
    if (!this.historyHasMore || this.loadingHistory || this.loadingHistoryMore) {
      return;
    }

    this.historyPage++;
    this.loadHistory(true);
  }

  onHistoryRowClick(crisis: CrisisResponseDTO): void {
    if (window.innerWidth > 768) {
      return;
    }
    this.openCrisisDetail(crisis);
  }

  stopRowClick(event: Event): void {
    event.stopPropagation();
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

  getQuarantinedProductRows(crisis: CrisisResponseDTO): Array<{ productName: string; lotLabel: string }> {
    const names = Object.keys(crisis.quarantinedProducts || {});
    const details = crisis.quarantinedProductsInfo || {};

    return names.map((productName) => {
      const info = details[productName];

      if (!info) {
        return { productName, lotLabel: this.translate.instant('BATCHES.NO_BATCH') };
      }

      const lotCode = (info.batchCode || '').trim();
      const lotId = info.batchId;
      const lotLabel = lotCode
        ? lotCode
        : (lotId ? `${this.translate.instant('BATCHES.BATCH')} #${lotId}` : this.translate.instant('BATCHES.NO_BATCH'));

      return { productName, lotLabel };
    });
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
