import { Component, OnInit, OnDestroy, Output, Input, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../core/services/order.service';
import { ProductService } from '../../../../core/services/product.service';
import { UserService } from '../../../../core/services/user.service';
import { SupplierService } from '../../../../core/services/supplier.service';
import { MessageService } from '../../../../core/services/message.service';
import { Product } from '../../../../shared/models/product.model';
import { User } from '../../../../shared/models/user.model';
import { Supplier } from '../../../../shared/models/supplier.model';
import { Order, OrderRequest } from '../../../../shared/models/order.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';
import { SEARCH_DEBOUNCE_MS } from '../../../../core/constants/search.constants';

interface OrderItem {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DecimalPipe, BarcodeScannerComponent],
  templateUrl: './order-modal.component.html',
  styleUrl: './order-modal.component.css'
})
export class OrderModalComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private supplierService = inject(SupplierService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Output() closeModal = new EventEmitter<void>();
  @Output() orderCreated = new EventEmitter<void>();
  @Input() editOrder: Order | null = null;
  @Input() initialUserId: number | null = null;
  @Input() initialSupplierId: number | null = null;
  @Input() initialItems: Array<{ productId: number; productName: string; unit: string; quantity: number; unitPrice: number }> = [];

  users: User[] = [];
  selectedUserId: number | null = null;
  suppliers: Supplier[] = [];
  selectedSupplierId: number | null = null;
  products: Product[] = [];
  orderItems: OrderItem[] = [];
  showProductDropdown = false;
  isSubmitting = false;
  showScannerModal = false;

  currentPage = 0;
  pageSize = 20;
  hasMoreProducts = true;
  isLoadingProducts = false;
  private searchSubject = new Subject<string>();
  private productSearchResults: Product[] | null = null;

  // Form for adding products
  itemForm = {
    productId: 0,
    productName: '',
    unit: '',
    quantity: 1,
    unitPrice: 0
  };

  ngOnInit(): void {
    this.initialiseSearchSubscription();
    this.loadUsers();
    this.loadSuppliers();
    this.loadProducts();

    if (this.editOrder) {
      this.selectedUserId = this.editOrder.userId;
      this.selectedSupplierId = this.editOrder.supplierId || null;
      this.orderItems = (this.editOrder.details || []).map(d => ({
        productId: d.productId,
        productName: d.productName,
        unit: d.unit || 'uds',
        quantity: d.quantity,
        unitPrice: d.unitPrice
      }));
    } else if (this.initialItems.length > 0) {
      this.selectedUserId = this.initialUserId;
      this.selectedSupplierId = this.initialSupplierId;
      this.orderItems = this.initialItems.map(item => ({ ...item }));
    }

    // Listener para cerrar dropdown al hacer clic fuera
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick.bind(this));
    this.searchSubject.complete();
  }

  private initialiseSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.autocomplete-container');
    if (!dropdown && this.showProductDropdown) {
      this.showProductDropdown = false;
      this.cdr.markForCheck();
    }
  }

  loadUsers(): void {
    this.userService.search('', 0, 50).subscribe({
      next: (page) => {
        this.users = page.content || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar usuarios');
        this.cdr.markForCheck();
      }
    });
  }

  loadSuppliers(): void {
    this.supplierService.getAll(0, 50).subscribe({
      next: (page) => {
        this.suppliers = page.content;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar proveedores');
        this.cdr.markForCheck();
      }
    });
  }

  loadProducts(): void {
    if (this.isLoadingProducts || !this.hasMoreProducts) return;

    this.isLoadingProducts = true;
    this.productService.getAll(this.currentPage, this.pageSize).subscribe({
      next: (page) => {
        this.products = [...this.products, ...page.content];
        this.hasMoreProducts = !page.last;
        this.currentPage++;
        this.isLoadingProducts = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar productos');
        this.isLoadingProducts = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleProductDropdown(): void {
    this.showProductDropdown = !this.showProductDropdown;
    if (this.showProductDropdown) {
      this.productSearchResults = null; // Show all products
    }
  }

  get filteredProducts(): Product[] {
    return this.productSearchResults ?? this.products;
  }

  onProductSearch(query: string): void {
    this.showProductDropdown = true;
    this.searchSubject.next(query);
  }

  performSearch(query: string): void {
    if (!query || query.trim() === '') {
      this.productSearchResults = null;
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
        this.productSearchResults = this.products.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase())
        );
        this.cdr.markForCheck();
      }
    });
  }

  onProductDropdownScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 50; // píxeles antes del final
    const position = element.scrollTop + element.offsetHeight;
    const height = element.scrollHeight;

    // Si estamos cerca del final y hay más productos para cargar
    if (position >= height - threshold && !this.isLoadingProducts && this.hasMoreProducts) {
      this.loadProducts();
    }
  }

  selectProduct(product: Product): void {
    this.itemForm.productId = product.id;
    this.itemForm.productName = product.name;
    this.itemForm.unitPrice = product.unitPrice;
    this.itemForm.unit = product.unit || 'unidad';
    this.showProductDropdown = false;
    this.productSearchResults = null;
  }

  openBarcodeScanner(): void {
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
  }

  onProductFound(product: Product): void {
    this.selectProduct(product);
    this.showScannerModal = false;
    this.messageService.showSuccess(`Producto detectado: ${product.name}`);
    this.cdr.markForCheck();
  }

  addItemToOrder(): void {
    if (!this.itemForm.productId || this.itemForm.quantity < 1) {
      this.messageService.showError('Selecciona un producto y una cantidad válida');
      return;
    }

    // Check if product already exists
    const existingIndex = this.orderItems.findIndex(i => i.productId === this.itemForm.productId);
    if (existingIndex >= 0) {
      this.orderItems[existingIndex].quantity += this.itemForm.quantity;
    } else {
      this.orderItems.push({ ...this.itemForm });
    }

    this.resetItemForm();
    this.cdr.markForCheck();
  }

  removeItem(index: number): void {
    this.orderItems.splice(index, 1);
  }

  resetItemForm(): void {
    this.itemForm = {
      productId: 0,
      productName: '',
      unit: '',
      quantity: 1,
      unitPrice: 0
    };
  }

  getOrderTotal(): number {
    return this.orderItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  close(): void {
    this.closeModal.emit();
  }

  async submitOrder(): Promise<void> {
    if (this.orderItems.length === 0) {
      this.messageService.showError('Agrega al menos un producto al pedido');
      return;
    }

    if (!this.selectedUserId) {
      this.messageService.showError('Selecciona un usuario para el pedido');
      return;
    }

    // Obtener el nombre del usuario seleccionado para el mensaje de confirmación
    const selectedUser = this.users.find(u => u.id === this.selectedUserId);
    const userName = selectedUser ? selectedUser.name : 'usuario seleccionado';

    const totalItems = this.orderItems.length;
    const confirmed = await this.messageService.confirm(
      'Confirmar pedido',
      `¿Crear pedido de ${totalItems} producto${totalItems > 1 ? 's' : ''} para ${userName}?`
    );

    if (!confirmed) {
      return;
    }

    this.isSubmitting = true;

    const orderRequest: OrderRequest = {
      userId: this.selectedUserId,
      supplierId: this.selectedSupplierId || undefined,
      details: this.orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };

    const action$ = this.editOrder 
      ? this.orderService.update(this.editOrder.id, orderRequest)
      : this.orderService.create(orderRequest);

    action$.subscribe({
      next: () => {
        this.messageService.showSuccess(this.editOrder ? 'Pedido actualizado exitosamente' : 'Pedido creado exitosamente');
        this.isSubmitting = false;
        this.orderCreated.emit();
        this.closeModal.emit();
      },
      error: (error) => {
        console.error('Error submitting order:', error);
        this.messageService.showError(this.editOrder ? 'Error al actualizar el pedido' : 'Error al crear el pedido');
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
