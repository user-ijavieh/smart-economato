import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { OrderAuditService } from '../../../core/services/order-audit.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { Order, OrderStatus } from '../../../shared/models/order.model';
import { OrderAudit } from '../../../shared/models/order-audit.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { User } from '../../../shared/models/user.model';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { finalize } from 'rxjs';

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'CREATED',    label: 'Creada' },
  { value: 'PENDING',    label: 'Pendiente' },
  { value: 'REVIEW',     label: 'En Revisión' },
  { value: 'CONFIRMED',  label: 'Confirmada' },
  { value: 'INCOMPLETE', label: 'Incompleta' },
  { value: 'CANCELLED',  label: 'Cancelada' },
];

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

  // ── Status options exposed to template ──
  readonly allStatuses = ALL_STATUSES;

  // ── Orders state ──
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = true;
  orderSearchTerm = '';
  orderDateFilter = '';
  orderStatusFilter = '';
  orderUserFilter: number | '' = '';
  currentOrderPage = 0;
  totalOrdersCount = 0;
  totalOrderPages = 0;
  orderPageSize = 20;
  statusCounts: Record<string, number> = {};

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
  
  // ── Order Detail Modal ──
  selectedOrder: Order | null = null;
  showOrderDetailModal = false;

  // ── Change-Status Modal ──
  showChangeStatusModal = false;
  orderForStatusChange: Order | null = null;
  newStatusValue = '';
  savingStatus = false;

  private auditCache: Map<string, any> = new Map();

  ngOnInit(): void {
    this.loadAllOrders();
    this.loadSuppliers();
    this.loadUsers();
    this.loadStatusCounts();
  }

  // ── Status counts ──
  loadStatusCounts(): void {
    this.allStatuses.forEach(status => {
      this.orderService.getByStatus(status.value).subscribe({
        next: (orders) => {
          this.statusCounts[status.value] = orders.length;
          this.cdr.markForCheck();
        }
      });
    });
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
  loadAllOrders(page = 0): void {
    this.loading = true;
    this.currentOrderPage = page;
    this.cdr.markForCheck();

    this.orderService.getAll(page, this.orderPageSize).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          this.orders = response;
          this.totalOrdersCount = response.length;
          this.totalOrderPages = 1;
        } else if (response?.content) {
          this.orders = response.content;
          this.totalOrdersCount = response.totalElements;
          this.totalOrderPages = response.totalPages;
        }
        this.filteredAuditOrders = this.orders.filter(o => o.status === 'CONFIRMED');
        this.applyOrderFilters();
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
      this.loadAllOrders(newPage);
    }
  }

  applyOrderFilters(): void {
    let result = [...this.orders];

    const term = this.orderSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        o.id.toString().includes(term) ||
        (o.userName && o.userName.toLowerCase().includes(term))
      );
    }

    if (this.orderDateFilter) {
      result = result.filter(o =>
        o.orderDate && o.orderDate.startsWith(this.orderDateFilter)
      );
    }

    if (this.orderStatusFilter) {
      result = result.filter(o => o.status === this.orderStatusFilter);
    }

    if (this.orderUserFilter !== '') {
      result = result.filter(o => o.userId === Number(this.orderUserFilter));
    }

    this.filteredOrders = result;
    this.cdr.detectChanges();
  }

  onOrderSearch(): void { this.applyOrderFilters(); }

  clearOrderFilters(): void {
    this.orderSearchTerm = '';
    this.orderDateFilter = '';
    this.orderStatusFilter = '';
    this.orderUserFilter = '';
    this.loadAllOrders(0);
  }

  hasActiveOrderFilters(): boolean {
    return this.orderSearchTerm.trim().length > 0
      || this.orderDateFilter.length > 0
      || this.orderStatusFilter !== ''
      || this.orderUserFilter !== '';
  }

  // ── Dropdown loaders ──
  private loadSuppliers(): void {
    this.supplierService.getAll(0, 200, 'name,asc').subscribe({
      next: (page) => { this.suppliersList = page.content; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  private loadUsers(): void {
    this.userService.getAllUnpaged().subscribe({
      next: (users) => { this.usersList = users; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  // ── Change Status Modal ──
  openChangeStatusModal(order: Order): void {
    this.orderForStatusChange = order;
    this.newStatusValue = order.status;
    this.showChangeStatusModal = true;
    this.cdr.markForCheck();
  }

  closeChangeStatusModal(): void {
    this.showChangeStatusModal = false;
    this.orderForStatusChange = null;
    this.newStatusValue = '';
    this.savingStatus = false;
    this.cdr.markForCheck();
  }

  onChangeStatusOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeChangeStatusModal();
    }
  }

  confirmStatusChange(): void {
    if (!this.orderForStatusChange || !this.newStatusValue || this.savingStatus) return;
    if (this.newStatusValue === this.orderForStatusChange.status) {
      this.closeChangeStatusModal();
      return;
    }

    const orderId = this.orderForStatusChange.id;
    const status = this.newStatusValue;

    this.savingStatus = true;
    this.cdr.markForCheck();

    this.orderService.updateStatus(orderId, status).pipe(
      finalize(() => { this.savingStatus = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          this.orders[idx] = { ...this.orders[idx], status: (updated.status ?? status) as OrderStatus };
        }
        this.applyOrderFilters();
        this.filteredAuditOrders = this.orders.filter(o => o.status === 'CONFIRMED');
        
        // Clear audit cache to ensure the new record is fetched
        this.auditCache.clear();
        this.auditsLoaded = false;
        
        this.loadStatusCounts();
        this.messageService.showSuccess('Estado actualizado correctamente');
        this.closeChangeStatusModal();
      },
      error: () => {
        this.messageService.showError('Error al actualizar el estado de la orden');
      }
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
                    if (a.newState) {
                        const parsed = JSON.parse(a.newState);
                        if (parsed.id) a.orderId = parsed.id;
                    } else if (a.previousState) {
                        const parsed = JSON.parse(a.previousState);
                        if (parsed.id) a.orderId = parsed.id;
                    }
                } catch(e) {}
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

  onAuditSearch(): void { this.applyAuditOrderFilters(); }
  onAuditDateFilter(): void { this.applyAuditOrderFilters(); }

  applyAuditOrderFilters(): void {
    let result = [...this.audits];

    // Backend already filters by CONFIRMED status in the new endpoint
    
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

  // ── Stats ──
  get totalOrdersPrice(): number {
    return this.filteredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  }

  countByStatus(status: string): number {
    return this.orders.filter(o => o.status === status).length;
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
        next: (history) => {
          // Sort history by date descending (newest first)
          this.selectedOrderHistory = history.sort((a, b) => 
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

  onAuditOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeAuditDetail();
    }
  }

  // ── Order Detail Modal ──
  openOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailModal = true;
    this.cdr.markForCheck();
  }

  downloadOrderPdf(order: Order): void {
    if (!order.id) return;
    this.orderService.downloadPdf(order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orden-${order.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.messageService.showError('Error al descargar el PDF');
      }
    });
  }

  closeOrderDetail(): void {
    this.showOrderDetailModal = false;
    this.selectedOrder = null;
    this.cdr.markForCheck();
  }

  onOrderDetailOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
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

    const labelMap: Record<string, string> = {
      estado: 'Estado', status: 'Estado', id: 'ID Orden', userId: 'ID Usuario',
      userName: 'Usuario', orderDate: 'Fecha Orden', fechaOrden: 'Fecha Orden', totalPrice: 'Precio Total',
    };

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const priorityKeys = ['id', 'estado', 'status', 'userName', 'totalPrice', 'orderDate', 'fechaOrden'];
    const orderedKeys = [
      ...priorityKeys.filter(k => allKeys.has(k)),
      ...[...allKeys].filter(k => !priorityKeys.includes(k) && k !== 'details')
    ];

    return orderedKeys.map(key => {
      let prevVal = prev[key] != null ? String(prev[key]) : '—';
      let nextVal = next[key] != null ? String(next[key]) : '—';
      
      // Format special fields
      if (key === 'estado' || key === 'status') {
          prevVal = prev[key] != null ? this.formatStatus(prev[key] as OrderStatus) : '—';
          nextVal = next[key] != null ? this.formatStatus(next[key] as OrderStatus) : '—';
      } else if (key === 'orderDate' || key === 'fechaOrden') {
          prevVal = prev[key] != null ? this.formatDate(prev[key]) : '—';
          nextVal = next[key] != null ? this.formatDate(next[key]) : '—';
      }

      return {
        label: labelMap[key] || key,
        prev: key === 'totalPrice' && prev[key] != null ? `${parseFloat(prev[key]).toFixed(2)} €` : prevVal,
        next: key === 'totalPrice' && next[key] != null ? `${parseFloat(next[key]).toFixed(2)} €` : nextVal,
        changed: prevVal !== nextVal
      };
    });
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
      if (p && !n) result.push({ product: name, prevQty: String(p.quantity), nextQty: '—', status: 'removed' });
      else if (!p && n) result.push({ product: name, prevQty: '—', nextQty: String(n.quantity), status: 'added' });
      else if (p && n) result.push({ product: name, prevQty: String(p.quantity), nextQty: String(n.quantity), status: p.quantity !== n.quantity ? 'changed' : 'unchanged' });
    });

    return result;
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
      CREATED: 'Creada', PENDING: 'Pendiente', REVIEW: 'En Revisión',
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
    if (u.includes('CONFIRM') || u.includes('RECEP')) return 'badge-confirm';
    return 'badge-default';
  }
}
