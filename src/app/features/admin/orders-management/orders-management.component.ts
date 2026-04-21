import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { OrderAuditService } from '../../../core/services/order-audit.service';
import { KitchenService } from '../../../core/services/kitchen.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { AuthService } from '../../../core/services/auth.service';
import { OrderReviewLockStateService } from '../../../core/services/order-review-lock-state.service';
import { Order, OrderStatus, OrderReviewLockStatus } from '../../../shared/models/order.model';
import { OrderAudit } from '../../../shared/models/order-audit.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { User } from '../../../shared/models/user.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';
import { OrderDetailsAdminModalComponent } from './order-details-admin-modal/order-details-admin-modal.component';
import { OrderStatusChangeAdminModalComponent } from './order-status-change-admin-modal/order-status-change-admin-modal.component';

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'CREATED', label: 'Creada' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'REVIEW', label: 'Revisión' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'INCOMPLETE', label: 'Incompleta' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

@Component({
  selector: 'app-orders-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseModalComponent,
    OrderDetailsAdminModalComponent,
    OrderStatusChangeAdminModalComponent
  ],
  templateUrl: './orders-management.component.html',
  styleUrl: './orders-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersManagementComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private orderAuditService = inject(OrderAuditService);
  private kitchenService = inject(KitchenService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private authService = inject(AuthService);
  private orderReviewLockStateService = inject(OrderReviewLockStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  messageService = inject(MessageService);

  // ── Tab state ──
  activeTab: 'orders' | 'audits' = 'orders';

  // ── Status options exposed to template ──
  readonly allStatuses = ALL_STATUSES;

  // ── Orders state ──
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  pagedFilteredOrders: Order[] = []; // Current page of filtered orders
  loading = true;
  orderSearchTerm = '';
  orderStartDate = '';
  orderEndDate = '';
  orderStatusFilter = '';
  orderUserFilter: number | '' = '';
  orderSupplierFilter: number | '' = '';
  currentOrderPage = 0;
  totalOrdersCount = 0;
  totalOrdersPrice = 0;
  totalOrderPages = 0;
  orderPageSize = 20;

  // ── Dropdown lists ──
  suppliersList: Supplier[] = [];
  usersList: User[] = [];

  // ── Audits state ──
  audits: OrderAudit[] = [];
  filteredAudits: OrderAudit[] = [];
  filteredAuditOrders: Order[] = [];
  loadingAudits = false;
  auditsLoaded = false;
  auditSearchTerm = '';
  auditStartDate = '';
  auditEndDate = '';
  currentAuditPage = 0;
  totalAuditsCount = 0;
  totalAuditPages = 0;
  auditPageSize = 20;

  selectedAudit: OrderAudit | null = null;
  selectedOrderHistory: OrderAudit[] = []; // Full history for the selected order in the audit modal
  showAuditDetailModal = false;
  loadingAuditHistory = false;
  auditTab: 'changes' | 'history' = 'changes';

  // ── Modals State ──
  selectedOrder: Order | null = null;
  showOrderDetailModal = false;

  showChangeStatusModal = false;
  orderForStatusChange: Order | null = null;

  private auditCache: Map<string, any> = new Map();
  private pendingOrderIdFromQuery: number | null = null;
  private hasProcessedOrderQueryParam = false;
  private orderSearchSubject = new Subject<string>();
  private auditSearchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private lockStatusSubscription?: Subscription;
  private heartbeatTimerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.orderSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(() => {
      this.applyOrderFilters();
    });

    this.auditSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(() => {
      this.applyAuditOrderFilters();
    });

    this.consumeOrderIdFromQuery();
    this.loadAllOrders();
    this.loadSuppliers();
    this.loadUsers();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (!domains.includes('order')) {
          return;
        }

        this.loadAllOrders();

        if (this.activeTab === 'audits') {
          this.auditCache.clear();
          this.auditsLoaded = false;
          this.loadAudits(this.currentAuditPage);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.orderSearchSubject.complete();
    this.auditSearchSubject.complete();
  }

  private consumeOrderIdFromQuery(): void {
    const rawOrderId = this.route.snapshot.queryParamMap.get('orderId');
    const orderId = rawOrderId ? Number(rawOrderId) : NaN;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return;
    }

    this.pendingOrderIdFromQuery = orderId;
    this.hasProcessedOrderQueryParam = false;
  }


  // ── Tab switching ──
  switchTab(tab: 'orders' | 'audits'): void {
    this.activeTab = tab;
    if (tab === 'audits') {
      this.loadAudits();
    }
    this.cdr.detectChanges();
  }

  // ── Orders ──
  // Server-side filters: startDate, endDate, userId, supplierId
  // Client-side filters: orderSearchTerm, orderStatusFilter
  loadAllOrders(): void {
    this.loading = true;
    this.currentOrderPage = 0;
    this.cdr.markForCheck();

    const filters: {
      startDate?: string;
      endDate?: string;
      userId?: number;
      supplierId?: number;
      size: number;
    } = { size: 50 };

    if (this.orderStartDate)
      filters.startDate = this.orderStartDate + 'T00:00:00';
    if (this.orderEndDate)
      filters.endDate = this.orderEndDate + 'T23:59:59';
    if (this.orderUserFilter !== '')
      filters.userId = Number(this.orderUserFilter);
    if (this.orderSupplierFilter !== '')
      filters.supplierId = Number(this.orderSupplierFilter);

    this.orderService.search(filters).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        const normalizeOrders = (orders: any[]): Order[] => orders.map(order => this.normalizeOrderPayload(order));

        if (Array.isArray(response)) {
          this.orders = normalizeOrders(response);
        } else if (response?.orders) {
          this.orders = normalizeOrders(response.orders);
        } else if (response?.content) {
          this.orders = normalizeOrders(response.content);
        } else {
          this.orders = [];
        }
        this.filteredAuditOrders = this.orders.filter(o => o.status === 'CONFIRMED');
        this.applyOrderFilters();
        this.tryOpenOrderFromQuery();
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar las órdenes');
      }
    });
  }

  changeOrderPage(delta: number): void {
    const newPage = this.currentOrderPage + delta;
    if (newPage >= 0 && newPage < this.totalOrderPages) {
      this.currentOrderPage = newPage;
      this.paginateOrders();
      this.cdr.markForCheck();
    }
  }

  private paginateOrders(): void {
    const start = this.currentOrderPage * this.orderPageSize;
    const end = start + this.orderPageSize;
    this.pagedFilteredOrders = this.filteredOrders.slice(start, end);
  }

  // Client-side filtering: only text and status (server already filtered by date/user/supplier)
  applyOrderFilters(): void {
    let result = [...this.orders];

    const term = this.orderSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        o.id.toString().includes(term) ||
        (o.userName && o.userName.toLowerCase().includes(term))
      );
    }

    if (this.orderStatusFilter) {
      result = result.filter(o => o.status === this.orderStatusFilter);
    }

    this.filteredOrders = result;
    this.totalOrdersCount = result.length;
    this.totalOrdersPrice = result.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    this.totalOrderPages = Math.ceil(this.totalOrdersCount / this.orderPageSize);

    this.currentOrderPage = 0;
    this.paginateOrders();
    this.cdr.detectChanges();
  }

  // Called when a server-side filter changes (date, user, supplier) → new API call
  onServerFilterChange(): void {
    this.loadAllOrders();
  }

  // Called when a client-side filter changes (text, status) → no API call
  onClientFilterChange(): void {
    this.applyOrderFilters();
  }

  // Keep for backward compat (HTML uses it for text search)
  onOrderSearch(): void { this.orderSearchSubject.next(this.orderSearchTerm); }

  clearOrderFilters(): void {
    this.orderSearchTerm = '';
    this.orderStartDate = '';
    this.orderEndDate = '';
    this.orderStatusFilter = '';
    this.orderUserFilter = '';
    this.orderSupplierFilter = '';
    this.loadAllOrders();
  }

  hasActiveOrderFilters(): boolean {
    return this.orderSearchTerm.trim().length > 0
      || this.orderStartDate.length > 0
      || this.orderEndDate.length > 0
      || this.orderStatusFilter !== ''
      || this.orderUserFilter !== ''
      || this.orderSupplierFilter !== '';
  }

  // ── Dropdown loaders ──
  private loadSuppliers(): void {
    this.supplierService.getAll(0, 50, 'name,asc').subscribe({
      next: (page) => { this.suppliersList = page.content; this.cdr.markForCheck(); },
      error: () => { }
    });
  }

  private loadUsers(): void {
    this.userService.search('', 0, 50).subscribe({
      next: (page) => { this.usersList = page.content || []; this.cdr.markForCheck(); },
      error: () => { }
    });
  }

  // ── Change Status Modal ──
  openChangeStatusModal(order: Order): void {
    this.orderForStatusChange = order;
    this.showChangeStatusModal = true;
    this.cdr.markForCheck();
  }

  closeChangeStatusModal(): void {
    this.showChangeStatusModal = false;
    this.orderForStatusChange = null;
    this.cdr.markForCheck();
  }

  onChangeStatusOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeChangeStatusModal();
    }
  }

  confirmStatusChange(updatedOrder: Order): void {
    const idx = this.orders.findIndex(o => o.id === updatedOrder.id);
    if (idx !== -1) {
      this.orders[idx] = updatedOrder;
    }
    
    // If detail modal is open for this order, update it too
    if (this.selectedOrder && this.selectedOrder.id === updatedOrder.id) {
      this.selectedOrder = updatedOrder;
    }

    this.applyOrderFilters();
    this.filteredAuditOrders = this.orders.filter(o => o.status === 'CONFIRMED');

    this.auditCache.clear();
    this.auditsLoaded = false;
    this.closeChangeStatusModal();
    this.cdr.markForCheck();
  }

  // ── Audits ──
  loadAudits(page = 0): void {
    this.currentAuditPage = page;
    const cacheKey = this.auditStartDate && this.auditEndDate
      ? `date:${this.auditStartDate}-${this.auditEndDate}-page:${page}`
      : `all-page:${page}`;

    if (this.auditCache.has(cacheKey)) {
      const cached = this.auditCache.get(cacheKey);
      this.audits = cached.content;
      this.totalAuditsCount = cached.totalElements;
      this.totalAuditPages = cached.totalPages;
      this.applyAuditOrderFilters();
      this.auditsLoaded = true;
      this.cdr.detectChanges();
      return;
    }

    this.loadingAudits = true;
    this.auditsLoaded = false;
    this.cdr.detectChanges();

    const source$ = (this.auditStartDate && this.auditEndDate)
      ? this.orderAuditService.getByDateRange(
        this.auditStartDate + 'T00:00:00',
        this.auditEndDate + 'T23:59:59',
        page, this.auditPageSize, ['auditDate,desc']
      )
      : this.orderAuditService.getAll(page, this.auditPageSize, ['auditDate,desc']);

    source$.pipe(
      finalize(() => { this.loadingAudits = false; this.auditsLoaded = true; this.cdr.detectChanges(); })
    ).subscribe({
      next: (response) => {
        let auditsArray: OrderAudit[] = [];
        if (Array.isArray(response)) {
          auditsArray = response;
          this.totalAuditsCount = auditsArray.length;
          this.totalAuditPages = 1;
        } else if (response?.content) {
          auditsArray = response.content;
          this.totalAuditsCount = response.totalElements;
          this.totalAuditPages = response.totalPages;
        }

        auditsArray.forEach(a => {
          if (a.orderId == null) {
            try {
              // Try different variations of orderId
              const raw = a as any;
              a.orderId = raw.orderId ?? raw.order_id ?? raw.id_order;

              if (a.orderId == null) {
                if (a.newState) {
                  const parsed = JSON.parse(a.newState);
                  a.orderId = parsed.id ?? parsed.orderId ?? parsed.order_id ?? parsed.id_order;
                } else if (a.previousState) {
                  const parsed = JSON.parse(a.previousState);
                  a.orderId = parsed.id ?? parsed.orderId ?? parsed.order_id ?? parsed.id_order;
                }
              }
            } catch (e) { }
          }
        });

        this.audits = auditsArray;
        this.auditCache.set(cacheKey, { content: auditsArray, totalElements: this.totalAuditsCount, totalPages: this.totalAuditPages });
        this.applyAuditOrderFilters();
        this.cdr.detectChanges();
      },
      error: () => { this.messageService.showError('Error al cargar las auditorías'); }
    });
  }

  onAuditSearch(): void { this.auditSearchSubject.next(this.auditSearchTerm); }
  onAuditDateFilter(): void { this.applyAuditOrderFilters(); }

  applyAuditOrderFilters(): void {
    let result = [...this.audits];

    // Relaxed filter: show all audits that have an orderId
    result = result.filter(a => a.orderId != null);

    const term = this.auditSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(a =>
        (a.orderId && a.orderId.toString().includes(term)) ||
        (a.userName && a.userName.toLowerCase().includes(term)) ||
        (a.details && a.details.toLowerCase().includes(term)) ||
        (a.action && a.action.toLowerCase().includes(term))
      );
    }

    if (this.auditStartDate) {
      const from = new Date(this.auditStartDate).getTime();
      result = result.filter(a => {
        return a.auditDate ? new Date(a.auditDate).getTime() >= from : true;
      });
    }

    if (this.auditEndDate) {
      const to = new Date(this.auditEndDate).getTime() + 86400000;
      result = result.filter(a => {
        return a.auditDate ? new Date(a.auditDate).getTime() <= to : true;
      });
    }

    this.filteredAudits = result;
    this.cdr.detectChanges();
  }

  clearAuditFilters(): void {
    this.auditSearchTerm = '';
    this.auditStartDate = '';
    this.auditEndDate = '';
    this.applyAuditOrderFilters();
  }

  hasActiveAuditFilters(): boolean {
    return this.auditSearchTerm.trim().length > 0
      || this.auditStartDate.length > 0
      || this.auditEndDate.length > 0;
  }

  changeAuditPage(delta: number): void {
    const newPage = this.currentAuditPage + delta;
    if (newPage >= 0 && newPage < this.totalAuditPages) {
      this.loadAudits(newPage);
    }
  }


  // ── Audit Modal ──
  openAuditDetail(audit: OrderAudit): void {
    this.selectedAudit = audit;
    this.showAuditDetailModal = true;
    this.selectedOrderHistory = [];
    this.loadingAuditHistory = true;
    this.auditTab = 'changes'; // Reset to changes tab
    this.cdr.markForCheck();

    // Fetch full history for this order
    if (audit.orderId) {
      this.orderAuditService.getByOrderId(audit.orderId).subscribe({
        next: (response: any) => {
          const auditsArray = Array.isArray(response) ? response : (response?.content || []);
          this.selectedOrderHistory = auditsArray.sort((a: any, b: any) =>
            new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime()
          );
          this.loadingAuditHistory = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAuditHistory = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.loadingAuditHistory = false;
      this.cdr.markForCheck();
    }
  }

  getReceptionStatusLabel(order: Order): string {
    return order.receptionDate ? 'Recibido' : 'Pendiente';
  }

  getReceptionStatusClass(order: Order): string {
    return order.receptionDate ? 'status-confirmed' : 'status-pending';
  }

  closeAuditDetail(): void {
    this.showAuditDetailModal = false;
    this.selectedAudit = null;
    this.selectedOrderHistory = [];
    this.loadingAuditHistory = false;
    this.cdr.markForCheck();
  }

  // ── Order Detail Modal ──
  getReceivedQuantity(detail: any): number | null {
    const raw = detail?.quantityReceived ?? detail?.quantityRecieved ?? detail?.quantity_received;
    if (raw === undefined || raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private normalizeOrderPayload(order: any): Order {
    const details = Array.isArray(order?.details)
      ? order.details.map((detail: any) => ({
          ...detail,
          quantityReceived: this.getReceivedQuantity(detail)
        }))
      : [];

    return {
      ...order,
      details
    } as Order;
  }

  private tryOpenOrderFromQuery(): void {
    if (this.pendingOrderIdFromQuery == null || this.hasProcessedOrderQueryParam) {
      return;
    }

    this.hasProcessedOrderQueryParam = true;
    const targetOrderId = this.pendingOrderIdFromQuery;
    this.pendingOrderIdFromQuery = null;

    const existingOrder = this.orders.find(order => order.id === targetOrderId);
    if (existingOrder) {
      this.openOrderDetail(existingOrder);
      this.clearOrderIdQueryParam();
      return;
    }

    this.orderService.getById(targetOrderId).subscribe({
      next: (order) => {
        this.openOrderDetail(order);
        this.clearOrderIdQueryParam();
      },
      error: () => {
        this.messageService.showError(`No se pudo cargar la orden #${targetOrderId}`);
        this.clearOrderIdQueryParam();
      }
    });
  }

  private clearOrderIdQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { orderId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  closeOrderDetail(): void {
    this.showOrderDetailModal = false;
    this.selectedOrder = null;
    this.cdr.markForCheck();
  }

  openOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailModal = true;
    this.cdr.markForCheck();
  }

  openStatusEditorFromDetail(order: Order): void {
    this.openChangeStatusModal(order);
  }

  async revertOrder(order: Order): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Revertir orden confirmada',
      `Se revertirá la recepción de la orden #${order.id}. Esto devolverá el stock de los productos al inventario y restaurará el estado anterior del pedido.`
    );

    if (!confirmed || !order.id || !order.details) return;

    this.orderAuditService.getByOrderId(order.id).subscribe({
      next: (audits: OrderAudit[]) => {
        const sortedAudits = [...audits].sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());

        const confirmationAudit = sortedAudits.find(a => {
          try {
            const newState = typeof a.newState === 'string' ? JSON.parse(a.newState) : a.newState;
            const prevState = typeof a.previousState === 'string' ? JSON.parse(a.previousState) : a.previousState;
            const newStatus = (newState?.status || newState?.estado || '').toUpperCase();
            const prevStatus = (prevState?.status || prevState?.estado || '').toUpperCase();
            return newStatus === 'CONFIRMED' && prevStatus !== 'CONFIRMED';
          } catch { return false; }
        });

        let previousStatus: OrderStatus = 'CREATED';
        if (confirmationAudit) {
          try {
            const prevState = typeof confirmationAudit.previousState === 'string' ? JSON.parse(confirmationAudit.previousState) : confirmationAudit.previousState;
            const rawStatus = (prevState?.status || prevState?.estado || 'CREATED').toUpperCase();
            const statusMap: Record<string, OrderStatus> = {
              'CREADA': 'CREATED', 'CREADO': 'CREATED',
              'PENDIENTE': 'PENDING',
              'REVISIÓN': 'REVIEW', 'REVISION': 'REVIEW', 'EN REVISIÓN': 'REVIEW',
              'CONFIRMADA': 'CONFIRMED', 'CONFIRMADO': 'CONFIRMED',
              'INCOMPLETA': 'INCOMPLETE', 'INCOMPLETO': 'INCOMPLETE',
              'CANCELADA': 'CANCELLED', 'CANCELADO': 'CANCELLED'
            };
            previousStatus = statusMap[rawStatus] || (rawStatus as OrderStatus);
          } catch { previousStatus = 'CREATED'; }
        }

        this.proceedWithRevert(order, previousStatus);
      },
      error: () => {
        this.messageService.showWarning('No se encontró el historial del pedido. Revirtiendo al estado inicial (Creado).');
        this.proceedWithRevert(order, 'CREATED');
      }
    });
  }

  private proceedWithRevert(order: Order, previousStatus: OrderStatus): void {
    if (!order.details) return;
    const request = {
      reason: `Reversión de orden #${order.id}`,
      orderId: order.id,
      movements: order.details.map((detail: any) => ({
        productId: detail.productId,
        quantityDelta: -detail.quantity,
        movementType: 'AJUSTE' as 'AJUSTE',
        description: `Reversión automática orden #${order.id}`
      }))
    };

    this.kitchenService.revertCookingBatch(request).subscribe({
      next: (res: any) => {
        if (res.success || res.id) {
          this.messageService.showSuccess(`Orden revertida correctamente`);
          this.loadAllOrders();
        } else {
          this.messageService.showError(res.message || 'Error al revertir el stock');
        }
      },
      error: () => this.messageService.showError('Error de comunicación al revertir orden')
    });
  }

  getAuditOrderStatus(audit: OrderAudit): OrderStatus {
    const newState = this.parseAuditState(audit.newState);
    const previousState = this.parseAuditState(audit.previousState);

    const raw = this.getAuditStateValue(newState, ['status', 'estado'])
      ?? this.getAuditStateValue(previousState, ['status', 'estado'])
      ?? 'CREATED';

    const normalized = this.normalizeStatus(raw);
    const validStatuses: OrderStatus[] = ['CREATED', 'PENDING', 'REVIEW', 'CONFIRMED', 'INCOMPLETE', 'CANCELLED'];
    return validStatuses.includes(normalized as OrderStatus) ? (normalized as OrderStatus) : 'CREATED';
  }


  // ── Audit Diff Logic ──
  get hasDiffData(): boolean {
    return !!this.selectedAudit?.previousState || !!this.selectedAudit?.newState;
  }

  private parseAuditState(state: string | null | undefined): Record<string, any> {
    if (!state) return {};
    try {
      return typeof state === 'string' ? JSON.parse(state) : (state as unknown as Record<string, any>);
    } catch {
      return {};
    }
  }

  private getAuditStateValue(state: Record<string, any>, keys: string[]): any {
    for (const key of keys) {
      if (state[key] !== undefined && state[key] !== null) {
        return state[key];
      }
    }
    return null;
  }

  private normalizeStatus(status: any): string {
    if (!status) return '—';
    const raw = String(status).toUpperCase().trim();
    const map: Record<string, string> = {
      CREADA: 'CREATED',
      CREADO: 'CREATED',
      PENDIENTE: 'PENDING',
      REVISION: 'REVIEW',
      'REVISIÓN': 'REVIEW',
      CONFIRMADA: 'CONFIRMED',
      CONFIRMADO: 'CONFIRMED',
      INCOMPLETA: 'INCOMPLETE',
      INCOMPLETO: 'INCOMPLETE',
      CANCELADA: 'CANCELLED',
      CANCELADO: 'CANCELLED'
    };
    return map[raw] || raw;
  }

  private formatCurrency(value: any): string {
    if (value === undefined || value === null || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toFixed(2)} €` : '—';
  }

  private formatAuditDateValue(value: any): string {
    if (!value) return '—';
    try {
      return this.formatDate(String(value));
    } catch {
      return String(value);
    }
  }

  getDiffFields(): { label: string; prev: string; next: string; changed: boolean }[] {
    const prev = this.parseAuditState(this.selectedAudit?.previousState);
    const next = this.parseAuditState(this.selectedAudit?.newState);
    const fields: { label: string; prev: string; next: string; changed: boolean }[] = [];

    const compareAliases = (label: string, keys: string[], formatter?: (val: any) => string) => {
      const v1 = this.getAuditStateValue(prev, keys);
      const v2 = this.getAuditStateValue(next, keys);
      const changed = v1 !== v2;
      const prevValue = formatter ? formatter(v1) : String(v1 ?? '—');
      const nextValue = formatter ? formatter(v2) : String(v2 ?? '—');
      fields.push({
        label,
        prev: prevValue || '—',
        next: nextValue || '—',
        changed
      });
    };

    compareAliases('Estado', ['status', 'estado'], (val) => {
      const normalized = this.normalizeStatus(val);
      return normalized === '—' ? '—' : this.formatStatus(normalized);
    });
    compareAliases('Nº Detalles', ['numeroDetalles', 'detailsCount', 'detailCount', 'numDetails']);
    compareAliases('ID Pedido', ['orderId', 'idPedido', 'id_order', 'id']);
    compareAliases('ID Usuario', ['userId', 'usuarioId', 'idUsuario']);
    compareAliases('Fecha Orden', ['orderDate', 'fechaOrden'], (val) => this.formatAuditDateValue(val));

    const hasSupplier = this.getAuditStateValue(prev, ['supplierName', 'nombreProveedor']) !== null
      || this.getAuditStateValue(next, ['supplierName', 'nombreProveedor']) !== null;
    if (hasSupplier) {
      compareAliases('Proveedor', ['supplierName', 'nombreProveedor']);
    }

    const hasTotalPrice = this.getAuditStateValue(prev, ['totalPrice', 'precioTotal']) !== null
      || this.getAuditStateValue(next, ['totalPrice', 'precioTotal']) !== null;
    if (hasTotalPrice) {
      compareAliases('Precio Total', ['totalPrice', 'precioTotal'], (val) => this.formatCurrency(val));
    }

    if (this.getAuditStateValue(prev, ['receptionDate', 'fechaRecepcion']) || this.getAuditStateValue(next, ['receptionDate', 'fechaRecepcion'])) {
      compareAliases('Fecha Recepción', ['receptionDate', 'fechaRecepcion'], (val) => this.formatAuditDateValue(val));
    }

    return fields;
  }

  getDetailDiffs(): { product: string; status: 'added' | 'removed' | 'changed' | 'unchanged'; prevQty: string; nextQty: string }[] {
    if (!this.selectedAudit) return [];
    const prev = this.parseAuditState(this.selectedAudit.previousState);
    const next = this.parseAuditState(this.selectedAudit.newState);

    const prevDetails: any[] = prev['details'] || [];
    const nextDetails: any[] = next['details'] || [];

    const allProductIds = new Set([
      ...prevDetails.map(d => d.productId),
      ...nextDetails.map(d => d.productId)
    ]);

    const diffs: any[] = [];
    allProductIds.forEach(id => {
      const p1 = prevDetails.find(d => d.productId === id);
      const p2 = nextDetails.find(d => d.productId === id);

      if (!p1 && p2) {
        diffs.push({ product: p2.productName, status: 'added', prevQty: '—', nextQty: String(p2.quantity) });
      } else if (p1 && !p2) {
        diffs.push({ product: p1.productName, status: 'removed', prevQty: String(p1.quantity), nextQty: '—' });
      } else if (p1 && p2) {
        const changed = p1.quantity !== p2.quantity || p1.unitPrice !== p2.unitPrice;
        diffs.push({
          product: p2.productName,
          status: changed ? 'changed' : 'unchanged',
          prevQty: String(p1.quantity),
          nextQty: String(p2.quantity)
        });
      }
    });

    return diffs;
  }

  // ── Helpers ──
  formatDateWithTime(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'Creada', PENDING: 'Pendiente', REVIEW: 'Revisión',
      CONFIRMED: 'Confirmada', INCOMPLETE: 'Incompleta', CANCELLED: 'Cancelada'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'status-created', PENDING: 'status-pending', REVIEW: 'status-review',
      CONFIRMED: 'status-confirmed', INCOMPLETE: 'status-incomplete', CANCELLED: 'status-cancelled'
    };
    return map[status] || '';
  }

  getAuditPrevStatus(audit: OrderAudit): string | null {
    if (!audit.previousState) return null;
    try { const o = JSON.parse(audit.previousState); return o.status ?? o.estado ?? null; } catch { return null; }
  }

  getAuditNewStatus(audit: OrderAudit): string | null {
    if (!audit.newState) return null;
    try { const o = JSON.parse(audit.newState); return o.status ?? o.estado ?? null; } catch { return null; }
  }

  getActionBadgeClass(action: string): string {
    const u = action.toUpperCase();
    if (u.includes('CREA') || u.includes('CREATE')) return 'badge-create';
    if (u.includes('MODIF') || u.includes('UPDATE') || u.includes('CAMBIO') || u.includes('ESTADO')) return 'badge-update';
    if (u.includes('ELIMIN') || u.includes('DELETE') || u.includes('CANCEL')) return 'badge-delete';
    if (u.includes('CONFIRM') || u.includes('RECEP') || u.includes('RECEPCION')) return 'badge-confirm';
    return 'badge-default';
  }

  translateAction(action: string): string {
    const u = action.toUpperCase();
    if (u.includes('CREATE')) return 'Creación';
    if (u.includes('UPDATE')) return 'Modificación';
    if (u.includes('DELETE')) return 'Eliminación';
    if (u.includes('RECEP')) return 'Recepcionado';
    if (u.includes('CONFIRM')) return 'Confirmado';
    if (u.includes('REVERSION')) return 'Reversión';
    if (u.includes('CAMBIO') && u.includes('ESTADO')) return 'Cambio Estado';
    return action;
  }
}
