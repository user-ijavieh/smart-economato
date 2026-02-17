import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../../core/services/recipe.service';
import { MessageService } from '../../../core/services/message.service';
import { Recipe, RecipeRequest } from '../../../shared/models/recipe.model';
import { RecipeCreateModalComponent } from '../../general/recipes/recipe-create-modal/recipe-create-modal.component';
import { RecipeEditModalComponent } from '../../general/recipes/recipe-edit-modal/recipe-edit-modal.component';
import { RecipeDetailModalComponent } from '../../general/recipes/recipe-detail-modal/recipe-detail-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-recipes-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RecipeCreateModalComponent,
        RecipeEditModalComponent,
        RecipeDetailModalComponent,
        ConfirmDialogComponent,
        ToastComponent
    ],
    templateUrl: './recipes-management.component.html',
    styleUrl: './recipes-management.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipesManagementComponent implements OnInit {
    private recipeService = inject(RecipeService);
    private cdr = inject(ChangeDetectorRef);
    messageService = inject(MessageService);

    recipes: Recipe[] = [];
    filteredRecipes: Recipe[] = [];
    loading = true;
    searchTerm = '';

    // Modal state
    showCreateModal = false;
    showEditModal = false;
    showDetailModal = false;
    selectedRecipe: Recipe | null = null;

    // Stats
    get totalRecipes(): number { return this.filteredRecipes.length; }
    get recipesWithAllergens(): number { return this.filteredRecipes.filter(r => r.allergens?.length > 0).length; }
    get recipesWithoutAllergens(): number { return this.filteredRecipes.filter(r => !r.allergens || r.allergens.length === 0).length; }
    get averageCost(): number {
        if (this.filteredRecipes.length === 0) return 0;
        const total = this.filteredRecipes.reduce((sum, r) => sum + r.totalCost, 0);
        return total / this.filteredRecipes.length;
    }

    ngOnInit(): void {
        this.loadRecipes();
    }

    loadRecipes(): void {
        this.loading = true;
        this.cdr.markForCheck();

        this.recipeService.getAll(0, 1000, 'name,asc').pipe(
            finalize(() => {
                this.loading = false;
                this.cdr.markForCheck();
            })
        ).subscribe({
            next: (page) => {
                this.recipes = page.content;
                this.applySearchFilter();
                this.cdr.markForCheck();
            },
            error: () => {
                this.messageService.showError('Error al cargar las recetas');
            }
        });
    }

    applySearchFilter(): void {
        if (!this.searchTerm.trim()) {
            this.filteredRecipes = [...this.recipes];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredRecipes = this.recipes.filter(r =>
                r.name.toLowerCase().includes(term)
            );
        }
        this.cdr.markForCheck();
    }

    onSearch(): void {
        this.applySearchFilter();
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.applySearchFilter();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    // ── Detail ──

    openDetailModal(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showDetailModal = true;
        this.cdr.markForCheck();
    }

    closeDetailModal(): void {
        this.showDetailModal = false;
        this.selectedRecipe = null;
        this.cdr.markForCheck();
    }

    // ── Create ──

    openCreateModal(): void {
        this.showCreateModal = true;
        this.cdr.markForCheck();
    }

    closeCreateModal(): void {
        this.showCreateModal = false;
        this.cdr.markForCheck();
    }

    onCreateRecipe(recipeRequest: RecipeRequest): void {
        this.recipeService.create(recipeRequest).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`Receta "${recipe.name}" creada con éxito`);
                this.closeCreateModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al crear la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Edit ──

    openEditModal(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showEditModal = true;
        this.cdr.markForCheck();
    }

    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedRecipe = null;
        this.cdr.markForCheck();
    }

    onSaveRecipe(recipeRequest: RecipeRequest): void {
        if (!this.selectedRecipe) return;

        this.recipeService.update(this.selectedRecipe.id, recipeRequest).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`Receta "${recipe.name}" actualizada con éxito`);
                this.closeEditModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al actualizar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Delete ──

    async deleteRecipe(recipe: Recipe): Promise<void> {
        const confirmed = await this.messageService.confirm(
            '¿Eliminar receta?',
            `¿Estás seguro de que quieres eliminar "${recipe.name}"? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        this.recipeService.delete(recipe.id).subscribe({
            next: () => {
                this.messageService.showSuccess(`Receta "${recipe.name}" eliminada correctamente`);
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al eliminar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Cook ──

    onCookRecipe(event: { quantity: number; details: string }): void {
        if (!this.selectedRecipe) return;

        this.recipeService.cook({
            recipeId: this.selectedRecipe.id,
            quantity: event.quantity,
            details: event.details
        }).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`¡"${recipe.name}" cocinada con éxito!`);
                this.closeDetailModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al cocinar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── PDF ──

    downloadPdf(recipe: Recipe): void {
        this.recipeService.getPdf(recipe.id).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `receta-${recipe.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                this.messageService.showSuccess('PDF descargado correctamente');
            },
            error: () => {
                this.messageService.showError('Error al generar el PDF');
            }
        });
    }

    // ── Helpers ──

    hasAllergens(recipe: Recipe): boolean {
        return recipe.allergens && recipe.allergens.length > 0;
    }
}
