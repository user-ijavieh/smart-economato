import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Recipe, RecipeRequest } from '../../../../shared/models/recipe.model';
import { Product } from '../../../../shared/models/product.model';
import { Allergen } from '../../../../shared/models/allergen.model';
import { ProductService } from '../../../../core/services/product.service';
import { AllergenService } from '../../../../core/services/allergen.service';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../../core/constants/search.constants';

interface FormComponent {
  productId: number;
  quantity: number;
  searchText: string;
  availabilityPercentage?: number;
}


@Component({
  selector: 'app-recipe-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, BarcodeScannerComponent],
  templateUrl: './recipe-edit-modal.component.html',
  styleUrl: './recipe-edit-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeEditModalComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private allergenService = inject(AllergenService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) recipe!: Recipe;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RecipeRequest>();
  @Input() isAdmin = false;
  @Input() showingHidden = false;
  @Output() toggleHidden = new EventEmitter<void>();
  editForm: RecipeRequest = {
    name: '',
    elaboration: '',
    presentation: '',
    components: [],
    allergenIds: [],
    sellingPrice: 0
  };


  formComponents: FormComponent[] = [];

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
  productsCache: Map<number, Product> = new Map();
  showScannerModal = false;

  scannerComponentIndex: number | null = null;
  private searchSubject = new Subject<{ query: string, index: number }>();

  ngOnInit(): void {
    this.initialiseSearchSubscription();
    this.initializeForm();
    this.loadFormData();
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  private initialiseSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged((prev, curr) => prev.query === curr.query && prev.index === curr.index)
    ).subscribe(({ query, index }) => {
      this.performSearch(query, index);
    });
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
      allergenIds: this.recipe.allergens?.map(a => a.id) || [],
      sellingPrice: this.recipe.sellingPrice || 0,
      portions: 1
    };



    // Initialize formComponents
    this.formComponents = this.recipe.components.map(c => ({
      productId: c.productId,
      quantity: c.quantity,
      searchText: c.productName || '',
      availabilityPercentage: c.availabilityPercentage
    }));


    // Map existing product names and populate cache
    this.recipe.components.forEach(c => {
      this.productNamesMap[c.productId] = c.productName;
      // Pre-populate cache with basic data we have
      this.productsCache.set(c.productId, {
        id: c.productId,
        name: c.productName,
        unitPrice: c.subtotal / (c.quantity > 0 ? c.quantity : 1), // Rough estimate if not loaded
        availabilityPercentage: c.availabilityPercentage
      } as Product);
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
          
          // Cache all loaded products
          response.content.forEach(p => this.productsCache.set(p.id, p));

          this.currentProductPage = page;

          this.totalProductPages = response.totalPages;
          this.loadingProducts = false;
          this.loadingMoreProducts = false;
          this.cdr.markForCheck();
        }
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
    this.allergenService.getAll(0, 50).subscribe({
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

  closeModal(): void {
    this.close.emit();
  }

  addComponent(): void {
    this.formComponents.push({ productId: 0, quantity: 0, searchText: '', availabilityPercentage: 100 });
    this.cdr.markForCheck();
  }


  removeComponent(index: number): void {
    this.formComponents.splice(index, 1);
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

    this.searchSubject.next({ query, index });
  }

  performSearch(query: string, index: number): void {
    if (!query || query.trim() === '') {
      this.productSearchResults = this.availableProducts;
      this.cdr.markForCheck();
      return;
    }

    this.productService.searchByName(query.trim(), 0, 50).subscribe({
      next: (response) => {
        this.productSearchResults = response.content;
        // Actualizar mapa de nombres y cache
        response.content.forEach(p => {
          this.productNamesMap[p.id] = p.name;
          this.productsCache.set(p.id, p);
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
  }

  selectProduct(productId: number, index: number): void {
    this.formComponents[index].productId = productId;

    // Actualizar el mapa de nombres con el nuevo producto
    const selectedProduct = this.productsCache.get(productId);
    if (selectedProduct) {
      this.productNamesMap[productId] = selectedProduct.name;
      this.formComponents[index].searchText = selectedProduct.name;
      this.formComponents[index].availabilityPercentage = selectedProduct.availabilityPercentage != null ? selectedProduct.availabilityPercentage : 100;
    }



    this.showProductDropdown[index] = false;
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.productSearchResults = this.availableProducts;
    this.cdr.markForCheck();
  }

  openBarcodeScanner(index: number): void {
    this.scannerComponentIndex = index;
    this.showScannerModal = true;
    this.cdr.markForCheck();
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
    this.scannerComponentIndex = null;
    this.cdr.markForCheck();
  }

  onScannedProductFound(product: Product): void {
    if (this.scannerComponentIndex === null || !this.formComponents[this.scannerComponentIndex]) {
      this.closeBarcodeScanner();
      return;
    }

    const index = this.scannerComponentIndex;
    this.formComponents[index].productId = product.id;
    this.formComponents[index].searchText = product.name;
    this.formComponents[index].availabilityPercentage = product.availabilityPercentage != null ? product.availabilityPercentage : 100;
    this.productNamesMap[product.id] = product.name;
    this.productsCache.set(product.id, product);


    this.showProductDropdown[index] = false;
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.productSearchResults = this.availableProducts;
    this.closeBarcodeScanner();
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

    // Map formComponents to editForm.components
    this.editForm.components = this.formComponents.map(c => ({
      productId: c.productId,
      quantity: c.quantity
    }));

    this.save.emit(this.editForm);
  }

  suggestSellingPrice(): void {
    const totalCost = this.calculateEstimatedTotalCost();
    this.editForm.sellingPrice = Math.ceil(totalCost * 1.20 * 100) / 100;
    this.cdr.markForCheck();
  }

  calculateEstimatedTotalCost(): number {
    return this.formComponents.reduce((acc, comp) => {
      const product = this.productsCache.get(comp.productId);
      if (!product || !product.unitPrice) return acc;

      
      const availability = product.availabilityPercentage || 100;
      const grossQuantity = comp.quantity * 100 / (availability > 0 ? availability : 100);
      return acc + (grossQuantity * product.unitPrice);
    }, 0);
  }


  private validateForm(): boolean {
    if (!this.editForm.name.trim()) {
      this.messageService.showError('El nombre es requerido');
      return false;
    }

    if (this.formComponents.length === 0) {
      this.messageService.showError('Debe agregar al menos un componente');
      return false;
    }

    const invalidComponents = this.formComponents.some(
      c => c.productId === 0 || c.quantity <= 0
    );
    if (invalidComponents) {
      this.messageService.showError('Todos los componentes deben tener un producto y cantidad válida');
      return false;
    }

    return true;
  }

  async onToggleHidden(): Promise<void> {
    const action = this.showingHidden ? 'mostrar' : 'ocultar';
    const confirmed = await this.messageService.confirm(
      `Confirmar ${action}`,
      `¿Estás seguro de que deseas ${action} la receta "${this.recipe.name}"?`
    );

    if (confirmed) {
      this.toggleHidden.emit();
    }
  }

  getToggleButtonText(): string {
    return this.showingHidden ? 'Mostrar' : 'Ocultar';
  }

  getGrossQuantity(net: number, availability?: number): number {
    if (!availability || availability <= 0 || availability >= 100) {
      return net;
    }
    return net * 100 / availability;
  }
}

