import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { OrderAuditService } from '../../../core/services/order-audit.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { Order } from '../../../shared/models/order.model';
import { OrderAudit } from '../../../shared/models/order-audit.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { User } from '../../../shared/models/user.model';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-orders-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './orders-management.component.html',
  styleUrl: './orders-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersManagementComponent implements OnInit {
  private orderService = inject(OrderService);
  private orderAuditService = inject(OrderAuditService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  messageService = inject(MessageService);

  // ── Tab state ──
  activeTab: 'orders' | 'audits' = 'orders';

  // ── Orders state ──
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = true;
  orderSearchTerm = '';
  orderDateFilter = '';
  orderSupplierFilter: number | '' = '';
  orderUserFilter: number | '' = '';

  // ── Dropdown lists ──
  suppliersList: Supplier[] = [];
  usersList: User[] = [];

  // ── Audits state (kept for future use when backend permissions are fixed) ──
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
  showAuditDetailModal = false;

  // ── Order Detail Modal ──
  selectedOrder: Order | null = null;
  showOrderDetailModal = false;

  private auditCache: Map<string, any> = new Map();

  ngOnInit(): void {
    this.loadConfirmedOrders();
    this.loadSuppliers();
    this.loadUsers();
  }

  // ── Tab switching ──
  switchTab(tab: 'orders' | 'audits'): void {
    this.activeTab = tab;
    if (tab === 'audits') {
      // Use already loaded confirmed orders for the audit tab
      this.applyAuditOrderFilters();
    }
    this.cdr.detectChanges();
  }

  // ── Orders ──
  loadConfirmedOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.orderService.getByStatus('CONFIRMED').pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredAuditOrders = [...orders]; // initialise audit tab data
        this.applyOrderFilters();
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('Error al cargar las órdenes confirmadas');
      }
    });
  }

  applyOrderFilters(): void {
    let result = [...this.orders];

    // Text search
    const term = this.orderSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        o.id.toString().includes(term) ||
        (o.userName && o.userName.toLowerCase().includes(term))
      );
    }

    // Date filter
    if (this.orderDateFilter) {
      result = result.filter(o =>
        o.orderDate && o.orderDate.startsWith(this.orderDateFilter)
      );
    }

    // User filter
    if (this.orderUserFilter !== '') {
      result = result.filter(o => o.userId === Number(this.orderUserFilter));
    }

    // Supplier filter — orders don't carry supplierId directly;
    // we keep this as a client-side best-effort (no-op if no match field)
    // It will work once the API returns supplierId/supplierName on orders.

    this.filteredOrders = result;
    this.cdr.detectChanges();
  }

  onOrderSearch(): void {
    this.applyOrderFilters();
  }

  clearOrderFilters(): void {
    this.orderSearchTerm = '';
    this.orderDateFilter = '';
    this.orderSupplierFilter = '';
    this.orderUserFilter = '';
    this.applyOrderFilters();
  }

  hasActiveOrderFilters(): boolean {
    return this.orderSearchTerm.trim().length > 0
      || this.orderDateFilter.length > 0
      || this.orderSupplierFilter !== ''
      || this.orderUserFilter !== '';
  }

  // ── Dropdown loaders ──
  private loadSuppliers(): void {
    this.supplierService.getAll(0, 200, 'name,asc').subscribe({
      next: (page) => {
        this.suppliersList = page.content;
        this.cdr.markForCheck();
      },
      error: () => { /* silent fail — dropdown stays empty */ }
    });
  }

  private loadUsers(): void {
    this.userService.getAllUnpaged().subscribe({
      next: (users) => {
        this.usersList = users;
        this.cdr.markForCheck();
      },
      error: () => { /* silent fail */ }
    });
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
      finalize(() => {
        this.loadingAudits = false;
        this.auditsLoaded = true;
        this.cdr.detectChanges();
      })
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
        this.audits = auditsArray;
        this.auditCache.set(cacheKey, {
          content: auditsArray,
          totalElements: this.totalAuditsCount,
          totalPages: this.totalAuditPages
        });
        this.applyAuditOrderFilters();
        this.cdr.detectChanges();
      },
      error: () => {
        this.messageService.showError('Error al cargar las auditorías');
      }
    });
  }

  onAuditSearch(): void {
    this.applyAuditOrderFilters();
  }

  onAuditDateFilter(): void {
    this.applyAuditOrderFilters();
  }

  applyAuditOrderFilters(): void {
    let result = [...this.orders];

    const term = this.auditSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        o.id.toString().includes(term) ||
        (o.userName && o.userName.toLowerCase().includes(term))
      );
    }

    if (this.auditStartDate) {
      const from = new Date(this.auditStartDate).getTime();
      result = result.filter(o => {
        const d = o.receptionDate || o.orderDate;
        return d ? new Date(d).getTime() >= from : true;
      });
    }

    if (this.auditEndDate) {
      const to = new Date(this.auditEndDate).getTime() + 86400000;
      result = result.filter(o => {
        const d = o.receptionDate || o.orderDate;
        return d ? new Date(d).getTime() <= to : true;
      });
    }

    this.filteredAuditOrders = result;
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

  // ── Order Stats ──
  get totalOrdersPrice(): number {
    return this.filteredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  }

  get averageOrderPrice(): number {
    if (this.filteredOrders.length === 0) return 0;
    return this.totalOrdersPrice / this.filteredOrders.length;
  }

  // ── Audit Modal ──
  openAuditDetail(audit: OrderAudit): void {
    this.selectedAudit = audit;
    this.showAuditDetailModal = true;
    this.cdr.markForCheck();
  }

  closeAuditDetail(): void {
    this.showAuditDetailModal = false;
    this.selectedAudit = null;
    this.cdr.markForCheck();
  }

  onAuditOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('audit-modal-overlay')) {
      this.closeAuditDetail();
    }
  }

  // ── Order Detail Modal ──
  openOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailModal = true;
    this.cdr.markForCheck();
  }

  closeOrderDetail(): void {
    this.showOrderDetailModal = false;
    this.selectedOrder = null;
    this.cdr.markForCheck();
  }

  onOrderDetailOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('audit-modal-overlay')) {
      this.closeOrderDetail();
    }
  }

  // ── Diff helpers ──
  get parsedPreviousState(): any | null {
    if (!this.selectedAudit?.previousState) return null;
    try { return JSON.parse(this.selectedAudit.previousState); } catch { return null; }
  }

  get parsedNewState(): any | null {
    if (!this.selectedAudit?.newState) return null;
    try { return JSON.parse(this.selectedAudit.newState); } catch { return null; }
  }

  get hasDiffData(): boolean {
    return this.parsedPreviousState !== null && this.parsedNewState !== null;
  }

  getDiffFields(): { label: string; prev: string; next: string; changed: boolean }[] {
    const prev = this.parsedPreviousState;
    const next = this.parsedNewState;
    if (!prev || !next) return [];

    const fields: { label: string; prev: string; next: string; changed: boolean }[] = [];
    const labelMap: Record<string, string> = {
      status: 'Estado',
      id: 'ID Orden',
      userId: 'ID Usuario',
      userName: 'Usuario',
      orderDate: 'Fecha Orden',
      totalPrice: 'Precio Total',
    };

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    // Prioritize known fields first
    const priorityKeys = ['id', 'status', 'userName', 'totalPrice', 'orderDate'];
    const orderedKeys = [
      ...priorityKeys.filter(k => allKeys.has(k)),
      ...[...allKeys].filter(k => !priorityKeys.includes(k) && k !== 'details')
    ];

    for (const key of orderedKeys) {
      const prevVal = prev[key] != null ? String(prev[key]) : '—';
      const nextVal = next[key] != null ? String(next[key]) : '—';
      fields.push({
        label: labelMap[key] || key,
        prev: key === 'totalPrice' && prev[key] != null ? `${parseFloat(prev[key]).toFixed(2)} €` : prevVal,
        next: key === 'totalPrice' && next[key] != null ? `${parseFloat(next[key]).toFixed(2)} €` : nextVal,
        changed: prevVal !== nextVal
      });
    }
    return fields;
  }

  getDetailDiffs(): { product: string; prevQty: string; nextQty: string; status: 'added' | 'removed' | 'changed' | 'unchanged' }[] {
    const prev = this.parsedPreviousState;
    const next = this.parsedNewState;
    if (!prev || !next) return [];

    const prevDetails: any[] = prev.details ?? prev.orderDetails ?? [];
    const nextDetails: any[] = next.details ?? next.orderDetails ?? [];
    if (prevDetails.length === 0 && nextDetails.length === 0) return [];

    const prevMap = new Map<number, any>();
    const nextMap = new Map<number, any>();
    prevDetails.forEach(d => prevMap.set(d.productId, d));
    nextDetails.forEach(d => nextMap.set(d.productId, d));

    const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);
    const result: any[] = [];

    allIds.forEach(id => {
      const p = prevMap.get(id);
      const n = nextMap.get(id);
      const name = n?.productName ?? p?.productName ?? `Producto #${id}`;

      if (p && !n) {
        result.push({ product: name, prevQty: String(p.quantity), nextQty: '—', status: 'removed' });
      } else if (!p && n) {
        result.push({ product: name, prevQty: '—', nextQty: String(n.quantity), status: 'added' });
      } else if (p && n) {
        const changed = p.quantity !== n.quantity;
        result.push({ product: name, prevQty: String(p.quantity), nextQty: String(n.quantity), status: changed ? 'changed' : 'unchanged' });
      }
    });

    return result;
  }

  // ── Helpers ──
  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'Creada',
      PENDING: 'Pendiente',
      REVIEW: 'En Revisión',
      CONFIRMED: 'Confirmada',
      INCOMPLETE: 'Incompleta',
      CANCELLED: 'Cancelada'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'status-created',
      PENDING: 'status-pending',
      REVIEW: 'status-review',
      CONFIRMED: 'status-confirmed',
      INCOMPLETE: 'status-incomplete',
      CANCELLED: 'status-cancelled'
    };
    return map[status] || '';
  }

  // Extracts the status field from an audit's previousState JSON
  getAuditPrevStatus(audit: OrderAudit): string | null {
    if (!audit.previousState) return null;
    try {
      const obj = JSON.parse(audit.previousState);
      return obj.status ?? obj.estado ?? null;
    } catch { return null; }
  }

  // Extracts the status field from an audit's newState JSON
  getAuditNewStatus(audit: OrderAudit): string | null {
    if (!audit.newState) return null;
    try {
      const obj = JSON.parse(audit.newState);
      return obj.status ?? obj.estado ?? null;
    } catch { return null; }
  }

  getActionBadgeClass(action: string): string {
    const u = action.toUpperCase();
    if (u.includes('CREA') || u.includes('CREATE')) return 'badge-create';
    if (u.includes('MODIF') || u.includes('UPDATE') || u.includes('CAMBIO') || u.includes('ESTADO')) return 'badge-update';
    if (u.includes('ELIMIN') || u.includes('DELETE') || u.includes('CANCEL')) return 'badge-delete';
    if (u.includes('CONFIRM') || u.includes('RECEP')) return 'badge-confirm';
    return 'badge-default';
  }
}
