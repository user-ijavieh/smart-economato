import { Page } from './page.model';
import { OrderStatus } from './order.model';
import { AlertSeverity, AlertType, AlertResolution } from './stock-alert.model';

export interface WeeklyPlanRequest {
  chefId?: number;
  weekStartDate: string;
  slots: WeeklyPlanSlotRequest[];
}

export interface WeeklyPlanSlotRequest {
  recipeId: number;
  quantity: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
  id?: number;
  studentIds?: number[];
}

export interface WeeklyPlanResponse {
  id: number;
  chefId: number;
  chefName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  slots: WeeklyPlanSlotResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanSlotResponse {
  id: number;
  recipeId: number;
  recipeName: string;
  quantity: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'CONFIRMED' | 'CANCELLED';
  confirmedAt: string | null;
  confirmedByName: string | null;
  students: WeeklyPlanSlotStudentResponse[];
}

export interface WeeklyPlanSlotStudentResponse {
  id: number;
  studentId: number;
  studentName: string;
  status: 'ASSIGNED' | 'CONFIRMED' | 'CANCELLED';
  cancelledAt: string | null;
  cancelledByName: string | null;
}

export interface ConfirmDayResponse {
  planId: number;
  dayOfWeek: number;
  planStatus: string;
  confirmedSlots: WeeklyPlanSlotResponse[];
  totalSlotsConfirmed: number;
}

export interface WeeklyPlanStockRequirement {
  productId: number;
  productName: string;
  requiredQuantity: number;
  grossRequiredQuantity: number;
  availabilityPercentage: number;
  availableStock: number;
  grossAvailableStock: number;
  reservedByOtherPlans: number;
  grossReservedByOtherPlans: number;
  expiredStock?: number;
  grossExpiredStock?: number;
  expiringBeforePlanStock?: number;
  nearestExpirationDate?: string | null;
  expirationRisk?: boolean;

  sufficient: boolean;
  pendingOrderQuantity?: number;
  pendingOrderCount?: number;
  relatedOrders?: WeeklyPlanProductPendingOrder[];
  // Alert fields (for Stock Management)
  projectedConsumption?: number;
  currentStock?: number;
  effectiveGap?: number;
  estimatedDaysRemaining?: number;
  severity?: AlertSeverity;
  alertType?: AlertType;
  resolution?: AlertResolution;
  lotQuantity?: number;
  message?: string;
}

export interface WeeklyPlanProductPendingOrder {
  orderId: number;
  status: OrderStatus;
  quantity: number;
  supplierName?: string | null;
  orderDate?: string;
}

export interface StudentMetrics {
  studentId: number;
  studentName: string;
  totalAssignments: number;
  totalConfirmed: number;
  totalCancelled: number;
  participationRate: number;
}

export type WeeklyPlanPage = Page<WeeklyPlanResponse>;
export type StudentMetricsPage = Page<StudentMetrics>;
export interface WeeklyPlanRepositionOrderItem extends WeeklyPlanStockRequirement {
  unit: string;
  unitPrice: number;
  supplierId: number | null;
  supplierName: string | null;
  orderQuantity: number;
  customQuantity?: number;
}

export interface WeeklyPlanRepositionOrderGroup {
  id: number;
  title: string;
  supplierId: number | null;
  items: WeeklyPlanRepositionOrderItem[];
}

export interface WeeklyPlanPoolSupplierSection {
  key: string;
  label: string;
  items: WeeklyPlanRepositionOrderItem[];
}
