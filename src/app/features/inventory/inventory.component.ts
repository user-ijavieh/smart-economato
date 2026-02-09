import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { MessageService } from '../../core/services/message.service';
import { Product } from '../../shared/models/product.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  private productService = inject(ProductService);
  private messageService = inject(MessageService);

  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  searchTerm = '';
  showForm = false;

  // Form fields
  formProduct = {
    name: '',
    price: 0,
    stock: 0,
    minStock: 0,
    unit: '',
    supplierId: undefined as number | undefined
  };

  // Sorting
  sortColumn = '';
  sortDir: 'asc' | 'desc' | 'none' = 'none';

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getAll(0, 200).subscribe({
      next: (page) => {
        this.products = page.content;
        this.filteredProducts = [...this.products];
        this.loading = false;
      },
      error: () => {
        this.messageService.showError('Error al cargar productos');
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredProducts = [...this.products];
      return;
    }
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.supplier?.name?.toLowerCase().includes(term)
    );
  }

  showAll(): void {
    this.searchTerm = '';
    this.filteredProducts = [...this.products];
  }

  checkStock(): void {
    const lowStockProducts = this.products.filter(p => this.isLowStock(p));
    if (lowStockProducts.length === 0) {
      this.messageService.showSuccess('Todos los productos tienen stock suficiente');
    } else {
      this.messageService.showWarning(`${lowStockProducts.length} producto(s) con stock bajo`);
      this.filteredProducts = lowStockProducts;
    }
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  cancelForm(): void {
    this.showForm = false;
    this.resetForm();
  }

  resetForm(): void {
    this.formProduct = { name: '', price: 0, stock: 0, minStock: 0, unit: '', supplierId: undefined };
  }

  submitProduct(): void {
    this.productService.create({
      name: this.formProduct.name,
      price: this.formProduct.price,
      stock: this.formProduct.stock,
      minStock: this.formProduct.minStock,
      unit: this.formProduct.unit || 'Ud',
      supplierId: this.formProduct.supplierId
    }).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto creado correctamente');
        this.showForm = false;
        this.resetForm();
        this.loadProducts();
      },
      error: () => {
        this.messageService.showError('Error al crear producto');
      }
    });
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : this.sortDir === 'desc' ? 'none' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }

    if (this.sortDir === 'none') {
      this.filteredProducts = [...this.products];
      return;
    }

    // TODO: Manejar mejor el filtrado de productos
    this.filteredProducts.sort((a, b) => {
      let valA: any, valB: any;
      switch (column) {
        case 'id': valA = a.id; valB = b.id; break;
        case 'price': valA = a.price; valB = b.price; break;
        case 'stock': valA = a.stock; valB = b.stock; break;
        default: return 0;
      }
      return this.sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }

  getSortDir(column: string): string {
    return this.sortColumn === column ? this.sortDir : 'none';
  }

  get totalProducts(): number {
    return this.filteredProducts.length;
  }

  get totalValue(): number {
    return this.filteredProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
  }

  isLowStock(product: Product): boolean {
    return product.stock <= product.minStock;
  }
}
