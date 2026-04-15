export type AlertSeverity = 'OK' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertResolution = 'OK' | 'COVERED_BY_ORDER' | 'PARTIALLY_COVERED' | 'UNCOVERED' | 'EXPIRING';
export type AlertType = 'PREDICTION' | 'EXPIRATION' | 'COMBINED';

export interface StockAlertDTO {
    productId: number;
    productName: string;
    unit: string;
    unitPrice?: number;
    currentStock: number;
    pendingOrderQuantity: number;
    projectedConsumption: number;
    effectiveGap: number;
    estimatedDaysRemaining: number;
    severity: AlertSeverity;
    alertType?: AlertType;
    resolution: AlertResolution;
    message: string;
    topConsumingRecipes: string[];
    nearestExpirationDate?: string;
    expiringQuantity?: number;
}

export interface StockPredictionResponseDTO {
    productId: number;
    productName: string;
    projectedConsumption: number;
    projectedConsumptionUnit: string;
    currentStock: number;
    updatedAt: string;
}

export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
}

export interface WeeklyConsumptionResponse {
    productId: number;
    productName: string;
    unit: string;
    weeklyConsumption: number[];
    weeksOfHistory: number;
}

export interface ProductBatchInfo {
    id: number;
    productId: number;
    productName: string;
    expirationDate: string | null;
    initialQuantity: number;
    remainingQuantity: number;
    receivedAt: string;
    depleted: boolean;
    expired: boolean;
    daysUntilExpiration: number;
}

export interface DailyForecastResponse {
    productId: number;
    productName: string;
    unit: string;
    dailyForecast: number[];
    horizonDays: number;
    calculatedAt: string;
    activeBatches: ProductBatchInfo[];
}
