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
    
    this.loading = true;
    this.productService.searchByName(this.searchTerm).subscribe({
      next: (products) => {
        this.products = products;
        this.totalElements = products.length;
        this.totalPages = 1;
        this.page = 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error searching products:', err);
        this.messageService.showError('Error al buscar productos');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
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

    // Validate and sanitize data
    const allowedUnits = ['KG', 'G', 'L', 'ML', 'UND'];
    let unit = this.selectedProduct.unit || 'UND';
    if (!allowedUnits.includes(unit)) {
        unit = 'UND';
    }

    // Ensure price is valid
    let price = this.selectedProduct.unitPrice;
    if (!price || price < 0.01) {
        price = 0.01;
    }

    const productRequest: ProductRequest = {
      name: this.selectedProduct.name,
      productCode: this.selectedProduct.productCode || `PROD-${this.selectedProduct.id}`,
      type: this.selectedProduct.type || 'Ingrediente',
      unitPrice: price,
      price: price, // legacy?
      currentStock: this.selectedProduct.currentStock || 0,
      stock: this.selectedProduct.currentStock || 0, // legacy?
      minStock: this.selectedProduct.minStock || 0,
      unit: unit,
      supplierId: this.selectedProduct.supplier?.id,
      active: false
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

  get totalValue(): number {
    return this.products.reduce((sum, p) => sum + (p.unitPrice * p.currentStock), 0);
  }

  isLowStock(product: Product): boolean {
    return product.currentStock <= (product.minStock || 0);
  }
}