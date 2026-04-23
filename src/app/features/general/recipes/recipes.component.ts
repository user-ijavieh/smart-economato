import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../../core/services/recipe.service';
import { RecipeDraftService } from '../../../core/services/recipe-draft.service';
import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { Recipe, RecipeRequest } from '../../../shared/models/recipe.model';
import { RecipeDraft, RecipeDraftRequest } from '../../../shared/models/recipe-draft.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { RecipeDetailModalComponent } from './recipe-detail-modal/recipe-detail-modal.component';
import { RecipeEditModalComponent } from './recipe-edit-modal/recipe-edit-modal.component';
import { RecipeCreateModalComponent } from './recipe-create-modal/recipe-create-modal.component';
import { RecipeOrderWizardModalComponent } from './recipe-order-wizard-modal/recipe-order-wizard-modal.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { finalize, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, RecipeDetailModalComponent, RecipeEditModalComponent, RecipeCreateModalComponent, RecipeOrderWizardModalComponent],
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipesComponent implements OnInit, OnDestroy {
  private recipeService = inject(RecipeService);
  private recipeDraftService = inject(RecipeDraftService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);
  private destroy$ = new Subject<void>();

  recipes: Recipe[] = [];
  // filteredRecipes no longer needed as we filter on backend or just show current page
  loading = false;
  initialLoad = true;
  searchTerm = '';
  private searchSubject = new Subject<string>();

  selectedRecipe: Recipe | null = null;
  showModal = false;
  showFilters = false;
  showEditModal = false;
  showCreateModal = false;
  showOrderWizard = false;
  showDraftDetailModal = false;
  activeTab: 'recipes' | 'drafts' = 'recipes';
  createModalTitle = 'Crear Nueva Receta';
  createActionLabel = 'Crear Receta';
  createMode: 'recipe-create' | 'draft-create' | 'draft-edit' = 'recipe-create';
  selectedDraftForEdit: RecipeDraft | null = null;
  selectedDraftForDetail: RecipeDraft | null = null;

  drafts: RecipeDraft[] = [];
  loadingDrafts = false;
  showLoadWarningModal = false;
  private loadWarningTimer: ReturnType<typeof setTimeout> | null = null;
  currentDraftPage = 0;
  draftPageSize = 12;
  totalDraftElements = 0;
  totalDraftPages = 0;

  // Filtros
  filterAllergens: 'all' | 'with' | 'without' = 'all';

  // Paginación
  // Paginación
  currentPage = 0; // 0-indexed for backend
  pageSize = 12;
  totalElements = 0;
  totalPages = 0;

  ngOnInit(): void {
    this.initialiseSearchSubscription();
    this.loadRecipes();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('recipe')) {
          if (this.searchTerm && this.searchTerm.trim() !== '') {
            this.performSearch(this.searchTerm);
          } else {
            this.loadRecipes();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchTab(tab: 'recipes' | 'drafts'): void {
    this.activeTab = tab;
    if (tab === 'drafts') {
      this.loadMyDrafts(0, false);
    } else {
      this.loadRecipes();
    }
    this.cdr.markForCheck();
  }

  initialiseSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  private getSortString(): string {
    if (this.filterAllergens === 'with') {
      return 'allergens,asc';
    } else if (this.filterAllergens === 'without') {
      return 'allergens,desc';
    }
    return 'name,asc';
  }

  loadRecipes(): void {
    this.loading = true;
    this.startLoadWarningTimer();
    this.cdr.markForCheck();

    const sort = this.getSortString();

    this.recipeService.getAll(this.currentPage, this.pageSize, sort).pipe(
      finalize(() => {
        this.loading = false;
        this.stopLoadWarningTimer();
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page) => {
        this.recipes = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.initialLoad = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar recetas');
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  performSearch(term: string): void {
    if (!term.trim()) {
      this.loadRecipes();
      return;
    }

    this.loading = true;
    this.startLoadWarningTimer();
    this.cdr.markForCheck();

    const sort = this.getSortString();

    this.recipeService.searchByName(term, this.currentPage, this.pageSize, sort)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.stopLoadWarningTimer();
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (page) => {
          this.recipes = page.content;
          this.totalElements = page.totalElements;
          this.totalPages = page.totalPages;
          this.initialLoad = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.messageService.showError('Error al buscar recetas');
        }
      });
  }

  applyFilters(): void {
    // Client-side filters now only apply to the current page if absolutely necessary, 
    // but ideally we should move everything to backend.
    // For now, we will just reload recipes which resets to page 0
    this.currentPage = 0;
    if (this.searchTerm) {
      this.onSearch();
    } else {
      this.loadRecipes();
    }
  }

  clearFilters(): void {
    this.filterAllergens = 'all';
    this.searchTerm = '';
    this.currentPage = 0;
    this.loadRecipes();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterAllergens !== 'all') count++;
    return count;
  }

  showAll(): void {
    this.clearFilters();
  }

  openRecipe(recipe: Recipe): void {
    this.selectedRecipe = recipe;
    this.showModal = true;
    this.cdr.detectChanges(); // Fix modal rendering issues
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedRecipe = null;
  }

  hasAllergens(recipe: Recipe): boolean {
    return recipe.allergens && recipe.allergens.length > 0;
  }

  canEdit(): boolean {
    const role = this.authService.getRole();
    return role === 'ADMIN' || role === 'CHEF' || role === 'ELEVATED';
  }

  // Paginación
  get paginatedRecipes(): Recipe[] {
    return this.recipes;
  }



  onPageChange(newPage: number): void {
    if (newPage >= 0 && newPage < this.totalPages) {
      this.currentPage = newPage;
      this.scrollService.scrollToTop();
      this.cdr.detectChanges();
      // Delay loading to let the scroll start smoothly and button animation finish
      setTimeout(() => {
        if (this.searchTerm) {
          this.onSearch();
        } else {
          this.loadRecipes();
        }
      }, 200);
    }
  }

  onSizeChange(event: any): void {
    this.pageSize = Number(event.target.value);
    this.currentPage = 0; // Reset to first page
    this.loadRecipes();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  async printRecipe(): Promise<void> {
    if (!this.selectedRecipe) return;

    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.recipeService.getPdf(this.selectedRecipe.id).subscribe({
      next: (blob) => {
        // Crear URL del blob
        const url = window.URL.createObjectURL(blob);

        // Crear enlace temporal para descargar
        const link = document.createElement('a');
        link.href = url;
        link.download = `receta-${this.selectedRecipe!.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        document.body.appendChild(link);
        link.click();

        // Limpiar
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        this.messageService.showSuccess('PDF descargado correctamente');
      },
      error: () => {
        this.messageService.showError('Error al generar el PDF');
      }
    });
  }

  openEditModal(): void {
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
  }

  openCreateModal(): void {
    if (this.canEdit()) {
      this.createMode = 'recipe-create';
      this.selectedDraftForEdit = null;
      this.createModalTitle = 'Crear Nueva Receta';
      this.createActionLabel = 'Crear Receta';
    } else {
      this.createMode = 'draft-create';
      this.selectedDraftForEdit = null;
      this.createModalTitle = 'Crear Nuevo Borrador';
      this.createActionLabel = 'Guardar Borrador';
    }
    this.showCreateModal = true;
    this.cdr.markForCheck();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.selectedDraftForEdit = null;
    this.cdr.markForCheck();
  }

  private toDraftRequest(recipeRequest: RecipeRequest, existingDraft?: RecipeDraft | null): RecipeDraftRequest {
    return {
      name: recipeRequest.name,
      elaboration: recipeRequest.elaboration ?? '',
      presentation: recipeRequest.presentation ?? '',
      portions: existingDraft?.portions ?? 1,
      components: recipeRequest.components,
      allergenIds: recipeRequest.allergenIds ?? [],
      isHidden: existingDraft?.isHidden ?? recipeRequest.isHidden ?? false
    };
  }

  mapDraftToRecipeRequest(draft: RecipeDraft): RecipeRequest {
    return {
      name: draft.name,
      elaboration: draft.elaboration ?? '',
      presentation: draft.presentation ?? '',
      components: draft.components ?? [],
      allergenIds: draft.allergenIds ?? [],
      isHidden: draft.isHidden
    };
  }

  loadMyDrafts(page: number = 0, append = false): void {
    this.loadingDrafts = true;
    this.startLoadWarningTimer();
    this.currentDraftPage = page;
    this.cdr.markForCheck();

    this.recipeDraftService.getMine(this.currentDraftPage, this.draftPageSize)
      .pipe(finalize(() => {
        this.loadingDrafts = false;
        this.stopLoadWarningTimer();
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (draftPage) => {
          this.drafts = append ? [...this.drafts, ...draftPage.content] : draftPage.content;
          this.totalDraftElements = draftPage.totalElements;
          this.totalDraftPages = draftPage.totalPages;
          this.cdr.markForCheck();
        },
        error: () => {
          this.messageService.showError('Error al cargar tus borradores');
        }
      });
  }

  onDraftsScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.loadingDrafts || this.currentDraftPage >= this.totalDraftPages - 1) {
      return;
    }

    const threshold = 120;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom <= threshold) {
      this.loadMyDrafts(this.currentDraftPage + 1, true);
    }
  }

  getDraftStatusLabel(status: RecipeDraft['status']): string {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'APPROVED':
        return 'Aprobado';
      case 'REJECTED':
        return 'Rechazado';
      default:
        return status;
    }
  }

  getDraftStatusClass(status: RecipeDraft['status']): string {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'badge-default';
    }
  }

  canEditDraft(draft: RecipeDraft): boolean {
    return draft.status === 'PENDING' || draft.status === 'REJECTED';
  }

  openDraftDetailModal(draft: RecipeDraft): void {
    this.selectedDraftForDetail = draft;
    this.showDraftDetailModal = true;
    this.cdr.markForCheck();
  }

  closeDraftDetailModal(): void {
    this.showDraftDetailModal = false;
    this.selectedDraftForDetail = null;
    this.cdr.markForCheck();
  }

  openEditDraftModal(draft: RecipeDraft): void {
    if (!this.canEditDraft(draft)) {
      this.messageService.showError('Este borrador ya no se puede editar');
      return;
    }

    this.createMode = 'draft-edit';
    this.selectedDraftForEdit = draft;
    this.createModalTitle = `Editar Borrador: ${draft.name}`;
    this.createActionLabel = draft.status === 'REJECTED' ? 'Guardar y Reenviar' : 'Guardar Cambios';
    this.showCreateModal = true;
    this.closeDraftDetailModal();
    this.cdr.markForCheck();
  }

  openEditDraftFromDetail(): void {
    if (!this.selectedDraftForDetail) return;
    this.openEditDraftModal(this.selectedDraftForDetail);
  }

  async deleteDraft(draft: RecipeDraft): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Eliminar borrador',
      `¿Seguro que deseas eliminar el borrador "${draft.name}"?`
    );

    if (!confirmed) {
      return;
    }

    this.recipeDraftService.delete(draft.id).subscribe({
      next: () => {
        this.messageService.showSuccess(`Borrador "${draft.name}" eliminado`);
        this.closeDraftDetailModal();
        this.loadMyDrafts(this.currentDraftPage);
      },
      error: () => {
        this.messageService.showError('Error al eliminar el borrador');
      }
    });
  }

  resubmitDraft(draft: RecipeDraft): void {
    const request = this.toDraftRequest(this.mapDraftToRecipeRequest(draft), draft);
    this.recipeDraftService.update(draft.id, request).subscribe({
      next: () => {
        this.messageService.showSuccess(`Borrador "${draft.name}" reenviado`);
        this.closeDraftDetailModal();
        this.loadMyDrafts(this.currentDraftPage);
      },
      error: () => {
        this.messageService.showError('Error al reenviar el borrador');
      }
    });
  }

  onSaveRecipe(recipeRequest: RecipeRequest): void {
    if (!this.selectedRecipe) return;

    this.recipeService.update(this.selectedRecipe.id, recipeRequest).subscribe({
      next: (recipe) => {
        this.messageService.showSuccess(`Receta "${recipe.name}" actualizada con éxito`);
        this.closeEditModal();
        this.closeModal();
        this.loadRecipes();
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }

  onCreateRecipe(recipeRequest: RecipeRequest): void {
    if (this.createMode === 'recipe-create') {
      this.recipeService.create(recipeRequest).subscribe({
        next: (recipe) => {
          this.messageService.showSuccess(`Receta "${recipe.name}" creada con éxito`);
          this.closeCreateModal();
          this.loadRecipes();
        },
        error: (err) => {
          // Handled by interceptor
        }
      });
      return;
    }

    if (this.createMode === 'draft-edit' && this.selectedDraftForEdit) {
      const updateRequest = this.toDraftRequest(recipeRequest, this.selectedDraftForEdit);
      this.recipeDraftService.update(this.selectedDraftForEdit.id, updateRequest).subscribe({
        next: (draft) => {
          this.messageService.showSuccess(
            draft.status === 'PENDING'
              ? `Borrador "${draft.name}" guardado y enviado`
              : `Borrador "${draft.name}" actualizado`
          );
          this.closeCreateModal();
          this.loadMyDrafts(this.currentDraftPage);
        },
        error: () => {
          this.messageService.showError('Error al actualizar el borrador');
        }
      });
      return;
    }

    const draftRequest = this.toDraftRequest(recipeRequest);

    this.recipeDraftService.create(draftRequest).subscribe({
      next: (recipe) => {
        this.messageService.showSuccess(`Borrador "${recipe.name}" creado con éxito`);
        this.closeCreateModal();
        this.loadMyDrafts(0);
      },
      error: (err) => {
        this.messageService.showError('Error al crear el borrador');
      }
    });
  }

  async onCookRecipe(event: { quantity: number; details: string }): Promise<void> {
    if (!this.selectedRecipe) return;

    const confirmed = await this.messageService.confirm(
      'Confirmar cocinado',
      `¿Deseas cocinar ${event.quantity} unidad(es) de "${this.selectedRecipe.name}"?`
    );

    if (!confirmed) return;

    this.recipeService.cook({
      recipeId: this.selectedRecipe.id,
      quantity: event.quantity,
      details: event.details
    }).subscribe({
      next: (recipe) => {
        this.messageService.showSuccess(`¡"${recipe.name}" cocinada con éxito!`);
        this.closeModal();
        this.loadRecipes();
      },
      error: (err) => {
        // Handled by interceptor
      }
    });
  }

  private startLoadWarningTimer(): void {
    this.stopLoadWarningTimer();
    this.showLoadWarningModal = false;
    this.loadWarningTimer = setTimeout(() => {
      if (this.loading || this.loadingDrafts) {
        this.showLoadWarningModal = true;
        this.cdr.markForCheck();
      }
    }, 7000);
  }

  private stopLoadWarningTimer(): void {
    if (this.loadWarningTimer) {
      clearTimeout(this.loadWarningTimer);
      this.loadWarningTimer = null;
    }
  }

  closeLoadWarningModal(): void {
    this.showLoadWarningModal = false;
    this.cdr.markForCheck();
  }

  retryLoadAfterWarning(): void {
    this.showLoadWarningModal = false;
    if (this.activeTab === 'drafts' && !this.canEdit()) {
      this.loadMyDrafts(0, false);
      return;
    }
    if (this.searchTerm.trim()) {
      this.performSearch(this.searchTerm);
      return;
    }
    this.loadRecipes();
  }

  openOrderWizard(): void {
    this.showOrderWizard = true;
    this.cdr.detectChanges();
  }

  closeOrderWizard(): void {
    this.showOrderWizard = false;
    this.cdr.detectChanges();
  }
}
