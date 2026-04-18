import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { MessageService } from '../../../core/services/message.service';
import { WeeklyPlanProductPendingOrder, WeeklyPlanResponse, WeeklyPlanSlotResponse, WeeklyPlanSlotStudentResponse, WeeklyPlanStockRequirement } from '../../../shared/models/weekly-plan.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { Supplier } from '../../../shared/models/supplier.model';

@Component({
  selector: 'app-weekly-plan-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './weekly-plan-detail.component.html',
  styleUrls: ['./weekly-plan-detail.component.css']
})
export class WeeklyPlanDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private weeklyPlanService = inject(WeeklyPlanService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private supplierService = inject(SupplierService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);

  planId: number | null = null;
  plan: WeeklyPlanResponse | null = null;
  loading = true;
  downloadingPdf = false;
  activatingPlan = false;
  deactivatingPlan = false;
  
  activeTab: 'tablero' | 'stock' | 'asistencia' = 'tablero';
  
  days = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' }
  ];

  collapsedDays = new Set<number>();
  selectedDayTab = 1; // Default to Monday (1)
  activeDayMenu: number | null = null;

  stockRequirements: WeeklyPlanStockRequirement[] = [];
  loadingStock = false;
  showStockOrderModal = false;
  loadingStockOrderData = false;
  creatingStockOrders = false;
  stockOrderItems: WeeklyPlanRepositionOrderItem[] = [];
  stockOrderGroups: WeeklyPlanRepositionOrderGroup[] = [];
  suppliers: Supplier[] = [];
  loadingSuppliers = false;
  private nextStockOrderGroupId = 1;
  private draggedStockOrderItem: WeeklyPlanRepositionOrderItem | null = null;
  private draggedStockOrderSource: number | 'pool' | null = null;
  private draggedStockOrderItems: WeeklyPlanRepositionOrderItem[] = [];
  roundUpStockOrderQuantities = false;
  showCustomQuantities = false;
  stockOrderBuilderDirty = false;
  stockOrderSearchTerm = '';
  stockSearchTerm = '';
  attendanceSearchTerm = '';
  collapsedStockPoolSuppliers = new Set<string>();
  selectedStockOrderItemIds = new Set<number>();
  lastSelectedStockOrderItemId: number | null = null;
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
  }

  loadPlan() {
    if (!this.planId) return;
    this.loading = true;
    this.weeklyPlanService.getPlanById(this.planId).subscribe({
      next: (plan) => {
        this.plan = plan;
        
        // Dynamic days based on plan slots (add Sat/Sun if they exist)
        const activeDays = new Set(this.plan.slots.map(s => s.dayOfWeek));
        if (activeDays.has(6) && !this.days.find(d => d.value === 6)) this.days.push({ value: 6, label: 'Sábado' });
        if (activeDays.has(7) && !this.days.find(d => d.value === 7)) this.days.push({ value: 7, label: 'Domingo' });
        this.days.sort((a, b) => a.value - b.value);

        this.loading = false;
        this.cdr.detectChanges();
        
        if (this.activeTab === 'stock') {
          this.loadStock();
        }
      },
      error: () => {
        this.loading = false;
        this.messageService.showError('No se pudo cargar el plan semanal.');
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
        this.messageService.showError('No se pudo cargar el inventario necesario.');
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
      statuses: ['CREATED', 'PENDING', 'REVIEW']
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
      const aCovered = this.getUncoveredStockShortage(a) === 0;
      const bCovered = this.getUncoveredStockShortage(b) === 0;

      if (aCovered !== bCovered) {
        return aCovered ? 1 : -1;
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
    return Math.max(0, requirement.requiredQuantity - this.getRealAvailableStock(requirement));
  }

  getRealAvailableStock(requirement: WeeklyPlanStockRequirement): number {
    return Math.max(0, (requirement.availableStock || 0) - (requirement.reservedByOtherPlans || 0));
  }

  getUncoveredStockShortage(requirement: WeeklyPlanStockRequirement): number {
    return Math.max(0, this.getStockShortage(requirement) - this.getPendingOrderQuantity(requirement));
  }

  canCreateStockOrder(): boolean {
    return this.getRequirementsNeedingReplenishment().length > 0;
  }

  private getRequirementsNeedingReplenishment(): WeeklyPlanStockRequirement[] {
    return this.stockRequirements.filter(requirement => this.getUncoveredStockShortage(requirement) > 0);
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

  downloadPlanPdf() {
    if (!this.planId || this.downloadingPdf) return;

    this.downloadingPdf = true;
    this.weeklyPlanService.downloadPlanPdf(this.planId).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.messageService.showError('No se pudo generar el PDF del plan.');
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
        this.messageService.showError(err.error?.message || 'No se pudo descargar el plan semanal en PDF.');
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
      'Activar plan',
      'Al activar el plan quedará listo para confirmar sesiones. ¿Deseas continuar?',
      'Activar',
      'Cancelar'
    );
    if (!confirmed) return;

    this.activatingPlan = true;
    this.weeklyPlanService.activatePlan(this.planId).subscribe({
      next: () => {
        this.messageService.showSuccess('Plan activado correctamente.');
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo activar el plan.');
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
      'Volver a borrador',
      'El plan volverá a estado borrador. Esta acción se bloqueará si existen sesiones confirmadas. ¿Deseas continuar?',
      'Volver a borrador',
      'Cancelar'
    );
    if (!confirmed) return;

    this.deactivatingPlan = true;
    this.weeklyPlanService.deactivatePlan(this.planId).subscribe({
      next: () => {
        this.messageService.showSuccess('Plan pasado a borrador correctamente.');
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo pasar el plan a borrador.');
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
      this.messageService.showInfo('No hay faltantes pendientes por cubrir. Los pedidos ya creados cubren la reposición necesaria.');
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
        supplierId: product.supplier?.id ?? null,
        supplierName: product.supplier?.name ?? null,
        orderQuantity: this.getUncoveredStockShortage(requirement)
      } satisfies WeeklyPlanRepositionOrderItem;
    });

    Promise.all(requests)
      .then(items => {
        this.stockOrderItems = items;
        this.stockOrderGroups = [this.createStockOrderGroup()];
        this.stockOrderSearchTerm = '';
        this.collapsedStockPoolSuppliers.clear();
        this.stockOrderBuilderDirty = false;

        this.showStockOrderModal = true;
      })
      .catch(() => this.messageService.showError('No se pudo preparar la orden de reposición.'))
      .finally(() => {
        this.loadingStockOrderData = false;
        this.cdr.detectChanges();
      });
  }

  closeStockOrderModal(): void {
    this.showStockOrderModal = false;
    this.stockOrderItems = [];
    this.stockOrderGroups = [];
    this.roundUpStockOrderQuantities = false;
    this.showCustomQuantities = false;
    this.stockOrderSearchTerm = '';
    this.collapsedStockPoolSuppliers.clear();
    this.selectedStockOrderItemIds.clear();
    this.lastSelectedStockOrderItemId = null;
    this.draggedStockOrderItem = null;
    this.draggedStockOrderSource = null;
    this.draggedStockOrderItems = [];
    this.nextStockOrderGroupId = 1;
    this.stockOrderBuilderDirty = false;
  }

  async beforeCloseStockOrderModal(): Promise<boolean> {
    if (!this.stockOrderBuilderDirty) {
      return true;
    }

    return this.messageService.confirm(
      'Descartar cambios',
      'Tienes cambios sin guardar en la orden de reposicion. Si cierras ahora, se perderan. ¿Deseas salir?',
      'Descartar',
      'Seguir editando'
    );
  }

  onRoundUpStockOrderQuantitiesChange(enabled: boolean): void {
    this.roundUpStockOrderQuantities = enabled;
    this.markStockOrderBuilderDirty();
  }

  onShowCustomStockQuantitiesChange(enabled: boolean): void {
    if (enabled) {
      this.initializeStockOrderCustomQuantitiesFromCurrent();
    }

    this.showCustomQuantities = enabled;
    this.markStockOrderBuilderDirty();
  }

  onStockOrderQuantityInputChange(): void {
    this.markStockOrderBuilderDirty();
  }

  onStockOrderGroupSupplierChange(): void {
    this.markStockOrderBuilderDirty();
  }

  private initializeStockOrderCustomQuantitiesFromCurrent(): void {
    const allItems = [...this.stockOrderItems, ...this.stockOrderGroups.flatMap(group => group.items)];

    for (const item of allItems) {
      if (item.customQuantity === undefined) {
        item.customQuantity = this.getStockOrderQuantity(item);
      }
    }
  }

  private markStockOrderBuilderDirty(): void {
    if (this.showStockOrderModal) {
      this.stockOrderBuilderDirty = true;
    }
  }

  private createStockOrderGroup(): WeeklyPlanRepositionOrderGroup {
    const groupId = this.nextStockOrderGroupId++;
    return {
      id: groupId,
      title: `Pedido ${groupId}`,
      supplierId: null,
      items: []
    };
  }

  addStockOrderGroup(): void {
    this.stockOrderGroups = [this.createStockOrderGroup(), ...this.stockOrderGroups];
    this.reindexStockOrderGroups();
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
  }

  removeStockOrderGroup(groupId: number): void {
    const target = this.stockOrderGroups.find(group => group.id === groupId);
    if (!target) return;

    this.stockOrderItems = [...this.stockOrderItems, ...target.items];
    this.stockOrderGroups = this.stockOrderGroups.filter(group => group.id !== groupId);
    if (this.stockOrderGroups.length === 0) {
      this.stockOrderGroups = [this.createStockOrderGroup()];
    }
    this.reindexStockOrderGroups();
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
  }

  private reindexStockOrderGroups(): void {
    this.stockOrderGroups = this.stockOrderGroups.map((group, index) => ({
      ...group,
      title: `Pedido ${index + 1}`
    }));
  }

  onStockOrderDragStart(event: DragEvent, item: WeeklyPlanRepositionOrderItem, source: 'pool' | number): void {
    this.draggedStockOrderItem = item;
    this.draggedStockOrderSource = source;
    this.draggedStockOrderItems = this.resolveDraggedStockOrderItems(item, source);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(item.productId));
    }
  }

  onStockOrderDragEnd(): void {
    this.draggedStockOrderItem = null;
    this.draggedStockOrderSource = null;
    this.draggedStockOrderItems = [];
  }

  allowStockOrderDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  dropStockOrderOnGroup(event: DragEvent, groupId: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggedStockOrderItem) return;

    const targetGroup = this.stockOrderGroups.find(group => group.id === groupId);
    if (!targetGroup) return;

    const itemsToMove = this.draggedStockOrderItems.length ? this.draggedStockOrderItems : [this.draggedStockOrderItem];
    this.removeDraggedStockOrderItemsFromSource(itemsToMove);
    targetGroup.items = [...targetGroup.items, ...itemsToMove.filter(item => !targetGroup.items.some(existing => existing.productId === item.productId))];
    if (!targetGroup.supplierId && itemsToMove[0]?.supplierId) {
      targetGroup.supplierId = itemsToMove[0].supplierId;
    }
    this.draggedStockOrderItem = null;
    this.draggedStockOrderSource = null;
    this.draggedStockOrderItems = [];
    this.clearStockOrderSelection();
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
  }

  dropStockOrderOnPool(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggedStockOrderItem) return;

    const itemsToMove = this.draggedStockOrderItems.length ? this.draggedStockOrderItems : [this.draggedStockOrderItem];
    this.removeDraggedStockOrderItemsFromSource(itemsToMove);
    this.stockOrderItems = [...this.stockOrderItems, ...itemsToMove.filter(item => !this.stockOrderItems.some(existing => existing.productId === item.productId))];
    this.draggedStockOrderItem = null;
    this.draggedStockOrderSource = null;
    this.draggedStockOrderItems = [];
    this.clearStockOrderSelection();
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
  }

  moveStockItemToPool(item: WeeklyPlanRepositionOrderItem, groupId: number): void {
    const group = this.stockOrderGroups.find(entry => entry.id === groupId);
    if (!group) return;

    group.items = group.items.filter(entry => entry.productId !== item.productId);
    this.stockOrderItems = [...this.stockOrderItems, item];
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
  }

  private removeDraggedStockOrderItemsFromSource(items: WeeklyPlanRepositionOrderItem[]): void {
    if (!items.length) return;
    const productIds = new Set(items.map(item => item.productId));

    if (this.draggedStockOrderSource === 'pool') {
      this.stockOrderItems = this.stockOrderItems.filter(item => !productIds.has(item.productId));
      return;
    }

    if (typeof this.draggedStockOrderSource === 'number') {
      const sourceGroup = this.stockOrderGroups.find(group => group.id === this.draggedStockOrderSource);
      if (sourceGroup) {
        sourceGroup.items = sourceGroup.items.filter(item => !productIds.has(item.productId));
      }
    }
  }

  private resolveDraggedStockOrderItems(item: WeeklyPlanRepositionOrderItem, source: 'pool' | number): WeeklyPlanRepositionOrderItem[] {
    if (!this.selectedStockOrderItemIds.has(item.productId)) {
      return [item];
    }

    const sourceItems = source === 'pool'
      ? this.stockOrderItems
      : (this.stockOrderGroups.find(group => group.id === source)?.items || []);
    const selected = sourceItems.filter(entry => this.selectedStockOrderItemIds.has(entry.productId));
    return selected.length ? selected : [item];
  }

  isStockOrderItemSelected(productId: number): boolean {
    return this.selectedStockOrderItemIds.has(productId);
  }

  toggleStockOrderItemSelection(item: WeeklyPlanRepositionOrderItem, event?: MouseEvent): void {
    const sourceItems = this.findStockOrderItemSource(item.productId);
    if (!sourceItems) return;

    const clickedIndex = sourceItems.findIndex(entry => entry.productId === item.productId);
    const shiftKey = !!event?.shiftKey;
    if (shiftKey && this.lastSelectedStockOrderItemId !== null) {
      const lastIndex = sourceItems.findIndex(entry => entry.productId === this.lastSelectedStockOrderItemId);
      if (lastIndex !== -1 && clickedIndex !== -1) {
        const start = Math.min(lastIndex, clickedIndex);
        const end = Math.max(lastIndex, clickedIndex);
        for (let i = start; i <= end; i += 1) {
          this.selectedStockOrderItemIds.add(sourceItems[i].productId);
        }
        return;
      }
    }

    if (this.selectedStockOrderItemIds.has(item.productId)) {
      this.selectedStockOrderItemIds.delete(item.productId);
    } else {
      this.selectedStockOrderItemIds.add(item.productId);
    }
    this.lastSelectedStockOrderItemId = item.productId;
  }

  onStockOrderItemCheckboxChange(item: WeeklyPlanRepositionOrderItem, event: Event): void {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedStockOrderItemIds.add(item.productId);
      this.lastSelectedStockOrderItemId = item.productId;
    } else {
      this.selectedStockOrderItemIds.delete(item.productId);
      if (this.lastSelectedStockOrderItemId === item.productId) {
        this.lastSelectedStockOrderItemId = null;
      }
    }
  }

  clearStockOrderSelection(): void {
    this.selectedStockOrderItemIds.clear();
    this.lastSelectedStockOrderItemId = null;
  }

  getSelectedStockOrderCount(): number {
    return this.selectedStockOrderItemIds.size;
  }

  private findStockOrderItemSource(productId: number): WeeklyPlanRepositionOrderItem[] | null {
    if (this.stockOrderItems.some(item => item.productId === productId)) {
      return this.stockOrderItems;
    }

    const group = this.stockOrderGroups.find(entry => entry.items.some(item => item.productId === productId));
    return group?.items || null;
  }

  getStockOrderGroupTotal(group: WeeklyPlanRepositionOrderGroup): number {
    return group.items.reduce((sum, item) => sum + (this.getStockOrderQuantity(item) * (item.unitPrice || 0)), 0);
  }

  getStockOrderGrandTotal(): number {
    return this.stockOrderGroups.reduce((sum, group) => sum + this.getStockOrderGroupTotal(group), 0);
  }

  getPendingStockOrderCount(): number {
    return this.stockOrderItems.length;
  }

  getAssignedStockOrderCount(): number {
    return this.stockOrderGroups.reduce((sum, group) => sum + group.items.length, 0);
  }

  getStockPoolSupplierSections(): WeeklyPlanPoolSupplierSection[] {
    const term = this.stockOrderSearchTerm.trim().toLowerCase();
    const filtered = term
      ? this.stockOrderItems.filter(item => item.productName.toLowerCase().includes(term) || (item.supplierName || '').toLowerCase().includes(term))
      : this.stockOrderItems;

    const grouped = new Map<string, WeeklyPlanPoolSupplierSection>();
    for (const item of filtered) {
      const supplierKey = item.supplierId ? String(item.supplierId) : 'none';
      const section = grouped.get(supplierKey);
      if (section) {
        section.items.push(item);
        continue;
      }

      grouped.set(supplierKey, {
        key: supplierKey,
        label: item.supplierName || 'Sin proveedor',
        items: [item]
      });
    }

    return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  toggleStockPoolSupplierCollapse(key: string): void {
    if (this.collapsedStockPoolSuppliers.has(key)) {
      this.collapsedStockPoolSuppliers.delete(key);
    } else {
      this.collapsedStockPoolSuppliers.add(key);
    }
  }

  isStockPoolSupplierCollapsed(key: string): boolean {
    return this.collapsedStockPoolSuppliers.has(key);
  }

  getVisibleStockPoolItemsCount(): number {
    return this.getStockPoolSupplierSections().reduce((sum, section) => sum + section.items.length, 0);
  }

  getStockOrderQuantity(item: WeeklyPlanRepositionOrderItem): number {
    if (this.showCustomQuantities && item.customQuantity !== undefined) {
      return item.customQuantity;
    }
    const quantity = item.orderQuantity;
    return this.roundUpStockOrderQuantities ? Math.ceil(quantity) : quantity;
  }

  async createCompleteStockOrderBySupplier(): Promise<void> {
    if (!this.stockOrderItems.length) {
      this.messageService.showInfo('No hay productos pendientes para agrupar.');
      return;
    }

    const confirmed = await this.messageService.confirm(
      'Crear orden completa',
      'Se agruparán los productos pendientes por proveedor y se añadirán como nuevas órdenes. ¿Continuar?',
      'Crear órdenes',
      'Cancelar'
    );
    if (!confirmed) return;

    const groupedBySupplier = new Map<number | null, WeeklyPlanRepositionOrderItem[]>();
    for (const item of this.stockOrderItems) {
      const key = item.supplierId ?? null;
      const bucket = groupedBySupplier.get(key) || [];
      bucket.push(item);
      groupedBySupplier.set(key, bucket);
    }

    const generatedGroups: WeeklyPlanRepositionOrderGroup[] = Array.from(groupedBySupplier.entries()).map(([supplierId, items]) => {
      const group = this.createStockOrderGroup();
      return {
        ...group,
        supplierId,
        items: [...items]
      };
    });

    const nonEmptyExistingGroups = this.stockOrderGroups.filter(group => group.items.length > 0);
    this.stockOrderGroups = [...generatedGroups, ...nonEmptyExistingGroups];
    if (this.stockOrderGroups.length === 0) {
      this.stockOrderGroups = [this.createStockOrderGroup()];
    }
    this.stockOrderItems = [];
    this.reindexStockOrderGroups();
    this.clearStockOrderSelection();
    this.markStockOrderBuilderDirty();
    this.cdr.detectChanges();
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
    const payloads = this.buildStockOrderPayloads();
    if (!payloads.length) {
      this.messageService.showError('Asigna los productos a al menos una orden con cantidades válidas.');
      return;
    }

    if (this.stockOrderItems.length > 0) {
      this.messageService.showError('Mueve todos los productos a una orden antes de crearla.');
      return;
    }

    const totalOrders = payloads.length;
    const totalItems = payloads.reduce((sum, payload) => sum + payload.details.length, 0);
    const confirmed = await this.messageService.confirm(
      'Confirmar órdenes de reposición',
      `Se crearán ${totalOrders} orden${totalOrders > 1 ? 'es' : ''} con ${totalItems} producto${totalItems > 1 ? 's' : ''}. ¿Continuar?`,
      'Confirmar órdenes',
      'Cancelar'
    );

    if (!confirmed) return;

    this.creatingStockOrders = true;
    forkJoin(payloads.map(payload => this.orderService.create(payload))).subscribe({
      next: () => {
        this.messageService.showSuccess('Órdenes creadas correctamente');
        this.stockOrderBuilderDirty = false;
        this.closeStockOrderModal();
        this.loadStock();
      },
      error: (err: any) => {
        this.messageService.showError(err.error?.message || 'Error al crear las órdenes');
      },
      complete: () => {
        this.creatingStockOrders = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildStockOrderPayloads(): any[] {
    const userId = this.plan?.chefId || 1;

    return this.stockOrderGroups
      .map(group => {
        const details = group.items
          .map(item => ({
            productId: item.productId,
            quantity: this.getStockOrderQuantity(item),
            unitPrice: item.unitPrice || 0
          }))
          .filter(detail => detail.quantity > 0);

        return {
          userId,
          supplierId: group.supplierId || undefined,
          details
        };
      })
      .filter(payload => payload.details.length > 0);
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
      'Confirmar sesión',
      `¿Quieres confirmar la sesión ${slot.sortOrder + 1}?`,
      'Confirmar sesión',
      'Cancelar'
    );
    if (!confirmed) {
      return;
    }

    this.weeklyPlanService.confirmSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Sesión confirmada correctamente.');
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al confirmar la sesión.')
    });
  }

  async cancelSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;
    const confirmed = await this.messageService.confirm(
      'Cancelar sesión',
      `Esta acción eliminará la sesión ${slot.sortOrder + 1}. ¿Deseas continuar?`,
      'Cancelar sesión',
      'Volver'
    );
    if (!confirmed) {
      return;
    }

    this.weeklyPlanService.cancelSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showInfo('Sesión cancelada.');
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al cancelar la sesión.')
    });
  }

  async restoreSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;

    const confirmed = await this.messageService.confirm(
      'Restaurar sesión',
      `La sesión ${slot.sortOrder + 1} volverá a estado pendiente. ¿Deseas continuar?`,
      'Restaurar sesión',
      'Volver'
    );
    if (!confirmed) return;

    this.weeklyPlanService.restoreSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess('Sesión restaurada correctamente.');
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al restaurar la sesión.')
    });
  }

  async unconfirmSlot(slot: WeeklyPlanSlotResponse) {
    if (!this.planId) return;

    const confirmed = await this.messageService.confirm(
      'Revertir confirmación',
      `Se anulará el registro de cocinado y se restaurará el stock de ${slot.recipeName}. ¿Deseas continuar?`,
      'Revertir',
      'Cancelar'
    );

    if (!confirmed) return;

    this.weeklyPlanService.unconfirmSlot(this.planId, slot.id).subscribe({
      next: () => {
        this.messageService.showSuccess(`Confirmación revertida correctamente.`);
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al revertir la confirmación.')
    });
  }

  async confirmDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      'Confirmar día completo',
      `Se confirmarán todas las sesiones del ${dayName} y se descontará el stock correspondiente. ¿Deseas continuar?`,
      'Confirmar todo',
      'Cancelar'
    );

    if (!confirmed) return;

    this.weeklyPlanService.confirmDay(this.planId, dayOfWeek).subscribe({
      next: (res) => {
        this.messageService.showSuccess(`Día ${dayName} confirmado correctamente.`);
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al confirmar el día.')
    });
  }

  async unconfirmDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      'Revertir confirmación del día',
      `Se anularán todas las sesiones confirmadas del ${dayName} y se restaurará el stock. ¿Deseas continuar?`,
      'Revertir todo',
      'Cancelar'
    );

    if (!confirmed) return;

    this.weeklyPlanService.unconfirmDay(this.planId, dayOfWeek).subscribe({
      next: () => {
        this.messageService.showSuccess(`Confirmaciones del ${dayName} revertidas correctamente.`);
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al revertir las confirmaciones del día.')
    });
  }

  async restoreDay(dayOfWeek: number) {
    if (!this.planId) return;

    const dayName = this.getDayLabel(dayOfWeek);
    const confirmed = await this.messageService.confirm(
      'Restaurar sesiones canceladas',
      `Se restaurarán las sesiones canceladas del ${dayName}. ¿Deseas continuar?`,
      'Restaurar',
      'Cancelar'
    );

    if (!confirmed) return;

    this.weeklyPlanService.restoreDay(this.planId, dayOfWeek).subscribe({
      next: () => {
        this.messageService.showSuccess(`Sesiones canceladas del ${dayName} restauradas.`);
        this.loadPlan();
      },
      error: (err) => this.messageService.showError(err.error?.message || 'Error al restaurar las sesiones canceladas del día.')
    });
  }

  async cancelStudentFromDay(studentId: number, studentName: string, dayOfWeek: number) {
    if (!this.planId) return;

    const opKey = `${studentId}-${dayOfWeek}`;
    if (this.cancellingAttendance.has(opKey)) return;

    const confirmed = await this.messageService.confirm(
      'Cancelar alumno del día',
      `Se quitará a ${studentName} de todo el ${this.getDayLabel(dayOfWeek)} sin afectar al resto de alumnos. ¿Deseas continuar?`,
      'Cancelar alumno',
      'Volver'
    );

    if (!confirmed) {
      return;
    }

    this.cancellingAttendance.add(opKey);
    this.weeklyPlanService.cancelStudentFromDay(this.planId, dayOfWeek, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(`${studentName} cancelado del día correctamente.`);
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo cancelar al alumno del día.');
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
      'Restaurar alumno del día',
      `Se restaurará a ${studentName} en las sesiones canceladas del ${this.getDayLabel(dayOfWeek)}. ¿Deseas continuar?`,
      'Restaurar',
      'Volver'
    );

    if (!confirmed) {
      return;
    }

    this.restoringAttendance.add(opKey);
    this.weeklyPlanService.restoreStudentFromDay(this.planId, dayOfWeek, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(`${studentName} restaurado en el día correctamente.`);
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo restaurar al alumno en el día.');
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
      'Cancelar sesión al alumno',
      `Se quitará a ${studentName} de la sesión ${sortOrder + 1} (${recipeName}) sin afectar sus otras sesiones. ¿Deseas continuar?`,
      'Cancelar sesión',
      'Volver'
    );

    if (!confirmed) {
      return;
    }

    this.cancellingAttendance.add(opKey);
    this.weeklyPlanService.cancelStudentFromSlot(this.planId, slotId, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(`${studentName} cancelado de la sesión correctamente.`);
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo cancelar al alumno de la sesión.');
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
      'Restaurar sesión al alumno',
      `Se restaurará a ${studentName} en la sesión ${sortOrder + 1} (${recipeName}). ¿Deseas continuar?`,
      'Restaurar',
      'Volver'
    );

    if (!confirmed) {
      return;
    }

    this.restoringAttendance.add(opKey);
    this.weeklyPlanService.restoreStudentFromSlot(this.planId, slotId, studentId).subscribe({
      next: () => {
        this.messageService.showSuccess(`${studentName} restaurado en la sesión correctamente.`);
        this.loadPlan();
      },
      error: (err) => {
        this.messageService.showError(err.error?.message || 'No se pudo restaurar al alumno en la sesión.');
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
      DRAFT: 'Borrador',
      ACTIVE: 'Activo',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status] || status;
  }

  getDayLabel(dayOfWeek: number): string {
    return this.days.find(day => day.value === dayOfWeek)?.label || `Día ${dayOfWeek}`;
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
