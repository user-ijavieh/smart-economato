import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
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
export class OrderModalComponent implements OnInit {
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
  filteredProducts: Product[] = [];
  orderItems: OrderItem[] = [];
  showAutocomplete = false;
  isSubmitting = false;

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
    this.productService.getAll(0, 500).subscribe({
      next: (page) => {
        this.products = page.content;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar productos');
        this.cdr.markForCheck();
      }
    });
  }

  onProductSearch(term: string): void {
    if (!term || term.length < 2) {
      this.showAutocomplete = false;
      return;
    }
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 10);
    this.showAutocomplete = this.filteredProducts.length > 0;
  }

  selectProduct(product: Product): void {
    this.itemForm.productId = product.id;
    this.itemForm.productName = product.name;
    this.itemForm.unitPrice = product.unitPrice;
    this.itemForm.unit = product.unit || 'unidad';
    this.showAutocomplete = false;
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
