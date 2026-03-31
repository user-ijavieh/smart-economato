import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { RecipeService } from '../../../core/services/recipe.service';
import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { Recipe, RecipeRequest } from '../../../shared/models/recipe.model';
import { RecipeDetailModalComponent } from './recipe-detail-modal/recipe-detail-modal.component';
import { RecipeEditModalComponent } from './recipe-edit-modal/recipe-edit-modal.component';
import { RecipeCreateModalComponent } from './recipe-create-modal/recipe-create-modal.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { finalize, Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipeDetailModalComponent, RecipeEditModalComponent, RecipeCreateModalComponent],
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-10px)' }),
        animate('300ms cubic-bezier(0.175, 0.885, 0.32, 1.1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(-10px)' }))
      ])
    ]),
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('350ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class RecipesComponent implements OnInit {
  private recipeService = inject(RecipeService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);

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
  }

  initialiseSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
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
    this.cdr.markForCheck();

    const sort = this.getSortString();

    this.recipeService.getAll(this.currentPage, this.pageSize, sort).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page) => {
        console.log('📦 Recipes Loaded:', page);
        this.recipes = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        console.log('🔢 Total Pages:', this.totalPages);
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
    this.cdr.markForCheck();

    const sort = this.getSortString();

    this.recipeService.searchByName(term, this.currentPage, this.pageSize, sort)
      .pipe(
        finalize(() => {
          this.loading = false;
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
    return role === 'ADMIN' || role === 'CHEF';
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
    this.showCreateModal = true;
    this.cdr.markForCheck();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.cdr.markForCheck();
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
        // Handled by interceptor
      }
    });
  }
}
