import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, Subject, takeUntil } from 'rxjs';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { MessageService } from '../../../core/services/message.service';
import { WeeklyPlanProductPendingOrder, WeeklyPlanResponse, WeeklyPlanSlotResponse, WeeklyPlanSlotStudentResponse, WeeklyPlanStockRequirement } from '../../../shared/models/weekly-plan.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { Supplier } from '../../../shared/models/supplier.model';
import { OrderBuilderComponent } from '../../../shared/components/order-builder/order-builder.component';

@Component({
  selector: 'app-weekly-plan-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, OrderBuilderComponent, TranslateModule],
  templateUrl: './weekly-plan-detail.component.html',
  styleUrls: ['./weekly-plan-detail.component.css']
})
export class WeeklyPlanDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private weeklyPlanService = inject(WeeklyPlanService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private supplierService = inject(SupplierService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  planId: number | null = null;
  plan: WeeklyPlanResponse | null = null;
  loading = true;
  downloadingPdf = false;
  showDownloadPdfModal = false;
  downloadPdfOrientation: 'horizontal' | 'vertical' = 'horizontal';
  activatingPlan = false;
  deactivatingPlan = false;
  
  activeTab: 'tablero' | 'stock' | 'asistencia' = 'tablero';
  
  days = [
    { value: 1, label: 'COMMON.DAYS.MONDAY' },
    { value: 2, label: 'COMMON.DAYS.TUESDAY' },
    { value: 3, label: 'COMMON.DAYS.WEDNESDAY' },
    { value: 4, label: 'COMMON.DAYS.THURSDAY' },
    { value: 5, label: 'COMMON.DAYS.FRIDAY' }
  ];

  collapsedDays = new Set<number>();
  selectedDayTab = 1; // Default to Monday (1)
  activeDayMenu: number | null = null;

  stockRequirements: WeeklyPlanStockRequirement[] = [];
  loadingStock = false;
  showStockOrderModal = false;
  loadingStockOrderData = false;
  stockOrderItems: WeeklyPlanRepositionOrderItem[] = [];
  suppliers: Supplier[] = [];
  loadingSuppliers = false;
  stockSearchTerm = '';
  stockSortMode: 'name' | 'shortage' = 'shortage';
  attendanceSearchTerm = '';
  expandedAttendanceStudents = new Set<number>();
  expandedAttendanceDays = new Set<string>();
  cancellingAttendance = new Set<string>(); // key: studentId-dayOfWeek or studentId-slotId
  restoringAttendance = new Set<string>();

  get rosterStudents(): WeeklyPlanStudentRosterRow[] {
    if (!this.plan?.slots?.length) {
      return [];
    }

    const byStudent = new Map<number, WeeklyPlanStudentRosterRow>();

    for (const slot of this.plan.slots) {
      for (const student of slot.students || []) {
        const existing = byStudent.get(student.studentId);
        const dayLabel = this.getDayLabel(slot.dayOfWeek);
        const item: WeeklyPlanStudentRosterDay = {
          dayOfWeek: slot.dayOfWeek,
          dayLabel,
          slotIds: [slot.id],
          slotSummaries: [{
            id: slot.id,
            recipeName: slot.recipeName,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            studentStatus: student.status,
            sortOrder: slot.sortOrder
          }]
        };

        if (!existing) {
          byStudent.set(student.studentId, {
            studentId: student.studentId,
            studentName: student.studentName,
            totalAssignments: 1,
            days: [item]
          });
          continue;
        }

        existing.totalAssignments += 1;
        const dayEntry = existing.days.find(entry => entry.dayOfWeek === slot.dayOfWeek);
        if (dayEntry) {
          dayEntry.slotIds.push(slot.id);
          dayEntry.slotSummaries.push({
            id: slot.id,
            recipeName: slot.recipeName,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            studentStatus: student.status,
            sortOrder: slot.sortOrder
          });
        } else {
          existing.days.push(item);
        }
      }
    }

    for (const row of byStudent.values()) {
      row.days.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      for (const day of row.days) {
        day.slotSummaries.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }

    return Array.from(byStudent.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  get filteredRosterStudents(): WeeklyPlanStudentRosterRow[] {
    const term = this.attendanceSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.rosterStudents;
    }

    return this.rosterStudents.filter(student => student.studentName.toLowerCase().includes(term));
  }

  get filteredStockRequirements(): WeeklyPlanStockRequirement[] {
    const term = this.stockSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.stockRequirements;
    }

    return this.stockRequirements.filter(requirement => requirement.productName.toLowerCase().includes(term));
  }

  get slotsByDay(): Record<number, WeeklyPlanSlotResponse[]> {
    const map: Record<number, WeeklyPlanSlotResponse[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    if (!this.plan || !this.plan.slots) return map;
    
    this.plan.slots.forEach(slot => {
      // Only L-V for visualization, optionally expand for weekends if present
      if (map[slot.dayOfWeek]) {
        map[slot.dayOfWeek].push(slot);
      } else {
        map[slot.dayOfWeek] = [slot];
      }
    });

    // sort slots by start time
    Object.keys(map).forEach(key => {
      map[Number(key)].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return map;
  }

  toggleDayCollapse(day: number) {
    if (this.collapsedDays.has(day)) {
      this.collapsedDays.delete(day);
    } else {
      this.collapsedDays.add(day);
    }
  }

  toggleDayMenu(day: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeDayMenu === day) {
      this.activeDayMenu = null;
    } else {
      this.activeDayMenu = day;
    }
  }

  closeAllMenus() {
    this.activeDayMenu = null;
  }

  isDayCollapsed(dayValue: number): boolean {
    return this.collapsedDays.has(dayValue);
  }

  selectDayTab(dayValue: number) {
    this.selectedDayTab = dayValue;
    this.cdr.detectChanges();
  }

  onDayMobileChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectDayTab(Number(select.value));
  }

  ngOnInit() {
    this.loadSuppliers();
    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.planId = Number(idStr);
        this.loadPlan();
      }
    });

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (!this.planId) return;

        if (domains.includes('weekly_plan')) {
          this.loadPlan();
        } else if ((domains.includes('order') || domains.includes('batch') || domains.includes('product')) && this.activeTab === 'stock') {
          this.loadStock();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlan() {
    if (!this.planId) return;
    this.loading = true;
    this.weeklyPlanService.getPlanById(this.planId).subscribe({
      next: (plan) => {
        this.plan = plan;
        
        // Dynamic days based on plan slots (add Sat/Sun if they exist)
        const activeDays = new Set(this.plan.slots.map(s => s.dayOfWeek));
        if (activeDays.has(6) && !this.days.find(d => d.value === 6)) this.days.push({ value: 6, label: 'COMMON.DAYS.SATURDAY' });
        if (activeDays.has(7) && !this.days.find(d => d.value === 7)) this.days.push({ value: 7, label: 'COMMON.DAYS.SUNDAY' });
        this.days.sort((a, b) => a.value - b.value);

        this.loading = false;
        this.cdr.detectChanges();
        
        if (this.activeTab === 'stock') {
          this.loadStock();
        }
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  switchTab(tab: 'tablero' | 'stock' | 'asistencia') {
    this.activeTab = tab;
    if (tab === 'stock') {
      this.loadStock();
    }
  }

  setStockSortMode(mode: 'name' | 'shortage') {
    this.stockSortMode = mode;
    this.stockRequirements = this.sortStockRequirements(this.stockRequirements);
    this.cdr.detectChanges();
  }

  loadStock() {
    if (!this.planId) return;
    this.loadingStock = true;
    this.weeklyPlanService.getStockRequirements(this.planId).subscribe({
      next: (data) => {
        this.stockRequirements = this.sortStockRequirements(data);
        this.enrichStockRequirementsWithPendingOrders(data);
      },
      error: () => {
        this.loadingStock = false;
        this.cdr.detectChanges();
      }
    });
  }

  private enrichStockRequirementsWithPendingOrders(requirements: WeeklyPlanStockRequirement[]): void {
    const productIds = requirements.map(requirement => requirement.productId);
    if (!productIds.length) {
      this.loadingStock = false;
      this.cdr.detectChanges();
      return;
    }

    this.orderService.searchByProducts({
      productIds,
      statuses: ['PENDING', 'REVIEW']
    }).subscribe({
      next: (batch) => {
        const quantityMap = batch?.totalQuantityPerProduct || {};
        const countMap = batch?.orderCountPerProduct || {};
        const ordersByProduct = batch?.ordersByProduct || {};

        this.stockRequirements = requirements.map(requirement => {
          const key = String(requirement.productId);
          const relatedOrders = (ordersByProduct[key] || []) as WeeklyPlanProductPendingOrder[];
          return {
            ...requirement,
            pendingOrderQuantity: Number(quantityMap[key] || 0),
            pendingOrderCount: Number(countMap[key] || 0),
            relatedOrders
          };
        });
        this.stockRequirements = this.sortStockRequirements(this.stockRequirements);

        this.loadingStock = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Keep stock requirements visible even if enrichment fails.
        this.stockRequirements = this.sortStockRequirements(this.stockRequirements);
        this.loadingStock = false;
        this.cdr.detectChanges();
      }
    });
  }

  private sortStockRequirements(requirements: WeeklyPlanStockRequirement[]): WeeklyPlanStockRequirement[] {
    return [...requirements].sort((a, b) => {
      if (this.stockSortMode === 'shortage') {
        const aAtRisk = !!a.expirationRisk;
        const bAtRisk = !!b.expirationRisk;
        if (aAtRisk !== bAtRisk) {
          return aAtRisk ? -1 : 1;
        }

        const aCovered = (a.sufficient !== false) && (this.getUncoveredStockShortage(a) === 0);
        const bCovered = (b.sufficient !== false) && (this.getUncoveredStockShortage(b) === 0);

        if (aCovered !== bCovered) {
          return aCovered ? 1 : -1;
        }
      }

      return a.productName.localeCompare(b.productName, 'es');
    });
  }

  loadSuppliers(): void {
    if (this.loadingSuppliers || this.suppliers.length > 0) return;

    this.loadingSuppliers = true;
    this.supplierService.getAll(0, 50, 'name,asc').subscribe({
      next: (page) => {
        this.suppliers = page?.content || [];
        this.loadingSuppliers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingSuppliers = false;
        this.cdr.detectChanges();
      }
    });
  }

  getStockShortage(requirement: WeeklyPlanStockRequirement): number {
    const grossTrulyAvailable = this.getGrossAvailableStock(requirement);
    return Math.max(0, (requirement.grossRequiredQuantity || requirement.requiredQuantity) - grossTrulyAvailable);
  }


  getRealAvailableStock(requirement: WeeklyPlanStockRequirement): number {
    // Neto realmente disponible para este plan = Stock Neto Total - Reservado Neto Otros
    return Math.max(0, (requirement.availableStock || 0) - (requirement.reservedByOtherPlans || 0));
  }

  getGrossAvailableStock(requirement: WeeklyPlanStockRequirement): number {
    // Bruto realmente disponible para este plan = Stock Bruto Total - Reservado Bruto Otros
    // Usamos los campos calculados del backend para mayor precisión
    const totalPhysical = requirement.grossAvailableStock || 0;
    const reservedGross = requirement.grossReservedByOtherPlans || 0;
    return Math.max(0, totalPhysical - reservedGross);
  }


  getUncoveredStockShortage(requirement: WeeklyPlanStockRequirement): number {
    return Math.max(0, this.getStockShortage(requirement) - this.getPendingOrderQuantity(requirement));
  }

  canCreateStockOrder(): boolean {
    return this.getRequirementsNeedingReplenishment().length > 0;
  }

  private getRequirementsNeedingReplenishment(): WeeklyPlanStockRequirement[] {
    return this.stockRequirements.filter(requirement =>
      this.getUncoveredStockShortage(requirement) > 0 ||
      !requirement.sufficient ||
      requirement.expirationRisk
    );
  }

  calculateProgress(): number {
    if (!this.plan || !this.plan.slots || this.plan.slots.length === 0) return 0;
    const confirmed = this.plan.slots.filter(s => s.status === 'CONFIRMED').length;
    return Math.round((confirmed / this.plan.slots.length) * 100);
  }

  goBack() {
    this.router.navigate([this.getBaseRoute()]);
  }

  editPlan() {
    if (!this.planId) return;
    this.router.navigate([this.getBaseRoute(), this.planId, 'edit']);
  }

  openDownloadPdfModal() {
    if (!this.planId || this.downloadingPdf) return;
    this.downloadPdfOrientation = 'horizontal';
    this.showDownloadPdfModal = true;
  }

  closeDownloadPdfModal() {
    this.showDownloadPdfModal = false;
  }

  downloadPlanPdf() {
    if (!this.planId || this.downloadingPdf) return;

    this.showDownloadPdfModal = false;
    this.downloadingPdf = true;
    this.weeklyPlanService.downloadPlanPdf(this.planId, this.downloadPdfOrientation).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.messageService.showError(this.translate.instant('WEEKLY_PLANS.MESSAGES.PDF_ERROR'));
          return;
        }

        const contentDisposition = response.headers.get('content-disposition') || '';
        const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
        const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1].replace(/"/g, '')) : `plan_semanal_${this.planId}.pdf`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.PDF_DOWNLOAD_ERROR'));
      },
      complete: () => {
        this.downloadingPdf = false;
        this.cdr.detectChanges();
      }
    });
  }

  async activatePlan() {
    if (!this.planId || this.activatingPlan) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.ACTIVATE_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.ACTIVATE_MSG'),
      this.translate.instant('COMMON.ACTIVATE'),
      this.translate.instant('COMMON.CANCEL')
    );
    if (!confirmed) return;

    this.activatingPlan = true;
    this.weeklyPlanService.activatePlan(this.planId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.ACTIVATE_SUCCESS'));
        this.loadPlan();
      },
      error: (err) => {  
    const backendMessage = typeof err?.error?.message === 'string' ? err.error.message : '';  
    if (backendMessage.toLowerCase().includes('caduc')) {  
        this.messageService.showError(`${backendMessage} ${this.translate.instant('WEEKLY_PLANS.MESSAGES.CHECK_INVENTORY_TAB') || 'Revisa la pestaña de inventario requerido para identificar productos en riesgo.'}`);  
    } else {  
        this.messageService.showError(backendMessage || this.translate.instant('WEEKLY_PLANS.MESSAGES.ACTIVATE_ERROR') || 'No se pudo activar el plan.');  
    }  
      },
      complete: () => {
        this.activatingPlan = false;
        this.cdr.detectChanges();
      }
    });
  }

  async deactivatePlan() {
    if (!this.planId || this.deactivatingPlan) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.DEACTIVATE_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.DEACTIVATE_MSG'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.BACK_TO_DRAFT'),
      this.translate.instant('COMMON.CANCEL')
    );
    if (!confirmed) return;

    this.deactivatingPlan = true;
    this.weeklyPlanService.deactivatePlan(this.planId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.DEACTIVATE_SUCCESS'));
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.DEACTIVATE_ERROR'));
      },
      complete: () => {
        this.deactivatingPlan = false;
        this.cdr.detectChanges();
      }
    });
  }

  openStockOrderModal() {
    if (!this.planId) return;

    const shortageRequirements = this.getRequirementsNeedingReplenishment();
    if (!shortageRequirements.length) {
      this.messageService.showInfo(this.translate.instant('WEEKLY_PLANS.MESSAGES.NO_SHORTAGES'));
      return;
    }

    this.loadingStockOrderData = true;
    const requests = shortageRequirements.map(async requirement => {
      const product = await firstValueFrom(this.productService.getById(requirement.productId));
      return {
        ...requirement,
        availableStock: this.getRealAvailableStock(requirement),
        unit: product.unit || requirement.productName,
        unitPrice: product.unitPrice || 0,
        lotQuantity: product.lotQuantity || 0,
        supplierId: product.supplier?.id ?? null,
        supplierName: product.supplier?.name ?? null,
        orderQuantity: this.getUncoveredStockShortage(requirement)
      } satisfies WeeklyPlanRepositionOrderItem;
    });

    Promise.all(requests)
      .then(items => {
        this.stockOrderItems = items;
        this.showStockOrderModal = true;
      })
      .catch(() => this.messageService.showError(this.translate.instant('WEEKLY_PLANS.MESSAGES.ORDER_PREP_ERROR')))
      .finally(() => {
        this.loadingStockOrderData = false;
        this.cdr.detectChanges();
      });
  }

  closeStockOrderModal(): void {
    this.showStockOrderModal = false;
    this.stockOrderItems = [];
    this.loadingStockOrderData = false;
  }

  onStockOrderBuilderCompleted(): void {
    this.showStockOrderModal = false;
    this.loadStock();
  }

  getPendingOrderQuantity(req: WeeklyPlanStockRequirement): number {
    return req.pendingOrderQuantity || 0;
  }

  getPendingOrderCount(req: WeeklyPlanStockRequirement): number {
    return req.pendingOrderCount || 0;
  }

  getOrdersForRequirement(req: WeeklyPlanStockRequirement): WeeklyPlanProductPendingOrder[] {
    return req.relatedOrders || [];
  }

  openRelatedOrderDetails(orderId: number): void {
    if (!orderId) return;

    this.router.navigate(['/orders'], {
      queryParams: { openOrderId: orderId }
    });
  }

  getPendingConfirmationQuantity(req: WeeklyPlanStockRequirement): number {
    return this.getOrdersForRequirement(req)
      .filter(order => order.status === 'CREATED')
      .reduce((sum, order) => sum + (order.quantity || 0), 0);
  }

  getInTransitQuantity(req: WeeklyPlanStockRequirement): number {
    return this.getOrdersForRequirement(req)
      .filter(order => order.status === 'PENDING' || order.status === 'REVIEW')
      .reduce((sum, order) => sum + (order.quantity || 0), 0);
  }

  hasInTransitOrders(req: WeeklyPlanStockRequirement): boolean {
    return this.getOrdersForRequirement(req).some(order => order.status === 'PENDING' || order.status === 'REVIEW');
  }

  hasPendingConfirmationOrders(req: WeeklyPlanStockRequirement): boolean {
    return this.getOrdersForRequirement(req).some(order => order.status === 'CREATED');
  }

  async confirmCreateStockOrders(): Promise<void> {
    // Moved to OrderBuilderComponent
  }

  isSlotActionable(slot: WeeklyPlanSlotResponse): boolean {
    if (!this.plan || this.plan.status === 'DRAFT') {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // weekStartDate es YYYY-MM-DD (Lunes de esa semana)
    const [year, month, day] = this.plan.weekStartDate.split('-').map(Number);
    const slotDate = new Date(year, month - 1, day);
    // dayOfWeek: 1=Lunes, 2=Martes, etc.
    slotDate.setDate(slotDate.getDate() + (slot.dayOfWeek - 1));
    slotDate.setHours(0, 0, 0, 0);

    return today >= slotDate;
  }

  async confirmSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;
    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_SESSION_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_SESSION_MSG', { num: slot.sortOrder + 1 }),
      this.translate.instant('COMMON.CONFIRM_SESSION'),
      this.translate.instant('COMMON.CANCEL')
    );
    if (!confirmed) {
      return;
    }

    this.weeklyPlanService.confirmSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_SESSION_SUCCESS'));
        this.loadPlan();
      },
error: (err) => {  
    const backendMessage = typeof err?.error?.message === 'string' ? err.error.message : '';  
    this.messageService.showError(backendMessage || this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_SESSION_ERROR') || 'Error al confirmar la sesión. Verifica stock disponible y estado del plan.');  
}
  });
  }

  async cancelSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;
    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_SESSION_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_SESSION_MSG', { num: slot.sortOrder + 1 }),
      this.translate.instant('COMMON.CANCEL_SESSION'),
      this.translate.instant('COMMON.BACK')
    );
    if (!confirmed) {
      return;
    }

    this.weeklyPlanService.cancelSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showInfo(this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_SESSION_SUCCESS'));
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_SESSION_ERROR'))
    });
  }

  async restoreSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_SESSION_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_SESSION_MSG', { num: slot.sortOrder + 1 }),
      this.translate.instant('COMMON.RESTORE_SESSION'),
      this.translate.instant('COMMON.BACK')
    );
    if (!confirmed) return;

    this.weeklyPlanService.restoreSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_SESSION_SUCCESS'));
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_SESSION_ERROR'))
    });
  }

  async unconfirmSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_CONFIRM_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_CONFIRM_MSG', { name: slot.recipeName }),
      this.translate.instant('COMMON.REVERT'),
      this.translate.instant('COMMON.CANCEL')
    );

    if (!confirmed) return;

    this.weeklyPlanService.unconfirmSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_CONFIRM_SUCCESS'));
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_CONFIRM_ERROR'))
    });
  }

  async confirmDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_DAY_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_DAY_MSG', { day: dayName }),
      this.translate.instant('COMMON.CONFIRM_ALL'),
      this.translate.instant('COMMON.CANCEL')
    );

    if (!confirmed) return;

    this.weeklyPlanService.confirmDay(this.planId, dayOfWeek).subscribe({
      next: (res) => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_DAY_SUCCESS', { day: dayName }));
        this.loadPlan();
      },
error: (err) => {  
    const backendMessage = typeof err?.error?.message === 'string' ? err.error.message : '';  
    this.messageService.showError(backendMessage || this.translate.instant('WEEKLY_PLANS.MESSAGES.CONFIRM_DAY_ERROR') || 'Error al confirmar el día. Verifica stock disponible y estado del plan.');  
}
    });
  }

  async unconfirmDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_DAY_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_DAY_MSG', { day: dayName }),
      this.translate.instant('COMMON.REVERT_ALL'),
      this.translate.instant('COMMON.CANCEL')
    );

    if (!confirmed) return;

    this.weeklyPlanService.unconfirmDay(this.planId, dayOfWeek).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_DAY_SUCCESS', { day: dayName }));
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.REVERT_DAY_ERROR'))
    });
  }

  async restoreDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_DAY_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_DAY_MSG', { day: dayName }),
      this.translate.instant('COMMON.RESTORE'),
      this.translate.instant('COMMON.CANCEL')
    );

    if (!confirmed) return;

    this.weeklyPlanService.restoreDay(this.planId, dayOfWeek).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_DAY_SUCCESS', { day: dayName }));
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_DAY_ERROR'))
    });
  }

  async cancelStudentFromDay(studentId: number, studentName: string, dayOfWeek: number) {
    if (!this.planId) return;

    const opKey = `${studentId}-${dayOfWeek}`;
    if (this.cancellingAttendance.has(opKey)) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_DAY_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_DAY_MSG', { name: studentName, day: this.getDayLabel(dayOfWeek) }),
      this.translate.instant('COMMON.CANCEL_STUDENT'),
      this.translate.instant('COMMON.BACK')
    );

    if (!confirmed) {
      return;
    }

    this.cancellingAttendance.add(opKey);
    this.weeklyPlanService.cancelStudentFromDay(this.planId, dayOfWeek, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_DAY_SUCCESS', { name: studentName }));
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_DAY_ERROR'));
      },
      complete: () => {
        this.cancellingAttendance.delete(opKey);
        this.cdr.detectChanges();
      }
    });
  }

  async restoreStudentFromDay(studentId: number, studentName: string, dayOfWeek: number) {
    if (!this.planId) return;

    const opKey = `restore-day-${studentId}-${dayOfWeek}`;
    if (this.restoringAttendance.has(opKey)) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_DAY_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_DAY_MSG', { name: studentName, day: this.getDayLabel(dayOfWeek) }),
      this.translate.instant('COMMON.RESTORE'),
      this.translate.instant('COMMON.BACK')
    );

    if (!confirmed) {
      return;
    }

    this.restoringAttendance.add(opKey);
    this.weeklyPlanService.restoreStudentFromDay(this.planId, dayOfWeek, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_DAY_SUCCESS', { name: studentName }));
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_DAY_ERROR'));
      },
      complete: () => {
        this.restoringAttendance.delete(opKey);
        this.cdr.detectChanges();
      }
    });
  }

  async cancelStudentFromSession(studentId: number, studentName: string, slotId: number, recipeName: string, sortOrder: number) {
    if (!this.planId) return;

    const opKey = `slot-${studentId}-${slotId}`;
    if (this.cancellingAttendance.has(opKey)) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_SESSION_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_SESSION_MSG', { name: studentName, num: sortOrder + 1, recipe: recipeName }),
      this.translate.instant('COMMON.CANCEL_SESSION'),
      this.translate.instant('COMMON.BACK')
    );

    if (!confirmed) {
      return;
    }

    this.cancellingAttendance.add(opKey);
    this.weeklyPlanService.cancelStudentFromSlot(this.planId, slotId, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_SESSION_SUCCESS', { name: studentName }));
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.CANCEL_STUDENT_SESSION_ERROR'));
      },
      complete: () => {
        this.cancellingAttendance.delete(opKey);
        this.cdr.detectChanges();
      }
    });
  }

  async restoreStudentFromSession(studentId: number, studentName: string, slotId: number, recipeName: string, sortOrder: number) {
    if (!this.planId) return;

    const opKey = `restore-slot-${studentId}-${slotId}`;
    if (this.restoringAttendance.has(opKey)) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_SESSION_TITLE'),
      this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_SESSION_MSG', { name: studentName, num: sortOrder + 1, recipe: recipeName }),
      this.translate.instant('COMMON.RESTORE'),
      this.translate.instant('COMMON.BACK')
    );

    if (!confirmed) {
      return;
    }

    this.restoringAttendance.add(opKey);
    this.weeklyPlanService.restoreStudentFromSlot(this.planId, slotId, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_SESSION_SUCCESS', { name: studentName }));
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || this.translate.instant('WEEKLY_PLANS.MESSAGES.RESTORE_STUDENT_SESSION_ERROR'));
      },
      complete: () => {
        this.restoringAttendance.delete(opKey);
        this.cdr.detectChanges();
      }
    });
  }

  hasCancelledSlots(dayOfWeek: number): boolean {
    return (this.slotsByDay[dayOfWeek] || []).some(slot => slot.status === 'CANCELLED');
  }

  hasCancelledStudentInDay(studentId: number, dayOfWeek: number): boolean {
    return (this.plan?.slots || []).some(slot =>
      slot.dayOfWeek === dayOfWeek
      && (slot.students || []).some(student => student.studentId === studentId && student.status === 'CANCELLED')
    );
  }

  hasActiveStudentInDay(studentId: number, dayOfWeek: number): boolean {
    return (this.plan?.slots || []).some(slot =>
      slot.dayOfWeek === dayOfWeek
      && slot.status !== 'CANCELLED'
      && (slot.students || []).some(student => student.studentId === studentId && student.status !== 'CANCELLED')
    );
  }

  getCancelledStudentsSummary(): WeeklyPlanCancelledStudentItem[] {
    if (!this.plan?.slots?.length) {
      return [];
    }

    const items: WeeklyPlanCancelledStudentItem[] = [];
    for (const slot of this.plan.slots) {
      for (const student of slot.students || []) {
        if (student.status !== 'CANCELLED') continue;
        items.push({
          slotId: slot.id,
          sortOrder: slot.sortOrder,
          dayOfWeek: slot.dayOfWeek,
          dayLabel: this.getDayLabel(slot.dayOfWeek),
          recipeName: slot.recipeName,
          studentId: student.studentId,
          studentName: student.studentName
        });
      }
    }

    return items.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName, 'es');
      return a.sortOrder - b.sortOrder;
    });
  }

  toggleAttendanceStudent(studentId: number): void {
    if (this.expandedAttendanceStudents.has(studentId)) {
      this.expandedAttendanceStudents.delete(studentId);
    } else {
      this.expandedAttendanceStudents.add(studentId);
    }
  }

  isAttendanceStudentExpanded(studentId: number): boolean {
    return this.expandedAttendanceStudents.has(studentId);
  }

  toggleAttendanceDay(studentId: number, dayOfWeek: number): void {
    const key = `${studentId}-${dayOfWeek}`;
    if (this.expandedAttendanceDays.has(key)) {
      this.expandedAttendanceDays.delete(key);
    } else {
      this.expandedAttendanceDays.add(key);
    }
  }

  isAttendanceDayExpanded(studentId: number, dayOfWeek: number): boolean {
    return this.expandedAttendanceDays.has(`${studentId}-${dayOfWeek}`);
  }

  canManageAttendanceCancellation(): boolean {
    return this.plan?.status !== 'DRAFT';
  }

  private getBaseRoute(): string {
    return this.router.url.startsWith('/admin-panel/weekly-plans')
      ? '/admin-panel/weekly-plans'
      : '/weekly-plans';
  }

  isSessionConfirmed(slotId: number): boolean {
    return (this.plan?.slots || []).some(s => s.id === slotId && s.status === 'CONFIRMED');
  }

  isDayConfirmedSome(dayOfWeek: number): boolean {
    return (this.plan?.slots || []).some(s => s.dayOfWeek === dayOfWeek && s.status === 'CONFIRMED');
  }

  hasActionableSlots(dayOfWeek: number): boolean {
    return (this.slotsByDay[dayOfWeek] || []).some(s => (s.status === 'PENDING' || s.status === 'IN_PROGRESS') && this.isSlotActionable(s));
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: this.translate.instant('WEEKLY_PLANS.STATUS.DRAFT'),
      ACTIVE: this.translate.instant('WEEKLY_PLANS.STATUS.ACTIVE'),
      IN_PROGRESS: this.translate.instant('WEEKLY_PLANS.STATUS.IN_PROGRESS'),
      COMPLETED: this.translate.instant('WEEKLY_PLANS.STATUS.COMPLETED'),
      CANCELLED: this.translate.instant('WEEKLY_PLANS.STATUS.CANCELLED')
    };

    return labels[status] || status;
  }

  getDayLabel(dayOfWeek: number): string {
    return this.translate.instant(this.days.find(day => day.value === dayOfWeek)?.label || `COMMON.DAYS.DAY_${dayOfWeek}`);
  }

  getSlotsForStudentAndDay(studentId: number, dayOfWeek: number): WeeklyPlanSlotResponse[] {
    return (this.plan?.slots || []).filter(slot => 
      slot.dayOfWeek === dayOfWeek && 
      slot.status !== 'CANCELLED' &&
      (slot.students || []).some(student => student.studentId === studentId && student.status !== 'CANCELLED')
    );
  }

  getActiveStudents(slot: WeeklyPlanSlotResponse): WeeklyPlanSlotStudentResponse[] {
    return (slot.students || []).filter(s => s.status !== 'CANCELLED');
  }

}

interface WeeklyPlanStudentRosterSlot {
  id: number;
  recipeName: string;
  startTime: string;
  endTime: string;
  status: string;
  studentStatus: string;
  sortOrder: number;
}

interface WeeklyPlanStudentRosterDay {
  dayOfWeek: number;
  dayLabel: string;
  slotIds: number[];
  slotSummaries: WeeklyPlanStudentRosterSlot[];
}

interface WeeklyPlanStudentRosterRow {
  studentId: number;
  studentName: string;
  totalAssignments: number;
  days: WeeklyPlanStudentRosterDay[];
}

interface WeeklyPlanRepositionOrderItem extends WeeklyPlanStockRequirement {
  unit: string;
  unitPrice: number;
  supplierId: number | null;
  supplierName: string | null;
  orderQuantity: number;
  customQuantity?: number;
}

interface WeeklyPlanRepositionOrderGroup {
  id: number;
  title: string;
  supplierId: number | null;
  items: WeeklyPlanRepositionOrderItem[];
}

interface WeeklyPlanPoolSupplierSection {
  key: string;
  label: string;
  items: WeeklyPlanRepositionOrderItem[];
}

interface WeeklyPlanCancelledStudentItem {
  slotId: number;
  sortOrder: number;
  dayOfWeek: number;
  dayLabel: string;
  recipeName: string;
  studentId: number;
  studentName: string;
}
