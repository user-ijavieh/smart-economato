import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ProductService } from '../../../core/services/product.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { Product } from '../../../shared/models/product.model';
import { User } from '../../../shared/models/user.model';
import { OrderRequest } from '../../../shared/models/order.model';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './order-modal.component.html',
  styleUrl: './order-modal.component.css'
})
export class OrderModalComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Output() closeModal = new EventEmitter<void>();
  @Output() orderCreated = new EventEmitter<void>();

  users: User[] = [];
  selectedUserId: number | null = null;
  products: Product[] = [];
  orderItems: OrderItem[] = [];
  showProductDropdown = false;
  isSubmitting = false;

  currentPage = 0;
  pageSize = 20;
  hasMoreProducts = true;
  isLoadingProducts = false;
  private searchTimeout: any = null;
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
    this.loadUsers();
    this.loadProducts();
    // Listener para cerrar dropdown al hacer clic fuera
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick.bind(this));
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
    this.userService.getAll().subscribe({
      next: (users) => {
        this.users = users;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar usuarios');
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

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!query || query.trim() === '') {
      this.productSearchResults = null;
      this.cdr.markForCheck();
      return;
    }

    this.searchTimeout = setTimeout(() => {
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
    }, 400);
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

  submitOrder(): void {
    if (this.orderItems.length === 0) {
      this.messageService.showError('Agrega al menos un producto al pedido');
      return;
    }

    if (!this.selectedUserId) {
      this.messageService.showError('Selecciona un usuario para el pedido');
      return;
    }

    this.isSubmitting = true;

    const orderRequest: OrderRequest = {
      userId: this.selectedUserId,
      details: this.orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };

    this.orderService.create(orderRequest).subscribe({
      next: () => {
        this.messageService.showSuccess('Pedido creado exitosamente');
        this.isSubmitting = false;
        this.orderCreated.emit();
        this.close();
      },
      error: (error) => {
        console.error('Error creating order:', error);
        this.messageService.showError('Error al crear el pedido');
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
