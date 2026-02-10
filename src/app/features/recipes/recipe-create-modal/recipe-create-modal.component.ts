import { Component, Output, EventEmitter, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeRequest } from '../../../shared/models/recipe.model';
import { Product } from '../../../shared/models/product.model';
import { Allergen } from '../../../shared/models/allergen.model';
import { ProductService } from '../../../core/services/product.service';
import { AllergenService } from '../../../core/services/allergen.service';
import { MessageService } from '../../../core/services/message.service';

@Component({
  selector: 'app-recipe-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-create-modal.component.html',
  styleUrl: './recipe-create-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeCreateModalComponent implements OnInit {
  private productService = inject(ProductService);
  private allergenService = inject(AllergenService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RecipeRequest>();

  createForm: RecipeRequest = {
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

  ngOnInit(): void {
    this.loadFormData();
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

    this.productService.getAll(page, 20).subscribe({
      next: (response) => {
        if (append) {
          this.availableProducts = [...this.availableProducts, ...response.content];
          if (this.productSearchQuery) {
            const newResults = response.content.filter(p => 
              p.name.toLowerCase().includes(this.productSearchQuery.toLowerCase())
            );
            this.productSearchResults = [...this.productSearchResults, ...newResults];
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
    this.allergenService.getAll().subscribe({
      next: (response) => {
        this.availableAllergens = response.content;
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

  addComponent(): void {
    this.createForm.components.push({ productId: 0, quantity: 0 });
    this.cdr.markForCheck();
  }

  removeComponent(index: number): void {
    this.createForm.components.splice(index, 1);
    delete this.showProductDropdown[index];
    this.cdr.markForCheck();
  }

  toggleAllergen(allergenId: number): void {
    if (!this.createForm.allergenIds) {
      this.createForm.allergenIds = [];
    }
    const index = this.createForm.allergenIds.indexOf(allergenId);
    if (index > -1) {
      this.createForm.allergenIds.splice(index, 1);
    } else {
      this.createForm.allergenIds.push(allergenId);
    }
  }

  isAllergenSelected(allergenId: number): boolean {
    return this.createForm.allergenIds?.includes(allergenId) || false;
  }

  toggleProductDropdown(index: number): void {
    Object.keys(this.showProductDropdown).forEach(key => {
      if (Number(key) !== index) {
        this.showProductDropdown[Number(key)] = false;
      }
    });
    
    this.showProductDropdown[index] = !this.showProductDropdown[index];
    this.activeComponentIndex = this.showProductDropdown[index] ? index : null;
    
    if (this.showProductDropdown[index]) {
      this.productSearchQuery = '';
      this.productSearchResults = this.availableProducts;
    }
    
    this.cdr.markForCheck();
  }

  selectProduct(productId: number, index: number): void {
    this.createForm.components[index].productId = productId;
    this.showProductDropdown[index] = false;
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.productSearchResults = this.availableProducts;
    this.cdr.markForCheck();
  }

  onProductSearch(query: string, index: number): void {
    this.productSearchQuery = query;
    
    if (!query.trim()) {
      this.productSearchResults = this.availableProducts;
    } else {
      this.productSearchResults = this.availableProducts.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    this.cdr.markForCheck();
  }

  onProductDropdownScroll(event: Event, index: number): void {
    const element = event.target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrollPosition = scrollTop + clientHeight;
    
    if (scrollHeight - scrollPosition < 100 && !this.loadingMoreProducts) {
      if (this.currentProductPage < this.totalProductPages - 1) {
        this.loadingMoreProducts = true;
        this.loadProducts(this.currentProductPage + 1, true);
        this.loadingMoreProducts = false;
      }
    }
  }

  getProductName(productId: number): string {
    if (productId === 0) return '';
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.name : 'Producto no encontrado';
  }

  closeAllDropdowns(): void {
    Object.keys(this.showProductDropdown).forEach(key => {
      this.showProductDropdown[Number(key)] = false;
    });
    this.activeComponentIndex = null;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  saveRecipe(): void {
    if (!this.createForm.name.trim()) {
      this.messageService.showError('El nombre es obligatorio');
      return;
    }

    if (this.createForm.components.length === 0) {
      this.messageService.showError('Debe agregar al menos un componente');
      return;
    }

    const invalidComponents = this.createForm.components.some(c => c.productId === 0 || c.quantity <= 0);
    if (invalidComponents) {
      this.messageService.showError('Todos los componentes deben tener un producto y cantidad válidos');
      return;
    }

    this.save.emit(this.createForm);
  }
}
