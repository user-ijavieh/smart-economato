import { Page } from './page.model';

export type ReportRange = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL_TIME' | 'CUSTOM';

export interface KitchenComponentStateItem {
  productId: number;
  productName: string;
  quantity: number;
}

export interface KitchenComponentsState {
  components: KitchenComponentStateItem[];
}

export interface RecipeCookingAudit {
  id: number;
  recipeId: number;
  recipeName: string;
  userId: number;
  userName: string;
  quantityCooked: number;
  details: string;
  componentsState?: string | KitchenComponentsState | null;
  cookingDate: string;
}

export interface BatchStockMovementItem {
  productId: number;
  quantityDelta: number;
  movementType: 'AJUSTE';
  description: string;
}

export interface BatchStockMovementRequest {
  movements: BatchStockMovementItem[];
  reason?: string;
  orderId?: number;
  recipeCookingAuditId?: number | null;
}

export interface BatchStockMovementResponse {
  success: boolean;
  processedCount: number;
  totalCount: number;
  message: string;
  errorDetail?: string;
}

export interface KitchenRecipeStat {
  recipeId: number;
  recipeName: string;
  timesCooked: number;
  totalQuantityCooked: number;
}

export interface KitchenUserStat {
  userId: number;
  userName: string;
  timesCooked: number;
}

export interface KitchenProductStat {
  productId: number;
  productName: string;
  totalQuantityUsed: number;
  estimatedCost?: number;
  unit?: string;
}

export interface KitchenReport {
  reportPeriod: string;
  totalCookingSessions: number;
  totalPortionsCooked: number;
  distinctRecipesCooked: number;
  distinctUsersCooking: number;
  distinctProductsUsed: number;
  totalEstimatedCost: number;
  topRecipes: KitchenRecipeStat[];
  topUsers: KitchenUserStat[];
  topProducts: KitchenProductStat[];
}

export type RecipeCookingAuditPage = Page<RecipeCookingAudit>;