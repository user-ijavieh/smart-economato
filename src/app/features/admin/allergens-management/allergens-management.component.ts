import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllergenService } from '../../../core/services/allergen.service';
import { MessageService } from '../../../core/services/message.service';
import { Allergen, AllergenRequest } from '../../../shared/models/allergen.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { SuppliersManagementComponent } from '../suppliers-management/suppliers-management.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { finalize, Observable, of, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Page } from '../../../shared/models/page.model';
import { catchError, map } from 'rxjs/operators';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

@Component({
    selector: 'app-allergens-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        BaseModalComponent,
        SuppliersManagementComponent
    ],
    templateUrl: './allergens-management.component.html',
    styleUrl: './allergens-management.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllergensManagementComponent implements OnInit, OnDestroy {
    private allergenService = inject(AllergenService);
    private cdr = inject(ChangeDetectorRef);
    private scrollService = inject(ScrollService);
    messageService = inject(MessageService);

    // ── Allergens state ──
    allergens: Allergen[] = [];
    filteredAllergens: Allergen[] = [];
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

    // Sorting state
    sortColumn = 'name';
    sortDir: 'asc' | 'desc' = 'asc';
    sortInteracted = false;

    activeTab: 'allergens' | 'suppliers' = 'allergens';

    switchTab(tab: 'allergens' | 'suppliers'): void {
        this.activeTab = tab;
        this.cdr.markForCheck();
    }

    // ── Modal state ──
    showModal = false;
    modalMode: 'create' | 'edit' = 'create';
    selectedAllergen: Allergen | null = null;
    modalName = '';
    modalSaving = false;

    // ── Stats ──
    get totalAllergens(): number { return this.totalElements; }

    ngOnInit(): void {
        this.searchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe(() => {
            this.currentPage = 0;
            this.loadAllergens(0);
        });

        this.loadAllergens();
    }

    ngOnDestroy(): void {
        this.searchSubject.complete();
    }

    // ── Load ──
    loadAllergens(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.serverCurrentPage = page;
        
        // Removed array clear to prevent layout shift during pagination/sorting
        this.cdr.detectChanges();

        const term = this.searchTerm.trim();

        if (term) {
            // Use exact search endpoint
            this.allergenService.searchByName(term).pipe(
                map(allergens => {
                    return {
                        content: allergens || [],
                        totalElements: (allergens || []).length,
                        totalPages: (allergens || []).length > 0 ? 1 : 0,
                        size: (allergens || []).length || 50,
                        number: 0,
                        first: true,
                        last: true,
                        empty: (allergens || []).length === 0
                    };
                }),
                catchError(() => of({
                    content: [],
                    totalElements: 0,
                    totalPages: 0,
                    size: 50,
                    number: 0,
                    first: true,
                    last: true,
                    empty: true
                })),
                finalize(() => {
                    this.loading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((pageData: any) => {
                this.allergens = (pageData.content ?? []).filter((a: Allergen | null | undefined): a is Allergen =>
                    !!a && typeof a.name === 'string'
                );
                this.serverTotalElements = pageData.totalElements;
                this.serverTotalPages = pageData.totalPages;
                this.applyFilter();
            });
        } else {
            const sortParam = `${this.sortColumn},${this.sortDir}`;
            this.allergenService.getAll(this.currentPage, this.pageSize, sortParam).pipe(
                finalize(() => {
                    this.loading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe({
                next: (pageData: Page<Allergen>) => {
                    this.allergens = (pageData.content ?? []).filter((a: Allergen | null | undefined): a is Allergen =>
                        !!a && typeof a.name === 'string'
                    );
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
                    this.applyFilter();
                },
                error: (err: any) => {
                    console.error('Error loading allergens:', err);
                    this.messageService.showError('Error al cargar los alérgenos');
                }
            });
        }
    }

    onSortChange(column: string): void {
        this.sortInteracted = true;
        if (this.sortColumn === column) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDir = 'asc';
        }
        this.loadAllergens(0);
    }

    getSortDir(column: string): string {
        if (!this.sortInteracted && this.sortColumn !== column) return 'none';
        return this.sortColumn === column ? this.sortDir : 'none';
    }

    applyFilter(): void {
        const term = this.searchTerm.trim().toLowerCase();
        const safeAllergens = this.allergens.filter((a): a is Allergen => !!a && typeof a.name === 'string');
        let result = term
            ? safeAllergens.filter(a => a.name.toLowerCase().includes(term))
            : [...safeAllergens];
            
        // Sorting fallback (essential for filtering results or backend delay)
        const factor = this.sortDir === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            const valA = ((a as any)?.[this.sortColumn] ?? '');
            const valB = ((b as any)?.[this.sortColumn] ?? '');
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB) * factor;
            }
            return ((Number(valA) || 0) - (Number(valB) || 0)) * factor;
        });
        
        this.filteredAllergens = result;
        
        if (term) {
            this.totalPages = 1;
            this.currentPage = 0;
            this.totalElements = this.filteredAllergens.length;
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
        this.applyFilter();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.scrollService.scrollToTop();
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
