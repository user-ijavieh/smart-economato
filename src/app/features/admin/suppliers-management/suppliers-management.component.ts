import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../../core/services/supplier.service';
import { MessageService } from '../../../core/services/message.service';
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
    pageSize = 20;
    totalPages = 0;
    totalElements = 0;

    // Modal state
    showFormModal = false;
    selectedSupplier: Supplier | null = null;

    ngOnInit(): void {
        this.loadSuppliers();
    }

    loadSuppliers(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;

        this.supplierService.getAll(this.currentPage, this.pageSize).subscribe({
            next: (pageData) => {
                this.suppliers = pageData.content;
                this.totalElements = pageData.totalElements;
                this.totalPages = pageData.totalPages;
                this.applySearchFilter(true);
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading suppliers:', err);
                this.messageService.showError('Error al cargar los proveedores');
                this.loading = false;
            }
        });
    }

    applySearchFilter(isPrePaginated: boolean = false): void {
        let result = this.suppliers;

        if (this.searchTerm.trim()) {
            const term = this.searchTerm.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.email && s.email.toLowerCase().includes(term)) ||
                (s.phone && s.phone.toLowerCase().includes(term))
            );
        }

        this.filteredSuppliers = result;

        if (this.searchTerm.trim()) {
            this.totalElements = result.length;
            this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        }
    }

    onSearch(): void {
        this.currentPage = 0;
        this.applySearchFilter(true);
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.currentPage = 0;
        this.loadSuppliers();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
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
