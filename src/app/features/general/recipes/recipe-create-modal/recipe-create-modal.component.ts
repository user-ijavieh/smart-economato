import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RecipeRequest } from '../../../../shared/models/recipe.model';
import { Product } from '../../../../shared/models/product.model';
import { Allergen } from '../../../../shared/models/allergen.model';
import { ProductService } from '../../../../core/services/product.service';
import { AllergenService } from '../../../../core/services/allergen.service';
import { MessageService } from '../../../../core/services/message.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';
import { SEARCH_DEBOUNCE_MS } from '../../../../core/constants/search.constants';

import { CommonModule, DecimalPipe } from '@angular/common';

interface FormComponent {
  productId: number;
  quantity: number;
  searchText: string;
  availabilityPercentage?: number;
}

@Component({
  selector: 'app-recipe-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, BarcodeScannerComponent, TranslateModule, DecimalPipe],
  templateUrl: './recipe-create-modal.component.html',
  styleUrl: './recipe-create-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeCreateModalComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private allergenService = inject(AllergenService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RecipeRequest>();
  @Input() isAdmin = false;
  @Input() modalTitle = '';
  @Input() actionLabel = '';
  @Input() initialRecipe: RecipeRequest | null = null;

  createForm: RecipeRequest = {
    name: '',
    elaboration: '',
    presentation: '',
    components: [],
    allergenIds: []
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
  showScannerModal = false;
  scannerComponentIndex: number | null = null;
  private searchSubject = new Subject<{ query: string, index: number }>();

  ngOnInit(): void {
    if (!this.modalTitle) {
      this.modalTitle = this.translate.instant('RECIPES.CREATE_MODAL_TITLE');
    }
    if (!this.actionLabel) {
      this.actionLabel = this.translate.instant('RECIPES.CREATE_ACTION_LABEL');
    }

    this.initialiseSearchSubscription();
    this.initialiseFromInput();
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

  private loadFormData(): void {
    this.loadProducts();
    this.loadAllergens();
  }

  private initialiseFromInput(): void {
    if (!this.initialRecipe) {
      return;
    }

    this.createForm = {
      name: this.initialRecipe.name ?? '',
      elaboration: this.initialRecipe.elaboration ?? '',
      presentation: this.initialRecipe.presentation ?? '',
      components: this.initialRecipe.components ?? [],
      allergenIds: this.initialRecipe.allergenIds ?? [],
      isHidden: this.initialRecipe.isHidden ?? false
    };

    this.formComponents = (this.initialRecipe.components ?? []).map(c => {
      const product = this.availableProducts.find(p => p.id === c.productId);
      return {
        productId: c.productId,
        quantity: c.quantity,
        searchText: product ? product.name : '',
        availabilityPercentage: product?.availabilityPercentage ?? 100
      };
    });
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
        this.syncComponentSearchTexts();
        this.loadingProducts = false;
        this.loadingMoreProducts = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError(this.translate.instant('COMMON.ERROR_LOADING_PRODUCTS'));
        this.loadingProducts = false;
        this.loadingMoreProducts = false;
        this.cdr.markForCheck();
      }
    });
  }

  private syncComponentSearchTexts(): void {
    if (!this.formComponents.length) {
      return;
    }

    for (const component of this.formComponents) {
      if (!component.searchText && component.productId > 0) {
        component.searchText = this.getProductName(component.productId);
      }
    }
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
        this.messageService.showError(this.translate.instant('COMMON.ERROR_LOADING_ALLERGENS'));
        this.loadingAllergens = false;
        this.cdr.markForCheck();
      }
    });
  }

  addComponent(): void {
    this.formComponents.push({ productId: 0, quantity: 0, searchText: '' });
    this.cdr.markForCheck();
  }

  removeComponent(index: number): void {
    this.formComponents.splice(index, 1);
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
    this.formComponents[index].productId = productId;

    const product = this.availableProducts.find(p => p.id === productId);
    if (product) {
      this.formComponents[index].searchText = product.name;
    }

    this.formComponents[index].availabilityPercentage = product?.availabilityPercentage ?? 100;

    this.showProductDropdown[index] = false;
    this.activeComponentIndex = null;
    this.productSearchQuery = '';
    this.productSearchResults = this.availableProducts;
    this.cdr.markForCheck();
  }

  onProductSearch(query: string, index: number): void {
    this.productSearchQuery = query;
    this.showProductDropdown[index] = true;
    this.activeComponentIndex = index;

    this.searchSubject.next({ query, index });
  }

  performSearch(query: string, index: number): void {
    if (!query.trim()) {
      this.productSearchResults = this.availableProducts;
      this.cdr.markForCheck();
      return;
    }

    this.productService.searchByName(query.trim(), 0, 50).subscribe({
      next: (response) => {
        this.productSearchResults = response.content;
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
    return product ? product.name : this.translate.instant('COMMON.PRODUCT_NOT_FOUND');
  }

  closeAllDropdowns(): void {
    Object.keys(this.showProductDropdown).forEach(key => {
      this.showProductDropdown[Number(key)] = false;
    });
    this.activeComponentIndex = null;
    this.cdr.markForCheck();
  }

  openBarcodeScanner(index: number): void {
    this.scannerComponentIndex = index;
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
    this.scannerComponentIndex = null;
  }

  onScannedProductFound(product: Product): void {
    if (this.scannerComponentIndex === null || this.scannerComponentIndex >= this.formComponents.length) {
      this.closeBarcodeScanner();
      return;
    }

    this.selectProduct(product.id, this.scannerComponentIndex);
    this.messageService.showSuccess(this.translate.instant('PRODUCT_MGMT.MESSAGES.PRODUCT_ADDED_SCAN', { name: product.name }));
    this.closeBarcodeScanner();
  }

  closeModal(): void {
    this.close.emit();
  }

  saveRecipe(): void {
    if (!this.createForm.name.trim()) {
      this.messageService.showError(this.translate.instant('RECIPES.MESSAGES.NAME_REQUIRED'));
      return;
    }

    if (this.formComponents.length === 0) {
      this.messageService.showError(this.translate.instant('RECIPES.MESSAGES.AT_LEAST_ONE_COMPONENT'));
      return;
    }

    // Map formComponents to createForm.components
    this.createForm.components = this.formComponents.map(c => ({
      productId: c.productId,
      quantity: c.quantity
    }));

    const invalidComponents = this.createForm.components.some(c => c.productId === 0 || c.quantity <= 0);
    if (invalidComponents) {
      this.messageService.showError(this.translate.instant('RECIPES.MESSAGES.INVALID_COMPONENTS'));
      return;
    }

    this.save.emit(this.createForm);
  }

  getGrossQuantity(netQuantity: number, availabilityPercentage?: number): number {
    if (!availabilityPercentage || availabilityPercentage <= 0) return netQuantity;
    return (netQuantity * 100) / availabilityPercentage;
  }
}
