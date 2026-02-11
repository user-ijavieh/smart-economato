import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Recipe, RecipeRequest } from '../../../shared/models/recipe.model';
import { Product } from '../../../shared/models/product.model';
import { Allergen } from '../../../shared/models/allergen.model';
import { ProductService } from '../../../core/services/product.service';
import { AllergenService } from '../../../core/services/allergen.service';
import { MessageService } from '../../../core/services/message.service';

@Component({
  selector: 'app-recipe-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-edit-modal.component.html',
  styleUrl: './recipe-edit-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeEditModalComponent implements OnInit {
  private productService = inject(ProductService);
  private allergenService = inject(AllergenService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) recipe!: Recipe;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RecipeRequest>();

  editForm: RecipeRequest = {
    name: '',
    elaboration: '',
    presentation: '',
    components: [],
    allergenIds: []
  };

  availableProducts: Product[] = [];
  availableAllergens: Allergen[] = [];
  loadingProducts = false;
  loadingAllergens = false;
  loadingMoreProducts = false;
  currentProductPage = 0;
  totalProductPages = 0;
  productSearchQuery = '';
  productSearchResults: Product[] = [];
  showProductDropdown: { [key: number]: boolean } = {};
  activeComponentIndex: number | null = null;
  productNamesMap: { [key: number]: string } = {};
  private searchTimeout: any = null;

  ngOnInit(): void {
    this.initializeForm();
    this.loadFormData();
  }

  private initializeForm(): void {
    this.editForm = {
      name: this.recipe.name,
      elaboration: this.recipe.elaboration || '',
      presentation: this.recipe.presentation || '',
      components: this.recipe.components.map(c => ({
        productId: c.productId,
        quantity: c.quantity
      })),
      allergenIds: this.recipe.allergens?.map(a => a.id) || []
    };

    // Crear mapa de nombres de productos para mostrar inmediatamente
    this.recipe.components.forEach(c => {
      this.productNamesMap[c.productId] = c.productName;
    });
  }

  private loadFormData(): void {
    this.loadProducts();
    this.loadAllergens();
  }

  private loadProducts(page: number = 0, append: boolean = false): void {
    if (append) {
      this.loadingMoreProducts = true;
    } else {
      this.loadingProducts = true;
    }

    this.productService.getAll(page, 50).subscribe({
      next: (response) => {
        if (append) {
          this.availableProducts = [...this.availableProducts, ...response.content];
          // Actualizar resultados de búsqueda si hay filtro activo
          if (this.productSearchQuery && this.productSearchQuery.trim() !== '') {
            const newResults = response.content.filter(p =>
              p.name.toLowerCase().includes(this.productSearchQuery.toLowerCase())
            );
            this.productSearchResults = [...this.productSearchResults, ...newResults];
          } else {
            this.productSearchResults = this.availableProducts;
          }
        } else {
          this.availableProducts = response.content;
          this.productSearchResults = response.content;
        }
        this.currentProductPage = page;
        this.totalProductPages = response.totalPages;
        this.loadingProducts = false;
        this.loadingMoreProducts = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar productos');
        this.loadingProducts = false;
        this.loadingMoreProducts = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadAllergens(): void {
    this.loadingAllergens = true;
    this.allergenService.getAll(0, 100).subscribe({
      next: (page) => {
        this.availableAllergens = page.content;
        this.loadingAllergens = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar alérgenos');
        this.loadingAllergens = false;
        this.cdr.markForCheck();
      }
    });
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  addComponent(): void {
    this.editForm.components.push({ productId: 0, quantity: 0 });
    this.cdr.markForCheck();
  }

  removeComponent(index: number): void {
    this.editForm.components.splice(index, 1);
    this.cdr.markForCheck();
  }

  toggleAllergen(allergenId: number): void {
    if (!this.editForm.allergenIds) {
      this.editForm.allergenIds = [];
    }
    const index = this.editForm.allergenIds.indexOf(allergenId);
    if (index > -1) {
      this.editForm.allergenIds.splice(index, 1);
    } else {
      this.editForm.allergenIds.push(allergenId);
    }
    this.cdr.markForCheck();
  }

  isAllergenSelected(allergenId: number): boolean {
    return this.editForm.allergenIds?.includes(allergenId) || false;
  }

  onProductSearch(query: string, index: number): void {
    this.productSearchQuery = query;
    this.activeComponentIndex = index;
    this.showProductDropdown[index] = true;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!query || query.trim() === '') {
      this.productSearchResults = this.availableProducts;
      this.cdr.markForCheck();
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.productService.searchByName(query.trim(), 0, 50).subscribe({
        next: (response) => {
          this.productSearchResults = response.content;
          // Actualizar mapa de nombres
          response.content.forEach(p => {
            this.productNamesMap[p.id] = p.name;
          });
          this.cdr.markForCheck();
        },
        error: () => {
          // Fallback a filtro local
          this.productSearchResults = this.availableProducts.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase())
          );
          this.cdr.markForCheck();
        }
      });
    }, 400);
  }

  selectProduct(productId: number, index: number): void {
    this.editForm.components[index].productId = productId;

    // Actualizar el mapa de nombres con el nuevo producto
    const selectedProduct = this.availableProducts.find(p => p.id === productId);
    if (selectedProduct) {
      this.productNamesMap[productId] = selectedProduct.name;
    }

    this.showProductDropdown[index] = false;
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.productSearchResults = this.availableProducts;
    this.cdr.markForCheck();
  }

  getProductName(productId: number): string {
    if (productId === 0) {
      return '';
    }

    // Usar el mapa de nombres primero (inmediato)
    if (this.productNamesMap[productId]) {
      return this.productNamesMap[productId];
    }

    // Fallback a availableProducts
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.name : '';
  }

  onProductDropdownScroll(event: Event, index: number): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    // Si está a 100px del final y hay más páginas
    if (scrollHeight - scrollPosition < 100 && !this.loadingMoreProducts) {
      if (this.currentProductPage < this.totalProductPages - 1) {
        this.loadProducts(this.currentProductPage + 1, true);
      }
    }
  }

  toggleProductDropdown(index: number): void {
    // Cerrar otros dropdowns
    Object.keys(this.showProductDropdown).forEach(key => {
      if (Number(key) !== index) {
        this.showProductDropdown[Number(key)] = false;
      }
    });

    this.showProductDropdown[index] = !this.showProductDropdown[index];
    if (this.showProductDropdown[index]) {
      this.activeComponentIndex = index;
      this.productSearchResults = this.availableProducts;
    } else {
      this.activeComponentIndex = null;
    }
    this.cdr.markForCheck();
  }

  closeAllDropdowns(): void {
    this.showProductDropdown = {};
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.cdr.markForCheck();
  }

  saveRecipe(): void {
    if (!this.validateForm()) {
      return;
    }
    this.save.emit(this.editForm);
  }

  private validateForm(): boolean {
    if (!this.editForm.name.trim()) {
      this.messageService.showError('El nombre es requerido');
      return false;
    }

    if (this.editForm.components.length === 0) {
      this.messageService.showError('Debe agregar al menos un componente');
      return false;
    }

    const invalidComponents = this.editForm.components.some(
      c => c.productId === 0 || c.quantity <= 0
    );
    if (invalidComponents) {
      this.messageService.showError('Todos los componentes deben tener un producto y cantidad válida');
      return false;
    }

    return true;
  }
}
