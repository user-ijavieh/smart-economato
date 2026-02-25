import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllergenService } from '../../../core/services/allergen.service';
import { MessageService } from '../../../core/services/message.service';
import { Allergen, AllergenRequest } from '../../../shared/models/allergen.model';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-allergens-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ConfirmDialogComponent,
        ToastComponent
    ],
    templateUrl: './allergens-management.component.html',
    styleUrl: './allergens-management.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllergensManagementComponent implements OnInit {
    private allergenService = inject(AllergenService);
    private cdr = inject(ChangeDetectorRef);
    messageService = inject(MessageService);

    // ── Allergens state ──
    allergens: Allergen[] = [];
    filteredAllergens: Allergen[] = [];
    loading = true;
    searchTerm = '';

    // Pagination
    currentPage = 0;
    pageSize = 50;
    totalPages = 0;
    totalElements = 0;

    // ── Modal state ──
    showModal = false;
    modalMode: 'create' | 'edit' = 'create';
    selectedAllergen: Allergen | null = null;
    modalName = '';
    modalSaving = false;

    // ── Stats ──
    get totalAllergens(): number { return this.totalElements; }

    ngOnInit(): void {
        this.loadAllergens();
    }

    // ── Load ──
    loadAllergens(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.cdr.markForCheck();

        this.allergenService.getAll(this.currentPage, this.pageSize).pipe(
            finalize(() => {
                this.loading = false;
                this.cdr.markForCheck();
            })
        ).subscribe({
            next: (pageData) => {
                this.allergens = pageData.content;
                this.applyFilter();
                this.totalElements = pageData.totalElements;
                this.totalPages = pageData.totalPages;
                this.cdr.markForCheck();
            },
            error: () => {
                this.messageService.showError('Error al cargar los alérgenos');
            }
        });
    }

    applyFilter(): void {
        const term = this.searchTerm.trim().toLowerCase();
        const base = term
            ? this.allergens.filter(a => a.name.toLowerCase().includes(term))
            : [...this.allergens];
        this.filteredAllergens = base.sort((a, b) => a.id - b.id);
        this.cdr.markForCheck();
    }

    onSearch(): void { this.applyFilter(); }

    clearFilters(): void {
        this.searchTerm = '';
        this.applyFilter();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.loadAllergens(newPage);
        }
    }

    // ── Create ──
    openCreateModal(): void {
        this.modalMode = 'create';
        this.selectedAllergen = null;
        this.modalName = '';
        this.showModal = true;
        this.cdr.markForCheck();
    }

    // ── Edit ──
    openEditModal(allergen: Allergen): void {
        this.modalMode = 'edit';
        this.selectedAllergen = allergen;
        this.modalName = allergen.name;
        this.showModal = true;
        this.cdr.markForCheck();
    }

    closeModal(): void {
        this.showModal = false;
        this.selectedAllergen = null;
        this.modalName = '';
        this.modalSaving = false;
        this.cdr.markForCheck();
    }

    onModalOverlayClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('allergen-modal-overlay')) {
            this.closeModal();
        }
    }

    saveModal(): void {
        const name = this.modalName.trim();
        if (!name) {
            this.messageService.showError('El nombre del alérgeno no puede estar vacío');
            return;
        }

        this.modalSaving = true;
        this.cdr.markForCheck();

        const request: AllergenRequest = { name };

        if (this.modalMode === 'create') {
            this.allergenService.create(request).subscribe({
                next: (allergen) => {
                    this.messageService.showSuccess(`Alérgeno "${allergen.name}" creado con éxito`);
                    this.closeModal();
                    this.loadAllergens();
                },
                error: (err) => {
                    const msg = err.error?.message || err.error || 'Error al crear el alérgeno';
                    this.messageService.showError(msg);
                    this.modalSaving = false;
                    this.cdr.markForCheck();
                }
            });
        } else {
            if (!this.selectedAllergen) return;
            this.allergenService.update(this.selectedAllergen.id, request).subscribe({
                next: (allergen) => {
                    this.messageService.showSuccess(`Alérgeno "${allergen.name}" actualizado con éxito`);
                    this.closeModal();
                    this.loadAllergens();
                },
                error: (err) => {
                    const msg = err.error?.message || err.error || 'Error al actualizar el alérgeno';
                    this.messageService.showError(msg);
                    this.modalSaving = false;
                    this.cdr.markForCheck();
                }
            });
        }
    }

    // ── Delete ──
    async deleteAllergen(allergen: Allergen): Promise<void> {
        const confirmed = await this.messageService.confirm(
            '¿Eliminar alérgeno?',
            `¿Estás seguro de que quieres eliminar "${allergen.name}"? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        this.allergenService.delete(allergen.id).subscribe({
            next: () => {
                this.messageService.showSuccess(`Alérgeno "${allergen.name}" eliminado correctamente`);
                this.loadAllergens();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al eliminar el alérgeno';
                this.messageService.showError(msg);
            }
        });
    }
}
