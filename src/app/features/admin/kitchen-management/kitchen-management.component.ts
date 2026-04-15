import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { KitchenService } from '../../../core/services/kitchen.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import {
  BatchStockMovementRequest,
  KitchenReport,
  RecipeCookingAudit,
  ReportRange
} from '../../../shared/models/kitchen.model';
import { Order } from '../../../shared/models/order.model';
import { TraceabilityService } from '../../../core/services/traceability.service';
import { ReverseTraceabilityDTO } from '../../../shared/models/traceability.model';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { OrderDetailsModalComponent } from '../../general/orders/order-details-modal/order-details-modal.component';

@Component({
  selector: 'app-kitchen-management',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent, ToastComponent, BaseModalComponent, DatePipe, DecimalPipe, CurrencyPipe, AsyncPipe, OrderDetailsModalComponent],
  templateUrl: './kitchen-management.component.html',
  styleUrl: './kitchen-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KitchenManagementComponent implements OnInit {
  private kitchenService = inject(KitchenService);
  private recipeService = inject(RecipeService);
  private orderService = inject(OrderService);
  private traceabilityService = inject(TraceabilityService);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);
  messageService = inject(MessageService);

  activeTab: 'history' | 'reports' = 'history';

  audits: RecipeCookingAudit[] = [];
  filteredAudits: RecipeCookingAudit[] = [];
  loadingHistory = false;
  currentPage = 0;
  pageSize = 20;
  totalPages = 0;
  totalElements = 0;

  searchTerm = '';
  private searchTerm$ = new Subject<string>();
  recipeIdFilter = '';
  userIdFilter = '';
  startDate = '';
  endDate = '';

  // Sorting state for History table
  sortColumnHistory = 'cookingDate';
  sortDirHistory: 'asc' | 'desc' = 'desc';
  sortInteractedHistory = false;

  readonly reportRanges: ReportRange[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL_TIME', 'CUSTOM'];
  reportRange: ReportRange = 'MONTHLY';
  reportStartDate = '';
  reportEndDate = '';
  report: KitchenReport | null = null;
  loadingReport = false;

  // Mobile detail modal state for History
  showMobileModal = false;
  selectedAuditForMobile: RecipeCookingAudit | null = null;

  // Traceability modal state
  showTraceabilityModal = false;
  loadingTraceability = false;
  traceData: ReverseTraceabilityDTO | null = null;
  showOrderDetailsModal = false;
  selectedOrder: Order | null = null;

  ngOnInit(): void {
    this.loadHistory();
    
    // Configurar debounce para búsqueda - esperar 400ms sin cambios
    this.searchTerm$
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.performSearch();
      });
  }

  switchTab(tab: 'history' | 'reports'): void {
    this.activeTab = tab;
    if (tab === 'reports' && !this.report) {
      this.loadReport();
    }
    this.cdr.markForCheck();
  }

  loadHistory(page = 0): void {
    this.loadingHistory = true;
    // Removed array clear to prevent layout shift during pagination/sorting
    this.currentPage = page;
    this.cdr.detectChanges();

    const backendCols: Record<string, string> = {
      'recipeName': 'recipe.name',
      'userName': 'user.name'
    };
    const backendSortCol = backendCols[this.sortColumnHistory] || this.sortColumnHistory;
    const sortParam = `${backendSortCol},${this.sortDirHistory}`;

    this.kitchenService.getCookingAudits(this.currentPage, this.pageSize, sortParam)
      .pipe(finalize(() => {
        this.loadingHistory = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (pageData) => {
          this.audits = pageData.content;
          this.filteredAudits = [...pageData.content];
          this.totalElements = pageData.totalElements;
          this.totalPages = pageData.totalPages;
          this.applyHistorySorting();
          this.cdr.markForCheck();
        },
        error: () => {
          this.messageService.showError('No se pudo cargar el historial de cocina');
        }
      });
  }

  applyServerFilters(): void {
    const recipeId = Number(this.recipeIdFilter);
    const userId = Number(this.userIdFilter);
    const hasRecipeFilter = Number.isInteger(recipeId) && recipeId > 0;
    const hasUserFilter = Number.isInteger(userId) && userId > 0;
    const hasDateRange = this.startDate.length > 0 && this.endDate.length > 0;
    const hasSearchTerm = this.searchTerm.trim().length > 0;

    this.loadingHistory = true;
    this.cdr.markForCheck();

    // Determinar cuáles filtros están activos
    const activeFilters: string[] = [];
    if (hasRecipeFilter) activeFilters.push('recipe');
    if (hasUserFilter) activeFilters.push('user');
    if (hasDateRange) activeFilters.push('dateRange');
    if (hasSearchTerm) activeFilters.push('search');

    // Si no hay filtros activos, cargar todo
    if (activeFilters.length === 0) {
      this.loadHistory(0);
      return;
    }

    // Aplicar el primer filtro disponible
    let filterObservable: Observable<RecipeCookingAudit[]>;

    if (hasSearchTerm) {
      // Búsqueda por nombre tiene prioridad
      filterObservable = this.kitchenService.searchCookingAuditsByName(this.searchTerm);
    } else if (hasRecipeFilter) {
      filterObservable = this.kitchenService.getCookingAuditsByRecipe(recipeId);
    } else if (hasUserFilter) {
      filterObservable = this.kitchenService.getCookingAuditsByUser(userId);
    } else {
      // hasDateRange es true
      const start = `${this.startDate}T00:00:00`;
      const end = `${this.endDate}T23:59:59`;
      filterObservable = this.kitchenService.getCookingAuditsByDateRange(start, end);
    }

    filterObservable
      .pipe(finalize(() => {
        this.loadingHistory = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (audits) => {
          // Aplicar filtros adicionales en cliente si hay múltiples filtros
          let filtered = [...audits];

          if (activeFilters.length > 1) {
            if (hasRecipeFilter && !activeFilters.includes('recipe') === false) {
              filtered = filtered.filter(a => a.recipeId === recipeId);
            }
            if (hasUserFilter && !activeFilters.includes('user') === false) {
              filtered = filtered.filter(a => a.userId === userId);
            }
            if (hasDateRange && !activeFilters.includes('dateRange') === false) {
              const startTime = new Date(`${this.startDate}T00:00:00`).getTime();
              const endTime = new Date(`${this.endDate}T23:59:59`).getTime();
              const auditTime = new Date(audits[0]?.cookingDate || '').getTime();
              filtered = filtered.filter(a => {
                const time = new Date(a.cookingDate).getTime();
                return time >= startTime && time <= endTime;
              });
            }
          }

          this.setFilteredHistory(filtered);
        },
        error: () => {
          const filterName = activeFilters[0];
          const errorMessages: Record<string, string> = {
            'recipe': 'No se pudo filtrar por receta',
            'user': 'No se pudo filtrar por usuario',
            'dateRange': 'No se pudo filtrar por rango de fechas',
            'search': 'No se pudo buscar en el historial'
          };
          this.messageService.showError(errorMessages[filterName] || 'No se pudo aplicar los filtros');
        }
      });
  }

  clearHistoryFilters(): void {
    this.searchTerm = '';
    this.recipeIdFilter = '';
    this.userIdFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.loadHistory(0);
  }

  applySearchFilter(): void {
    // Emitir el término de búsqueda al Subject
    // El debounce se encargará de esperar 400ms sin cambios
    this.searchTerm$.next(this.searchTerm);
  }

  private performSearch(): void {
    if (!this.searchTerm.trim()) {
      // Si la búsqueda está vacía, cargar todos los audits nuevamente
      this.loadHistory(0);
      return;
    }

    // Check if other filters are active
    const hasOtherFilters = this.recipeIdFilter || this.userIdFilter || 
                           (this.startDate && this.endDate);

    if (hasOtherFilters) {
      // Delegate to applyServerFilters for multi-filter support
      this.applyServerFilters();
      return;
    }

    // Use search endpoint directly
    this.loadingHistory = true;
    this.kitchenService.searchCookingAuditsByName(this.searchTerm).subscribe({
      next: (response) => {
        this.audits = response.length > 0 ? response : [];
        this.setFilteredHistory(this.audits);
        this.loadingHistory = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('No se pudo buscar en el historial');
        this.loadingHistory = false;
      }
    });
  }

  changePage(delta: number): void {
    const newPage = this.currentPage + delta;
    if (newPage >= 0 && newPage < this.totalPages) {
      this.scrollService.scrollToTop();
      this.loadHistory(newPage);
    }
  }

  // Mobile detail modal operations
  openMobileModal(audit: RecipeCookingAudit): void {
    this.selectedAuditForMobile = audit;
    this.showMobileModal = true;
    
    // Cargar trazabilidad para el modal móvil también
    this.loadingTraceability = true;
    this.traceData = null;
    this.cdr.markForCheck();

    this.traceabilityService.getReverseTraceability(audit.id)
      .pipe(finalize(() => {
        this.loadingTraceability = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (data: any) => {
          this.traceData = data as ReverseTraceabilityDTO;
        },
        error: () => {
          console.error('Error loading traceability for mobile modal');
          this.loadingTraceability = false;
          this.cdr.markForCheck();
        }
      });
  }

  closeMobileModal(): void {
    this.showMobileModal = false;
    this.selectedAuditForMobile = null;
    this.traceData = null; // Limpiar datos de trazabilidad
    this.cdr.markForCheck();
  }

  hasActiveHistoryFilters(): boolean {
    return this.searchTerm.trim().length > 0
      || String(this.recipeIdFilter).trim().length > 0
      || String(this.userIdFilter).trim().length > 0
      || this.startDate.length > 0
      || this.endDate.length > 0;
  }

  onSortHistoryChange(column: string): void {
    this.sortInteractedHistory = true;
    if (this.sortColumnHistory === column) {
      this.sortDirHistory = this.sortDirHistory === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumnHistory = column;
      this.sortDirHistory = column === 'cookingDate' || column === 'quantityCooked' ? 'desc' : 'asc';
    }
    if (this.hasActiveHistoryFilters()) {
      this.applyHistorySorting();
    } else {
      this.loadHistory(0);
    }
  }

  getSortHistoryDir(column: string): string {
    if (!this.sortInteractedHistory && this.sortColumnHistory !== column) return 'none';
    return this.sortColumnHistory === column ? this.sortDirHistory : 'none';
  }

  private applyHistorySorting(): void {
    if (!this.filteredAudits || this.filteredAudits.length === 0) return;
    
    const factor = this.sortDirHistory === 'asc' ? 1 : -1;
    this.filteredAudits.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (this.sortColumnHistory) {
        case 'cookingDate':
          valA = new Date(a.cookingDate).getTime();
          valB = new Date(b.cookingDate).getTime();
          return (valA - valB) * factor;
        case 'recipeName':
          valA = a.recipeName?.toLowerCase() || '';
          valB = b.recipeName?.toLowerCase() || '';
          return valA.localeCompare(valB) * factor;
        case 'userName':
          valA = a.userName?.toLowerCase() || '';
          valB = b.userName?.toLowerCase() || '';
          return valA.localeCompare(valB) * factor;
        case 'quantityCooked':
          valA = a.quantityCooked || 0;
          valB = b.quantityCooked || 0;
          return (valA - valB) * factor;
        default:
          return 0;
      }
    });
    this.cdr.detectChanges();
  }

  async revertAudit(audit: RecipeCookingAudit): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Revertir cocinado',
      `Se revertirá el cocinado de la receta "${audit.recipeName}" y se devolverá stock de los ingredientes a sus lotes originales.`
    );

    if (!confirmed) {
      return;
    }

    this.loadingHistory = true;
    this.cdr.markForCheck();

    this.recipeService.revertCooking(audit.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Audit reverted successfully');
        this.loadHistory(this.currentPage);
      },
      error: (err) => {
        const msg = err.error?.message || err.error || 'Error al revertir el cocinado';
        this.messageService.showError(msg);
        this.loadingHistory = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadReport(): void {
    if (this.reportRange === 'CUSTOM' && (!this.reportStartDate || !this.reportEndDate)) {
      // No mostramos warning automáticamente al cambiar el selector para no molestar al usuario si aún no ha puesto fechas
      return;
    }

    console.log('Loading report with range:', this.reportRange, 'start:', this.reportStartDate, 'end:', this.reportEndDate);
    this.loadingReport = true;
    this.cdr.markForCheck();

    this.kitchenService.getKitchenReport(this.reportRange, this.reportStartDate, this.reportEndDate)
      .pipe(finalize(() => {
        console.log('Report load finalized');
        this.loadingReport = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (report) => {
          console.log('Report received:', report);
          if (report && report.topRecipes) {
            // Sort by quantity as priority
            report.topRecipes.sort((a, b) => b.totalQuantityCooked - a.totalQuantityCooked);
          }
          this.report = report;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading report:', error);
          this.messageService.showError('No se pudo generar el informe de cocina');
        }
      });
  }

  async downloadReportPdf(): Promise<void> {
    if (this.reportRange === 'CUSTOM' && (!this.reportStartDate || !this.reportEndDate)) {
      this.messageService.showWarning('Debes indicar fecha de inicio y fin para rango personalizado');
      return;
    }

    const confirmed = await this.messageService.confirm(
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.kitchenService.downloadKitchenReportPdf(this.reportRange, this.reportStartDate, this.reportEndDate)
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `reporte-cocina-${this.reportRange.toLowerCase()}.pdf`;
          anchor.click();
          window.URL.revokeObjectURL(url);
          this.messageService.showSuccess('Informe PDF descargado');
        },
        error: () => {
          this.messageService.showError('No se pudo descargar el informe PDF');
        }
      });
  }

  formatDate(date: string): string {
    if (!date) {
      return '—';
    }
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  translateRange(range: ReportRange): string {
    const translations: Record<ReportRange, string> = {
      'DAILY': 'Diario',
      'WEEKLY': 'Semanal',
      'MONTHLY': 'Mensual',
      'YEARLY': 'Anual',
      'ALL_TIME': 'Histórico',
      'CUSTOM': 'Personalizado'
    };
    return translations[range] || range;
  }

  formatReportPeriod(): string {
    if (this.reportRange === 'CUSTOM' && this.reportStartDate && this.reportEndDate) {
      const start = this.formatDateShort(this.reportStartDate);
      const end = this.formatDateShort(this.reportEndDate);
      return `${start} - ${end}`;
    }
    return this.translateRange(this.reportRange);
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateShort(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private setFilteredHistory(audits: RecipeCookingAudit[]): void {
    this.audits = [...audits];
    this.filteredAudits = [...audits];
    this.totalElements = audits.length;
    this.totalPages = 1;
    this.currentPage = 0;
    
    // Sort before applying filter and rendering
    this.applyHistorySorting();
    this.applySearchFilter();
  }

  viewTraceability(audit: RecipeCookingAudit): void {
    // Keep button behavior consistent with row click: open the same detail modal.
    this.openMobileModal(audit);
  }

  closeTraceabilityModal(): void {
    this.showTraceabilityModal = false;
    this.traceData = null;
    this.cdr.markForCheck();
  }
  
  goToOrder(orderId: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!orderId) {
      return;
    }

    this.orderService.getById(orderId).subscribe({
      next: (order) => {
        this.selectedOrder = order;
        this.showOrderDetailsModal = true;
        this.showTraceabilityModal = false;
        this.showMobileModal = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError(`No se pudo cargar la orden #${orderId}`);
      }
    });
  }

  closeOrderDetailsModal(): void {
    this.showOrderDetailsModal = false;
    this.selectedOrder = null;
    this.cdr.markForCheck();
  }
}