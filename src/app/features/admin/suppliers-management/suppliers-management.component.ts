import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { SupplierService } from '../../../core/services/supplier.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MessageService } from '../../../core/services/message.service';
import { Observable, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { Page } from '../../../shared/models/page.model';
import { Supplier, SupplierRequest } from '../../../shared/models/supplier.model';
import { SupplierFormModalComponent } from './supplier-form-modal/supplier-form-modal.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

@Component({
    selector: 'app-suppliers-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SupplierFormModalComponent,
        BaseModalComponent,
        TranslateModule
    ],
    templateUrl: './suppliers-management.component.html',
    styleUrl: './suppliers-management.component.css'
})
export class SuppliersManagementComponent implements OnInit, OnDestroy {
    private readonly logger = inject(LoggerService);
    private supplierService = inject(SupplierService);
    private cdr = inject(ChangeDetectorRef);
    private scrollService = inject(ScrollService);
    private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
    private translate = inject(TranslateService);
    messageService = inject(MessageService);
    private destroy$ = new Subject<void>();

    suppliers: Supplier[] = [];
    filteredSuppliers: Supplier[] = [];
    loading = true;
    searchTerm = '';
    private searchSubject = new Subject<string>();

    // Pagination
    currentPage = 0;
    pageSize = 50;
    totalPages = 0;
    totalElements = 0;

    serverCurrentPage = 0;
    serverTotalPages = 0;
    serverTotalElements = 0;

    // Modal state
    showFormModal = false;
    selectedSupplier: Supplier | null = null;

    // Mobile detail modal state
    showMobileModal = false;
    selectedSupplierForMobile: Supplier | null = null;

    // Sorting state
    sortColumn = 'name';
    sortDir: 'asc' | 'desc' = 'asc';
    sortInteracted = false;

    ngOnInit(): void {
        this.searchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe(() => {
            this.currentPage = 0;
            this.loadSuppliers(0);
        });

        this.loadSuppliers();

        this.syncCacheInvalidationService.invalidatedDomains$
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ domains }) => {
                if (domains.includes('supplier')) {
                    this.loadSuppliers(this.currentPage);
                }
            });
    }

    ngOnDestroy(): void {
        this.searchSubject.complete();
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadSuppliers(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.serverCurrentPage = page;
        
        this.cdr.detectChanges();

        const sortParam = `${this.sortColumn},${this.sortDir}`;
        const term = this.searchTerm.trim();

        const source$: Observable<Page<Supplier>> = term
            ? this.supplierService.search(term, this.currentPage, this.pageSize, sortParam)
            : this.supplierService.getAll(this.currentPage, this.pageSize, sortParam);

        source$.subscribe({
            next: (pageData) => {
                this.suppliers = pageData.content;
                this.serverTotalElements = pageData.totalElements;
                this.serverTotalPages = pageData.totalPages;
                this.applyFilter();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                this.logger.error('Error loading suppliers:', err);
                this.messageService.showError(this.translate.instant('SUPPLIERS.LOAD_ERROR') || 'Error al cargar los proveedores');
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    applyFilter(): void {
        let result = [...this.suppliers];
        
        const factor = this.sortDir === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            const valA = (a as any)[this.sortColumn];
            const valB = (b as any)[this.sortColumn];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB) * factor;
            }
            return ((valA || 0) - (valB || 0)) * factor;
        });

        this.filteredSuppliers = result;
        
        if (this.searchTerm.trim()) {
            this.totalPages = 1;
            this.currentPage = 0;
            this.totalElements = this.filteredSuppliers.length;
        } else {
            this.totalPages = this.serverTotalPages;
            this.currentPage = this.serverCurrentPage;
            this.totalElements = this.serverTotalElements;
        }

        this.cdr.markForCheck();
    }

    onSearch(): void {
        this.searchSubject.next(this.searchTerm);
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.currentPage = 0;
        this.loadSuppliers();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    onSortChange(column: string): void {
        this.sortInteracted = true;
        if (this.sortColumn === column) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDir = 'asc';
        }
        this.loadSuppliers(0);
    }

    getSortDir(column: string): string {
        if (!this.sortInteracted && this.sortColumn !== column) return 'none';
        return this.sortColumn === column ? this.sortDir : 'none';
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.scrollService.scrollToTop();
            this.loadSuppliers(newPage);
        }
    }

    // ── Modal operations ──

    openCreateModal(): void {
        this.selectedSupplier = null;
        this.showFormModal = true;
    }

    openEditModal(supplier: Supplier): void {
        this.selectedSupplier = { ...supplier };
        this.showFormModal = true;
    }

    closeFormModal(): void {
        this.showFormModal = false;
        this.selectedSupplier = null;
    }

    openMobileModal(supplier: Supplier): void {
        this.selectedSupplierForMobile = supplier;
        this.showMobileModal = true;
    }

    closeMobileModal(): void {
        this.showMobileModal = false;
        this.selectedSupplierForMobile = null;
    }

    openEditFromMobile(): void {
        if (!this.selectedSupplierForMobile) {
            return;
        }

        this.openEditModal(this.selectedSupplierForMobile);
    }

    onSaveSupplier(data: any): void {
        const request: SupplierRequest = {
            name: data.name,
            email: data.email || undefined,
            phone: data.phone || undefined
        };

        if (this.selectedSupplier) {
            // Edit mode
            this.supplierService.update(this.selectedSupplier.id, request).subscribe({
                next: () => {
                    this.messageService.showSuccess(this.translate.instant('SUPPLIER_FORM.UPDATE_SUCCESS'));
                    this.closeFormModal();
                    this.loadSuppliers(this.currentPage);
                },
                error: (err) => {
                    this.logger.error('Error updating supplier:', err);
                    this.messageService.showError(this.translate.instant('SUPPLIER_FORM.UPDATE_ERROR') || 'Error al actualizar el proveedor');
                }
            });
        } else {
            // Create mode
            this.supplierService.create(request).subscribe({
                next: () => {
                    this.messageService.showSuccess(this.translate.instant('SUPPLIER_FORM.CREATE_SUCCESS'));
                    this.closeFormModal();
                    this.loadSuppliers();
                },
                error: (err) => {
                    this.logger.error('Error creating supplier:', err);
                    this.messageService.showError(this.translate.instant('SUPPLIER_FORM.CREATE_ERROR') || 'Error al crear el proveedor');
                }
            });
        }
    }

    async deleteSupplier(supplier: Supplier): Promise<void> {
        const confirmed = await this.messageService.confirm(
            this.translate.instant('SUPPLIERS.ACTIONS.DELETE_CONFIRM_TITLE'),
            this.translate.instant('SUPPLIERS.ACTIONS.DELETE_CONFIRM_MSG', { name: supplier.name })
        );

        if (!confirmed) return;

        this.supplierService.delete(supplier.id).subscribe({
            next: () => {
                this.messageService.showSuccess(this.translate.instant('SUPPLIER_FORM.DELETE_SUCCESS'));
                this.loadSuppliers(this.currentPage);
            },
            error: (err) => {
                this.logger.error('Error deleting supplier:', err);
                const errorMessage = err.error?.message || this.translate.instant('SUPPLIER_FORM.DELETE_ERROR_ASSOCIATED') || 'Error al eliminar el proveedor. Puede tener productos asociados.';
                this.messageService.showError(errorMessage);
            }
        });
    }
}
