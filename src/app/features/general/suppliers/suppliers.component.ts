import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../../core/services/supplier.service';
import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { Supplier, SupplierRequest } from '../../../shared/models/supplier.model';
import { SupplierCreateModalComponent } from './supplier-create-modal/supplier-create-modal.component';
import { SupplierEditModalComponent } from './supplier-edit-modal/supplier-edit-modal.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, SupplierCreateModalComponent, SupplierEditModalComponent, ToastComponent, ConfirmDialogComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css'
})
export class SuppliersComponent implements OnInit, OnDestroy {
  private supplierService = inject(SupplierService);
  messageService = inject(MessageService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Listas de datos
  suppliers: Supplier[] = [];

  // Estado de la vista
  loading = false;
  initialLoad = true;
  searchTerm = '';
  private searchSubject = new Subject<string>();

  showCreateModal = false;
  showEditModal = false;
  selectedSupplier: Supplier | null = null;

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
    this.initialiseSearchSubscription();
    this.loadSuppliers();
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  initialiseSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  loadSuppliers(): void {
    this.loading = true;

    this.supplierService.getAll(this.page, this.size).subscribe({
      next: (page) => {
        this.suppliers = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading suppliers:', err);
        this.messageService.showError('Error al cargar proveedores');
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
    this.loadSuppliers();
  }

  onSizeChange(event: any): void {
    this.size = Number(event.target.value);
    this.page = 0;
    this.loadSuppliers();
  }

  onSortChange(column: string): void {
    this.sortInteracted = true;
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.loadSuppliers();
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  performSearch(term: string): void {
    if (!term || term.trim() === '') {
      this.loadSuppliers();
      return;
    }

    this.loading = true;

    this.supplierService.getAll(this.page, this.size).subscribe({
      next: (page) => {
        // Filtrar localmente ya que el servicio no soporta búsqueda paginada
        const lowerTerm = term.trim().toLowerCase();
        this.suppliers = page.content.filter(s =>
          s.name.toLowerCase().includes(lowerTerm)
        );
        this.totalElements = this.suppliers.length;
        this.totalPages = 1;
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error searching suppliers:', err);
        this.messageService.showError('Error al buscar proveedores');
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
    this.searchTerm = '';
    this.page = 0;
    this.loadSuppliers();
  }

  hasActiveFilters(): boolean {
    return this.sortColumn !== 'id' || this.sortDir !== 'asc' || this.searchTerm.trim() !== '';
  }

  // --- LÓGICA DE MODALES ---

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  onCloseCreateModal(): void {
    this.showCreateModal = false;
  }

  editSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showEditModal = true;
  }

  onCloseEditModal(): void {
    this.showEditModal = false;
    this.selectedSupplier = null;
  }

  onSaveSupplier(supplierData: SupplierRequest): void {
    this.supplierService.create(supplierData).subscribe({
      next: () => {
        this.messageService.showSuccess('Proveedor creado correctamente');
        this.showCreateModal = false;
        this.loadSuppliers();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Error al crear proveedor';
        this.messageService.showError(errorMessage);
      }
    });
  }

  onSaveEditedSupplier(supplierData: SupplierRequest): void {
    if (!this.selectedSupplier) return;

    this.supplierService.update(this.selectedSupplier.id, supplierData).subscribe({
      next: () => {
        this.messageService.showSuccess('Proveedor actualizado correctamente');
        this.showEditModal = false;
        this.selectedSupplier = null;
        this.loadSuppliers();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Error al actualizar proveedor';
        this.messageService.showError(errorMessage);
      }
    });
  }

  onDeleteSupplierFromModal(): void {
    if (!this.selectedSupplier) return;

    this.supplierService.delete(this.selectedSupplier.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Proveedor eliminado correctamente');
        this.showEditModal = false;
        this.selectedSupplier = null;
        this.loadSuppliers();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Error al eliminar proveedor';
        this.messageService.showError(errorMessage);
      }
    });
  }

  // --- UTILIDADES ---

  getSortDir(column: string): string {
    if (!this.sortInteracted) return 'none';
    return this.sortColumn === column ? this.sortDir : 'none';
  }

  get isAdmin(): boolean {
    return this.authService.getRole() === 'ADMIN';
  }
}
