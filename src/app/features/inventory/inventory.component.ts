import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { MessageService } from '../../core/services/message.service';
import { SupplierService } from '../../core/services/supplier.service';
import { Product, ProductRequest } from '../../shared/models/product.model';
import { Supplier } from '../../shared/models/supplier.model';
import { ProductFormComponent } from './components/product-form/product-form.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  private productService = inject(ProductService);
  private supplierService = inject(SupplierService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  // Listas de datos
  products: Product[] = [];
  suppliers: Supplier[] = [];

  // Estado de la vista
  loading = false;
  searchTerm = '';
  showForm = false;
  selectedProduct: Product | null = null;
  // Previously: isEditing, currentProductId (now derived from selectedProduct)

  // Pagination State
  page = 0;
  size = 20;
  totalElements = 0;
  totalPages = 0;

  // Sorting
  sortColumn = 'id';
  sortDir: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    this.loadProducts();
    this.loadSuppliers();
  }

  loadProducts(): void {
    this.loading = true;
    const sortParam = `${this.sortColumn},${this.sortDir}`;
    
    this.productService.getAll(this.page, this.size, sortParam).subscribe({
      next: (page) => {
        this.products = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading products:', err);
        this.messageService.showError('Error al cargar productos');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
    this.loadProducts();
  }

  onSizeChange(event: any): void {
    this.size = Number(event.target.value);
    this.page = 0; // Reset to first page
    this.loadProducts();
  }

  onSortChange(column: string): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.loadProducts();
  }

  loadSuppliers(): void {
    this.supplierService.getAll(0, 100).subscribe({
      next: (page) => {
        this.suppliers = page.content;
      },
      error: () => console.error('Error cargando proveedores')
    });
  }

  onSearch(): void {
     if (!this.searchTerm) {
      this.loadProducts();
      return;
     }
     this.loadProducts();
  }

  showAll(): void {
    this.searchTerm = '';
    this.page = 0;
    this.loadProducts();
  }

  checkStock(): void {
    const lowStockProducts = this.products.filter(p => this.isLowStock(p));
    if (lowStockProducts.length === 0) {
      this.messageService.showSuccess('Todos los productos tienen stock suficiente');
    } else {
      this.messageService.showWarning(`${lowStockProducts.length} producto(s) con stock bajo`);
    }
  }

  // --- LÓGICA DEL FORMULARIO ---

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.selectedProduct = null;
    }
  }

  editProduct(product: Product): void {
    this.selectedProduct = product;
    this.showForm = true;
  }

  onCancelForm(): void {
    this.showForm = false;
    this.selectedProduct = null;
  }

  onSaveProduct(productData: ProductRequest): void {
    if (this.selectedProduct) {
      // UPDATE
      this.productService.update(this.selectedProduct.id, productData).subscribe({
        next: () => {
          this.messageService.showSuccess('Producto actualizado correctamente');
          this.finalizeSubmit();
        },
        error: (err) => {
          console.error('Error updating product:', err);
          const errorMessage = err.error?.message || err.message || 'Error al actualizar producto';
          this.messageService.showError(errorMessage);
        }
      });
    } else {
      // CREATE
      this.productService.create(productData).subscribe({
        next: () => {
          this.messageService.showSuccess('Producto creado correctamente');
          this.finalizeSubmit();
        },
        error: (err) => {
          console.error('Error creating product:', err);
          const errorMessage = err.error?.message || err.message || 'Error al crear producto';
          this.messageService.showError(errorMessage);
        }
      });
    }
  }

  onDeleteProduct(): void {
    if (this.selectedProduct) {
      this.productService.delete(this.selectedProduct.id).subscribe({
        next: () => {
          this.messageService.showSuccess('Producto eliminado correctamente');
          this.finalizeSubmit();
        },
        error: (err) => {
          console.error('Error deleting product:', err);
          const errorMessage = err.error?.message || err.message || 'Error al eliminar producto';

          // Check if error is due to integrity constraint (inventory movements or recipes)
          if (err.status === 400 && (errorMessage.includes('movimientos de inventario') || errorMessage.includes('recetas'))) {
            if (confirm('No se puede eliminar el producto porque tiene historial o está en uso en recetas. ¿Desea desactivarlo en su lugar?')) {
              this.softDeleteProduct();
            }
          } else {
            this.messageService.showError(errorMessage);
          }
        }
      });
    }
  }

  private softDeleteProduct(): void {
    if (!this.selectedProduct) return;

    // Validate and sanitize data before sending update
    // Ensure unit is valid, default to 'UND' if not in allowed list or missing
    const allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
    let unit = this.selectedProduct.unit || 'UND';
    if (!allowedUnits.includes(unit)) {
        unit = 'UND';
    }

    // Ensure price is valid (> 0), default to 0.01 if invalid
    let price = this.selectedProduct.price;
    if (!price || price < 0.01) {
        price = 0.01;
    }

    const productRequest: ProductRequest = {
      name: this.selectedProduct.name,
      productCode: this.selectedProduct.productCode || `PROD-${this.selectedProduct.id}`, // Ensure productCode exists
      type: this.selectedProduct.type || 'Ingrediente',
      price: price,
      unitPrice: price, // Required by backend
      stock: this.selectedProduct.stock || 0,
      currentStock: this.selectedProduct.stock || 0, // Required by backend
      minStock: this.selectedProduct.minStock || 0,
      unit: unit,
      supplierId: this.selectedProduct.supplier?.id,
      active: false // Soft delete
    };

    this.productService.update(this.selectedProduct.id, productRequest).subscribe({
      next: () => {
        this.messageService.showSuccess('Producto desactivado correctamente');
        this.finalizeSubmit();
      },
      error: (err) => {
        console.error('Error deactivating product:', err);
        const errorMessage = err.error?.message || err.message || 'Error al desactivar el producto';
        this.messageService.showError(errorMessage);
      }
    });
  }

  private finalizeSubmit(): void {
    this.showForm = false;
    this.selectedProduct = null;
    this.loadProducts();
  }

  // --- UTILIDADES ---

  getSortDir(column: string): string {
    return this.sortColumn === column ? this.sortDir : 'none';
  }

  get totalProducts(): number {
    return this.totalElements;
  }

  isLowStock(product: Product): boolean {
    return product.stock <= product.minStock;
  }
}