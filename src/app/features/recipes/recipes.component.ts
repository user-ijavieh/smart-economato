import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../core/services/recipe.service';
import { MessageService } from '../../core/services/message.service';
import { AuthService } from '../../core/services/auth.service';
import { Recipe, RecipeRequest } from '../../shared/models/recipe.model';
import { RecipeDetailModalComponent } from './recipe-detail-modal/recipe-detail-modal.component';
import { RecipeEditModalComponent } from './recipe-edit-modal/recipe-edit-modal.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipeDetailModalComponent, RecipeEditModalComponent],
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipesComponent implements OnInit {
  private recipeService = inject(RecipeService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  recipes: Recipe[] = [];
  filteredRecipes: Recipe[] = [];
  loading = false;
  searchTerm = '';

  selectedRecipe: Recipe | null = null;
  showModal = false;
  showFilters = false;
  showEditModal = false;

  // Filtros
  filterAllergens: 'all' | 'with' | 'without' = 'all';
  filterMaxPrice: number | null = null;
  filterMinIngredients: number | null = null;
  filterMaxIngredients: number | null = null;

  // Paginación
  currentPage = 1;
  pageSize = 12;

  ngOnInit(): void {
    this.loadRecipes();
  }

  loadRecipes(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.recipeService.getAll().pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (recipes) => {
        this.recipes = recipes;
        this.filteredRecipes = [...this.recipes];
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar recetas');
      }
    });
  }

  onSearch(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let results = [...this.recipes];

    // Filtro por nombre
    const term = this.searchTerm.toLowerCase().trim();
    if (term) {
      results = results.filter(r => r.name.toLowerCase().includes(term));
    }

    // Filtro por alérgenos
    if (this.filterAllergens === 'with') {
      results = results.filter(r => r.allergens && r.allergens.length > 0);
    } else if (this.filterAllergens === 'without') {
      results = results.filter(r => !r.allergens || r.allergens.length === 0);
    }

    // Filtro por precio máximo
    if (this.filterMaxPrice !== null && this.filterMaxPrice > 0) {
      results = results.filter(r => r.totalCost <= this.filterMaxPrice!);
    }

    // Filtro por número de ingredientes
    if (this.filterMinIngredients !== null && this.filterMinIngredients > 0) {
      results = results.filter(r => r.components.length >= this.filterMinIngredients!);
    }
    if (this.filterMaxIngredients !== null && this.filterMaxIngredients > 0) {
      results = results.filter(r => r.components.length <= this.filterMaxIngredients!);
    }

    this.filteredRecipes = results;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filterAllergens = 'all';
    this.filterMaxPrice = null;
    this.filterMinIngredients = null;
    this.filterMaxIngredients = null;
    this.searchTerm = '';
    this.filteredRecipes = [...this.recipes];
    this.currentPage = 1;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterAllergens !== 'all') count++;
    if (this.filterMaxPrice !== null && this.filterMaxPrice > 0) count++;
    if (this.filterMinIngredients !== null && this.filterMinIngredients > 0) count++;
    if (this.filterMaxIngredients !== null && this.filterMaxIngredients > 0) count++;
    return count;
  }

  showAll(): void {
    this.clearFilters();
  }

  openRecipe(recipe: Recipe): void {
    this.selectedRecipe = recipe;
    this.showModal = true;
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
    return role === 'ADMIN' || role === 'CHEF';
  }

  // Paginación
  get paginatedRecipes(): Recipe[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRecipes.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRecipes.length / this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  printRecipe(): void {
    // TODO: Implementar impresión
  }

  openEditModal(): void {
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
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
        const msg = err.error?.message || err.error || 'Error al actualizar la receta';
        this.messageService.showError(msg);
      }
    });
  }

  onCookRecipe(event: { quantity: number; details: string }): void {
    if (!this.selectedRecipe) return;

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
        const msg = err.error?.message || err.error || 'Error al cocinar la receta';
        this.messageService.showError(msg);
      }
    });
  }
}
