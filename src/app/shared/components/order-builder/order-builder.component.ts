import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { Supplier } from '../../models/supplier.model';
import { WeeklyPlanRepositionOrderGroup, WeeklyPlanRepositionOrderItem, WeeklyPlanPoolSupplierSection } from '../../models/weekly-plan.model';

@Component({
  selector: 'app-order-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './order-builder.component.html',
  styleUrls: ['./order-builder.component.css']
})
export class OrderBuilderComponent implements OnInit {
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  @Input() stockOrderItems: WeeklyPlanRepositionOrderItem[] = [];
  @Input() suppliers: Supplier[] = [];
  @Input() userId: number = 1;
  @Input() hideStockInfo: boolean = false;
  @Input() quantityOverride?: (item: WeeklyPlanRepositionOrderItem) => number;
  @Input() refreshTrigger?: any;
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  stockOrderGroups: WeeklyPlanRepositionOrderGroup[] = [];
  roundUpStockOrderQuantities = false;
  roundingMode: 'lots' | 'units' = 'lots';
  showCustomQuantities = false;
  stockOrderSearchTerm = '';
  collapsedStockPoolSuppliers = new Set<string>();
  selectedStockOrderItemIds = new Set<number>();
  lastSelectedStockOrderItemId: number | null = null;
  creatingStockOrders = false;
  stockOrderBuilderDirty = false;

  private nextStockOrderGroupId = 1;
  private draggedStockOrderItem: WeeklyPlanRepositionOrderItem | null = null;
  private draggedStockOrderSource: number | 'pool' | null = null;
  private draggedStockOrderItems: WeeklyPlanRepositionOrderItem[] = [];

  ngOnInit(): void {
    if (this.stockOrderGroups.length === 0) {
      this.stockOrderGroups = [this.createStockOrderGroup()];
    }
  }

  getPendingStockOrderCount(): number {
    return this.stockOrderItems.length;
  }

  getAssignedStockOrderCount(): number {
    return this.stockOrderGroups.reduce((acc, group) => acc + group.items.length, 0);
  }

  getSelectedStockOrderCount(): number {
    return this.selectedStockOrderItemIds.size;
  }

  onRoundUpStockOrderQuantitiesChange(enabled: boolean): void {
    this.roundUpStockOrderQuantities = enabled;
    if (enabled && this.roundingMode === 'lots') {
      this.roundingMode = 'units';
    }
    this.stockOrderBuilderDirty = true;
  }

  onRoundingModeChange(mode: 'units' | 'lots'): void {
    this.roundingMode = mode;
    if (mode === 'lots') {
      this.roundUpStockOrderQuantities = false;
    }
    this.stockOrderBuilderDirty = true;
  }

  onShowCustomStockQuantitiesChange(enabled: boolean): void {
    if (enabled) {
      this.initializeStockOrderCustomQuantitiesFromCurrent(true);
    }
    this.showCustomQuantities = enabled;
    this.stockOrderBuilderDirty = true;
  }

  onStockOrderQuantityInputChange(): void {
    this.stockOrderBuilderDirty = true;
  }

  onStockOrderGroupSupplierChange(): void {
    this.stockOrderBuilderDirty = true;
  }

  private initializeStockOrderCustomQuantitiesFromCurrent(force: boolean = false): void {
    const allItems = [...this.stockOrderItems, ...this.stockOrderGroups.flatMap(group => group.items)];
    for (const item of allItems) {
      if (item.customQuantity === undefined || force) {
        // We use a temporary flag to ensure getStockOrderQuantity doesn't return the OLD customQuantity
        // But since showCustomQuantities is still false in the moment of enabling (or we can handle it),
        // we just ensure it gets the calculated value.
        const originalVal = this.showCustomQuantities;
        this.showCustomQuantities = false; 
        item.customQuantity = this.getStockOrderQuantity(item);
        this.showCustomQuantities = originalVal;
      }
    }
  }

  private createStockOrderGroup(): WeeklyPlanRepositionOrderGroup {
    const groupId = this.nextStockOrderGroupId++;
    return {
      id: groupId,
      title: this.translate.instant('ORDER_BUILDER.TABLE.ORDER_TITLE', { num: groupId }),
      supplierId: null,
      items: []
    };
  }

  addStockOrderGroup(): void {
    this.stockOrderGroups = [this.createStockOrderGroup(), ...this.stockOrderGroups];
    this.reindexStockOrderGroups();
    this.stockOrderBuilderDirty = true;
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
    this.stockOrderBuilderDirty = true;
    this.cdr.detectChanges();
  }

  private reindexStockOrderGroups(): void {
    this.stockOrderGroups = this.stockOrderGroups.map((group, index) => ({
      ...group,
      title: this.translate.instant('ORDER_BUILDER.TABLE.ORDER_TITLE', { num: index + 1 })
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
    this.stockOrderBuilderDirty = true;
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
    this.stockOrderBuilderDirty = true;
    this.cdr.detectChanges();
  }

  moveStockItemToPool(item: WeeklyPlanRepositionOrderItem, groupId: number): void {
    const group = this.stockOrderGroups.find(entry => entry.id === groupId);
    if (!group) return;

    group.items = group.items.filter(entry => entry.productId !== item.productId);
    this.stockOrderItems = [...this.stockOrderItems, item];
    this.stockOrderBuilderDirty = true;
    this.cdr.detectChanges();
  }

  private removeDraggedStockOrderItemsFromSource(items: WeeklyPlanRepositionOrderItem[]): void {
    if (!items.length) return;
    const productIds = new Set(items.map(item => item.productId));

    if (this.draggedStockOrderSource === 'pool') {
      this.stockOrderItems = this.stockOrderItems.filter(item => !productIds.has(item.productId));
    } else if (typeof this.draggedStockOrderSource === 'number') {
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
    const sourceItems = source === 'pool' ? this.stockOrderItems : (this.stockOrderGroups.find(group => group.id === source)?.items || []);
    const selected = sourceItems.filter(entry => this.selectedStockOrderItemIds.has(entry.productId));
    return selected.length ? selected : [item];
  }

  isStockOrderItemSelected(productId: number): boolean {
    return this.selectedStockOrderItemIds.size > 0 && this.selectedStockOrderItemIds.has(productId);
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
      this.lastSelectedStockOrderItemId = item.productId;
    }
  }

  onStockOrderItemCheckboxChange(item: WeeklyPlanRepositionOrderItem, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedStockOrderItemIds.add(item.productId);
      this.lastSelectedStockOrderItemId = item.productId;
    } else {
      this.selectedStockOrderItemIds.delete(item.productId);
    }
  }

  clearStockOrderSelection(): void {
    this.selectedStockOrderItemIds.clear();
    this.lastSelectedStockOrderItemId = null;
  }

  private findStockOrderItemSource(productId: number): WeeklyPlanRepositionOrderItem[] | null {
    if (this.stockOrderItems.some(item => item.productId === productId)) {
      return this.stockOrderItems;
    }
    for (const group of this.stockOrderGroups) {
      if (group.items.some(item => item.productId === productId)) {
        return group.items;
      }
    }
    return null;
  }

  getVisibleStockPoolItemsCount(): number {
    const term = this.stockOrderSearchTerm.trim().toLowerCase();
    if (!term) return this.stockOrderItems.length;
    return this.stockOrderItems.filter(item => 
      item.productName.toLowerCase().includes(term) || 
      (item.supplierName && item.supplierName.toLowerCase().includes(term))
    ).length;
  }

  getStockPoolSupplierSections(): WeeklyPlanPoolSupplierSection[] {
    const term = this.stockOrderSearchTerm.trim().toLowerCase();
    const filtered = this.stockOrderItems.filter(item => 
      !term || 
      item.productName.toLowerCase().includes(term) || 
      (item.supplierName && item.supplierName.toLowerCase().includes(term))
    );

    const sections: Record<string, WeeklyPlanPoolSupplierSection> = {};
    const noSupplierKey = 'no-supplier';
    sections[noSupplierKey] = { key: noSupplierKey, label: this.translate.instant('ORDER_BUILDER.TABLE.NO_SUPPLIER'), items: [] };

    for (const item of filtered) {
      const key = item.supplierId ? `sup-${item.supplierId}` : noSupplierKey;
      if (!sections[key]) {
        sections[key] = { key, label: item.supplierName || this.translate.instant('ORDER_BUILDER.TABLE.NO_SUPPLIER'), items: [] };
      }
      sections[key].items.push(item);
    }

    return Object.values(sections)
      .filter(section => section.items.length > 0)
      .sort((a, b) => {
        if (a.key === noSupplierKey) return 1;
        if (b.key === noSupplierKey) return -1;
        return a.label.localeCompare(b.label);
      });
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

  getStockOrderQuantity(item: WeeklyPlanRepositionOrderItem): number {
    const rawVal = this.showCustomQuantities && item.customQuantity !== undefined 
      ? item.customQuantity 
      : (this.quantityOverride ? this.quantityOverride(item) : item.orderQuantity);
    
    if (this.roundingMode === 'lots' && item.lotQuantity && item.lotQuantity > 0) {
      return Math.ceil(rawVal / item.lotQuantity) * item.lotQuantity;
    }
    
    return this.roundUpStockOrderQuantities ? Math.ceil(rawVal) : rawVal;
  }

  isLotRounded(item: WeeklyPlanRepositionOrderItem): boolean {
    if (this.roundingMode !== 'lots' || !item.lotQuantity || item.lotQuantity <= 0) return false;
    const rawVal = this.showCustomQuantities && item.customQuantity !== undefined 
      ? item.customQuantity 
      : (this.quantityOverride ? this.quantityOverride(item) : item.orderQuantity);
    
    const rounded = Math.ceil(rawVal / item.lotQuantity) * item.lotQuantity;
    return rounded > rawVal;
  }

  formatUnit(unit: string): string {
    if (!unit) return '';
    return unit.length > 4 ? unit.substring(0, 3) + '.' : unit;
  }

  formatUnitFull(unit: string): string {
    return unit || '';
  }

  getCustomLotCount(item: WeeklyPlanRepositionOrderItem): number {
    if (!item.lotQuantity || item.lotQuantity <= 0) return 0;
    const currentQty = this.getStockOrderQuantity(item);
    const rawLots = currentQty / item.lotQuantity;
    // Default to 1 lot minimum — avoid showing 0 or tiny fractions
    return Math.max(1, Math.round(rawLots));
  }

  updateCustomQuantityFromLots(item: WeeklyPlanRepositionOrderItem, lotCount: number): void {
    if (item.lotQuantity && item.lotQuantity > 0) {
      item.customQuantity = lotCount * item.lotQuantity;
      this.stockOrderBuilderDirty = true;
    }
  }

  getStockOrderGroupTotal(group: WeeklyPlanRepositionOrderGroup): number {
    return group.items.reduce((acc, item) => {
      const qty = this.getStockOrderQuantity(item);
      return acc + (qty * (item.unitPrice || 0));
    }, 0);
  }

  createCompleteStockOrderBySupplier(): void {
    const itemsToAssign = [...this.stockOrderItems];
    if (!itemsToAssign.length) return;

    // 1. Group items from pool by supplier
    const supplierMap = new Map<number | null, WeeklyPlanRepositionOrderItem[]>();
    for (const item of itemsToAssign) {
      const key = item.supplierId;
      if (!supplierMap.has(key)) supplierMap.set(key, []);
      supplierMap.get(key)!.push(item);
    }

    // 2. Identify remaining suppliers to create groups for
    const existingGroups = [...this.stockOrderGroups];
    
    supplierMap.forEach((items, supplierId) => {
      // Find if we already have a group for this supplier
      // If we have multiple, we check for one that has this supplier set
      let targetGroup = existingGroups.find(g => g.supplierId === supplierId);
      
      if (targetGroup) {
        // Add to existing group (preventing duplicates just in case)
        const existingIds = new Set(targetGroup.items.map(i => i.productId));
        const newItems = items.filter(i => !existingIds.has(i.productId));
        targetGroup.items = [...targetGroup.items, ...newItems];
      } else {
        // Create new group
        existingGroups.push({
          id: this.nextStockOrderGroupId++,
          title: "", 
          supplierId,
          items: [...items]
        });
      }
    });

    this.stockOrderGroups = existingGroups;
    this.stockOrderItems = [];
    this.reindexStockOrderGroups();
    this.stockOrderBuilderDirty = true;
    this.cdr.detectChanges();
  }

  async confirmCreateStockOrders(): Promise<void> {
    const validGroups = this.stockOrderGroups.filter(group => group.items.length > 0);
    if (!validGroups.length) {
      this.messageService.showWarning(this.translate.instant('ORDER_BUILDER.MESSAGES.NO_ITEMS_ERROR'));
      return;
    }

    const confirmed = await this.messageService.confirm(
      this.translate.instant('ORDER_BUILDER.MESSAGES.CONFIRM_TITLE'),
      this.translate.instant('ORDER_BUILDER.MESSAGES.CONFIRM_MSG', { count: validGroups.length }),
      this.translate.instant('ORDER_BUILDER.MESSAGES.CONFIRM_BTN'),
      this.translate.instant('COMMON.CANCEL')
    );
    if (!confirmed) return;

    this.creatingStockOrders = true;
    try {
      for (const group of validGroups) {
        const orderRequest = {
          userId: this.userId,
          supplierId: group.supplierId || undefined,
          details: group.items.map(item => ({
            productId: item.productId,
            quantity: this.getStockOrderQuantity(item),
            unitPrice: item.unitPrice
          }))
        };
        await firstValueFrom(this.orderService.create(orderRequest));
      }
      this.messageService.showSuccess(this.translate.instant('ORDER_BUILDER.MESSAGES.CREATE_SUCCESS'));
      this.stockOrderBuilderDirty = false;
      this.completed.emit();
    } catch (err) {
      this.messageService.showError(this.translate.instant('ORDER_BUILDER.MESSAGES.CREATE_ERROR'));
    } finally {
      this.creatingStockOrders = false;
      this.cdr.detectChanges();
    }
  }

  cancelBuilder(): void {
    this.cancelled.emit();
  }
}

