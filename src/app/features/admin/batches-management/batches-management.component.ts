import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductBatchService } from '../../../core/services/product-batch.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ProductBatchResponseDTO } from '../../../shared/models/product-batch.model';
import { RecipeCookingAudit } from '../../../shared/models/kitchen.model';
import { TraceabilityService } from '../../../core/services/traceability.service';
import { BatchExpirationModalComponent } from '../stock-management/batch-expiration-modal/batch-expiration-modal.component';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { MessageService } from '../../../core/services/message.service';
import { ScrollService } from '../../../core/services/scroll.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

type ManagementTab = 'all' | 'control';
type ControlSubTab = 'expiring' | 'expired';

@Component({
  selector: 'app-batches-management',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchExpirationModalComponent, BaseModalComponent],
  templateUrl: './batches-management.component.html',
  styleUrl: './batches-management.component.css'
})
export class BatchesManagementComponent implements OnInit, OnDestroy {
  private readonly logger = inject(LoggerService);
  private batchService = inject(ProductBatchService);
  private traceabilityService = inject(TraceabilityService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private scrollService = inject(ScrollService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private destroy$ = new Subject<void>();

  // Tabs
  activeTab: ManagementTab = 'all';
  batchesSubTab: ControlSubTab = 'expiring';

  // State
  batches: ProductBatchResponseDTO[] = [];
  controlBatches: ProductBatchResponseDTO[] = [];
  loading = false;
  
  // Filters & Search
  searchTerm = '';
  private searchSubject = new Subject<string>();
  statusFilter: 'all' | 'active' | 'depleted' | 'expired' = 'active';
  expiringDays = 7;

  // Pagination
  currentPage = 0;
  pageSize = 15;
  totalPages = 0;
  totalElements = 0;
  hasMore = true;

  // Sorting
  sortColumn = 'expirationDate';
  sortDir: 'asc' | 'desc' = 'asc';

  // Counters
  expiredCount = 0;
  expiringSoonCount = 0;

  // Modal State
  showViewModal = false;
  showEditModal = false;
  selectedBatch: ProductBatchResponseDTO | null = null;
  batchCookings: RecipeCookingAudit[] = [];
  loadingCookings = false;

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadBatches(0);
    });

    this.loadBatches();
    this.updateCounters();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('batch') || domains.includes('product')) {
          this.refreshData();
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateCounters(): void {
    // Podríamos optimizar esto con un endpoint de stats si creciera mucho
    this.batchService.getExpiredBatches().subscribe(list => this.expiredCount = list.length);
    this.batchService.getExpiringBatches(7).subscribe(list => this.expiringSoonCount = list.length);
  }

  loadBatches(page: number = 0): void {
    if (this.loading) return;
    
    this.currentPage = page;
    this.loading = true;
    this.cdr.detectChanges();

    const sortParam = `${this.sortColumn},${this.sortDir}`;
    let depleted: boolean | undefined = undefined;
    
    if (this.statusFilter === 'active') depleted = false;
    else if (this.statusFilter === 'depleted') depleted = true;

    this.batchService.getAllBatches(this.currentPage, this.pageSize, sortParam, this.searchTerm, depleted)
      .subscribe({
        next: (res) => {
          let content = res.content || [];
          if (this.statusFilter === 'expired') {
            content = content.filter((b: any) => b.expired);
          }
          
          this.batches = content;
          
          this.totalPages = res.totalPages;
          this.totalElements = res.totalElements;
          this.hasMore = this.currentPage < this.totalPages - 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.messageService.showError("Error al cargar lotes");
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadControlBatches(page: number = 0): void {
    if (this.loading) return;
    
    this.currentPage = page;
    this.loading = true;
    this.cdr.detectChanges();

    const sortParam = `${this.sortColumn},${this.sortDir}`;

    const obs = this.batchesSubTab === 'expiring' 
      ? this.batchService.getExpiringBatches(this.expiringDays)
      : this.batchService.getExpiredBatches();

    obs.subscribe({
      next: (list) => {
        // Paginación manual si el API no la da para mantener el estilo
        this.totalElements = list.length;
        this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        
        const start = this.currentPage * this.pageSize;
        const end = start + this.pageSize;
        this.controlBatches = list.slice(start, end);
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.messageService.showError("Error al cargar control de caducidad");
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  changePage(delta: number): void {
    const next = this.currentPage + delta;
    if (next >= 0 && next < this.totalPages) {
      if (this.activeTab === 'all') {
        this.loadBatches(next);
      } else {
        this.loadControlBatches(next);
      }
      this.scrollService.scrollToTop();
    }
  }

  switchTab(tab: ManagementTab): void {
    this.activeTab = tab;
    if (tab === 'all') this.loadBatches(0);
    else this.loadControlBatches(0);
  }

  setSubTab(subTab: ControlSubTab): void {
    this.batchesSubTab = subTab;
    this.loadControlBatches(0);
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'active';
    this.loadBatches(0);
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.loadBatches(this.currentPage);
  }

  getSortDir(column: string): string {
    return this.sortColumn === column ? this.sortDir : '';
  }

  openViewModal(batch: ProductBatchResponseDTO): void {
    this.selectedBatch = batch;
    this.showViewModal = true;
    this.loadingCookings = true;
    this.batchCookings = [];
    
    if (!batch || !batch.id) {
      this.logger.warn('Batch is undefined or has no id');
      this.loadingCookings = false;
      return;
    }

    this.traceabilityService.getBatchCookings(batch.id).subscribe({
      next: (cookings) => {
        this.batchCookings = cookings || [];
        this.loadingCookings = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logger.error('[BatchesManagement] Traceability request failed:', err);
        this.loadingCookings = false;
        this.cdr.detectChanges();
      }
    });
  }

  openEditModalFromView(): void {
    this.showEditModal = true;
  }

  // Called from individual rows instead of openEditModal
  onRowClick(batch: ProductBatchResponseDTO): void {
    this.openViewModal(batch);
  }

  onViewModalClosed(): void {
    this.showViewModal = false;
    this.selectedBatch = null;
    this.batchCookings = [];
  }

  onModalClosed(): void {
    this.showEditModal = false;
    // We intentionally don't clear selectedBatch here if view modal is still open.
  }

  onSaveBatch(data: { expirationDate: string; reason?: string; batchCode?: string }): void {
    if (this.selectedBatch) {
      this.batchService.updateBatchExpiration(this.selectedBatch.id, data).subscribe({
        next: () => {
          this.messageService.showSuccess("Caducidad actualizada correctamente");
          this.showEditModal = false;
          this.refreshData();
        },
        error: (err) => this.messageService.showError('Error al actualizar fecha')
      });
    }
  }

  async onWithdraw(batch: ProductBatchResponseDTO): Promise<void> {
    const isExpired = batch.expired;
    const actionName = isExpired ? 'Retirar Lote Caducado' : 'Desechar Lote';
    const warningText = isExpired 
      ? `¿Estás seguro de que deseas retirar el lote #${batch.id} de ${batch.productName} por caducidad? Se registrará como pérdida (merma).`
      : `¿Estás seguro de que deseas desechar el lote #${batch.id} de ${batch.productName}? Esta acción es irreversible y se registrará como merma.`;

    const confirmed = await this.messageService.confirm(
      actionName,
      warningText
    );

    if (confirmed) {
      this.batchService.withdrawBatch(batch.id).subscribe({
        next: () => {
          this.messageService.showSuccess("Lote desechado correctamente");
          this.refreshData();
        },
        error: () => this.messageService.showError("Error al desechar el lote")
      });
    }
  }

  refreshData(): void {
    if (this.activeTab === 'all') this.loadBatches(this.currentPage);
    else this.loadControlBatches();
    this.updateCounters();
  }

  getStatusText(batch: ProductBatchResponseDTO): string {
    if (batch.depleted) return 'Agotado';
    if (batch.expired) return 'Caducado';
    if (batch.daysUntilExpiration <= 7) return 'Próximo';
    return 'Activo';
  }
}
