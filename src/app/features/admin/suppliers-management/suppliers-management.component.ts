import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../../core/services/supplier.service';
import { MessageService } from '../../../core/services/message.service';
import { Observable } from 'rxjs';
import { Page } from '../../../shared/models/page.model';
import { Supplier, SupplierRequest } from '../../../shared/models/supplier.model';
import { SupplierFormModalComponent } from './supplier-form-modal/supplier-form-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';

@Component({
    selector: 'app-suppliers-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SupplierFormModalComponent,
        ConfirmDialogComponent,
        ToastComponent
    ],
    templateUrl: './suppliers-management.component.html',
    styleUrl: './suppliers-management.component.css'
})
export class SuppliersManagementComponent implements OnInit {
    private supplierService = inject(SupplierService);
    private cdr = inject(ChangeDetectorRef);
    messageService = inject(MessageService);

    suppliers: Supplier[] = [];
    filteredSuppliers: Supplier[] = [];
    loading = true;
    searchTerm = '';

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
        this.loadSuppliers();
    }

    loadSuppliers(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.serverCurrentPage = page;
        
        // Clear lists to force skeleton loader
        this.suppliers = [];
        this.filteredSuppliers = [];
        this.cdr.detectChanges();

        const sortParam = `${this.sortColumn},${this.sortDir}`;
        const term = this.searchTerm.trim();

        const source$: Observable<Supplier[] | Page<Supplier>> = term 
            ? this.supplierService.searchByTerm(term)
            : this.supplierService.getAll(this.currentPage, this.pageSize, sortParam);

        (source$ as Observable<any>).subscribe({
            next: (response: any) => {
                if (term) {
                    // Search endpoint returns Supplier[] array
                    const result = Array.isArray(response) ? response : (response as any).content || [];
                    this.suppliers = result;
                    this.serverTotalElements = result.length;
                    this.serverTotalPages = 1;
                } else {
                    // Page<Supplier>
                    const pageData = response as any;
                    this.suppliers = pageData.content;
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
                }
                this.applyFilter();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading suppliers:', err);
                this.messageService.showError('Error al cargar los proveedores');
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    applyFilter(): void {
        let result = [...this.suppliers];
        
        // Sorting fallback
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
        this.currentPage = 0;
        this.loadSuppliers(0);
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
            this.scrollToTop();
            this.loadSuppliers(newPage);
        }
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const container = document.querySelector('.contenedor-principal');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
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
                    this.messageService.showSuccess('Proveedor actualizado correctamente');
                    this.closeFormModal();
                    this.loadSuppliers(this.currentPage);
                },
                error: (err) => {
                    console.error('Error updating supplier:', err);
                    this.messageService.showError('Error al actualizar el proveedor');
                }
            });
        } else {
            // Create mode
            this.supplierService.create(request).subscribe({
                next: () => {
                    this.messageService.showSuccess('Proveedor creado correctamente');
                    this.closeFormModal();
                    this.loadSuppliers();
                },
                error: (err) => {
                    console.error('Error creating supplier:', err);
                    this.messageService.showError('Error al crear el proveedor');
                }
            });
        }
    }

    async deleteSupplier(supplier: Supplier): Promise<void> {
        const confirmed = await this.messageService.confirm(
            '¿Eliminar proveedor?',
            `¿Estás seguro de que quieres eliminar a "${supplier.name}"? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        this.supplierService.delete(supplier.id).subscribe({
            next: () => {
                this.messageService.showSuccess('Proveedor eliminado correctamente');
                this.loadSuppliers(this.currentPage);
            },
            error: (err) => {
                console.error('Error deleting supplier:', err);
                const errorMessage = err.error?.message || 'Error al eliminar el proveedor. Puede tener productos asociados.';
                this.messageService.showError(errorMessage);
            }
        });
    }
}
