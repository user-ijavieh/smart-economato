import { Component, Output, EventEmitter, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { OrderBuilderComponent } from '../../../../shared/components/order-builder/order-builder.component';
import { RecipeService } from '../../../../core/services/recipe.service';
import { SupplierService } from '../../../../core/services/supplier.service';
import { ProductService } from '../../../../core/services/product.service';
import { MessageService } from '../../../../core/services/message.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Recipe } from '../../../../shared/models/recipe.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { WeeklyPlanRepositionOrderItem } from '../../../../shared/models/weekly-plan.model';

interface SelectedRecipe {
  recipe: Recipe;
  quantity: number;
}

@Component({
  selector: 'app-recipe-order-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, OrderBuilderComponent],
  templateUrl: './recipe-order-wizard-modal.component.html',
  styleUrls: ['./recipe-order-wizard-modal.component.css']
})
export class RecipeOrderWizardModalComponent implements OnInit {
  private recipeService = inject(RecipeService);
  private supplierService = inject(SupplierService);
  private productService = inject(ProductService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  @Output() closed = new EventEmitter<void>();

  step = 1;
  recipes: Recipe[] = [];
  loadingRecipes = false;
  recipeSearchTerm = '';
  selectedRecipes: SelectedRecipe[] = [];
  
  stockOrderItems: WeeklyPlanRepositionOrderItem[] = [];
  suppliers: Supplier[] = [];
  loadingRequirements = false;

  ngOnInit(): void {
    this.loadRecipes();
    this.loadSuppliers();
  }

  loadRecipes(): void {
    this.loadingRecipes = true;
    this.recipeService.getAll(0, 1000).subscribe({
      next: (page) => {
        this.recipes = page.content;
        this.loadingRecipes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRecipes = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadSuppliers(): void {
    this.supplierService.getAll(0, 1000).subscribe({
      next: (page) => {
        this.suppliers = page.content;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredRecipes(): Recipe[] {
    const term = this.recipeSearchTerm.trim().toLowerCase();
    if (!term) return this.recipes;
    return this.recipes.filter(r => r.name.toLowerCase().includes(term));
  }

  toggleRecipe(recipe: Recipe): void {
    const index = this.selectedRecipes.findIndex(sr => sr.recipe.id === recipe.id);
    if (index > -1) {
      this.selectedRecipes.splice(index, 1);
    } else {
      this.selectedRecipes.push({ recipe, quantity: recipe.portions || 1 });
    }
  }

  isRecipeSelected(recipeId: number): boolean {
    return this.selectedRecipes.some(sr => sr.recipe.id === recipeId);
  }

  async nextStep(): Promise<void> {
    if (this.selectedRecipes.length === 0) {
      this.messageService.showWarning('Selecciona al menos una receta.');
      return;
    }

    this.loadingRequirements = true;
    const request = this.selectedRecipes.map(sr => ({
      recipeId: sr.recipe.id,
      quantity: sr.quantity
    }));

    this.recipeService.calculateRequirements(request).subscribe({
      next: async (requirements) => {
        try {
          const enrichRequests = requirements.map(async req => {
            const product = await firstValueFrom(this.productService.getById(req.productId));
            return {
              ...req,
              unit: product.unit || 'ud',
              unitPrice: product.unitPrice || 0,
              supplierId: product.supplier?.id ?? null,
              supplierName: product.supplier?.name ?? null,
              lotQuantity: product.lotQuantity || 0,
              orderQuantity: req.grossRequiredQuantity || req.requiredQuantity
            } as WeeklyPlanRepositionOrderItem;
          });

          this.stockOrderItems = await Promise.all(enrichRequests).then(items => items.map(item => ({
            ...item,
            availableStock: 0,
            sufficient: false
          })));
          
          this.step = 2;
        } catch (err) {
          this.messageService.showError('Error al enriquecer información de productos.');
        } finally {
          this.loadingRequirements = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.loadingRequirements = false;
        this.messageService.showError('Error al calcular requisitos.');
        this.cdr.detectChanges();
      }
    });
  }

  prevStep(): void {
    this.step = 1;
  }

  handleCompleted(): void {
    this.closed.emit();
  }

  handleCancelled(): void {
    this.closed.emit();
  }

  getUserId(): number {
    return this.authService.getUserId() || 1;
  }
}
