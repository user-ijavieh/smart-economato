import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import { MessageService } from '../../core/services/message.service';
import { Product } from '../../shared/models/product.model';

interface ReceptionItem {
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  price: number;
  supplier: string;
  notes: string;
}

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reception.component.html',
  styleUrl: './reception.component.css'
})
export class ReceptionComponent implements OnInit {
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private messageService = inject(MessageService);

  items: ReceptionItem[] = [];
  showForm = false;
  loading = false;

  // Form
  products: Product[] = [];
  filteredProducts: Product[] = [];
  showAutocomplete = false;
  formItem = {
    productId: 0,
    productName: '',
    category: '',
    quantity: 1,
    price: 0,
    supplier: '',
    notes: ''
  };

  ngOnInit(): void {
    this.productService.getAll(0, 500).subscribe({
      next: (page) => this.products = page.content,
      error: () => this.messageService.showError('Error al cargar productos')
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  onProductSearch(term: string): void {
    if (!term || term.length < 2) {
      this.showAutocomplete = false;
      return;
    }
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 8);
    this.showAutocomplete = this.filteredProducts.length > 0;
  }

  selectProduct(product: Product): void {
    this.formItem.productId = product.id;
    this.formItem.productName = product.name;
    this.formItem.price = product.price;
    this.formItem.supplier = product.supplier?.name || '';
    this.showAutocomplete = false;
  }

  addItem(): void {
    if (!this.formItem.productId || this.formItem.quantity < 1) {
      this.messageService.showError('Completa los campos obligatorios');
      return;
    }
    this.items.push({ ...this.formItem });
    this.resetForm();
    this.showForm = false;
    this.messageService.showSuccess('Item agregado');
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  resetForm(): void {
    this.formItem = { productId: 0, productName: '', category: '', quantity: 1, price: 0, supplier: '', notes: '' };
    this.showAutocomplete = false;
  }

  getItemTotal(item: ReceptionItem): number {
    return item.quantity * item.price;
  }

  saveReception(): void {
    if (this.items.length === 0) return;
    this.messageService.showSuccess('Recepción guardada correctamente');
    this.items = [];
  }
}
