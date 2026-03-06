export type AlertSeverity = 'OK' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertResolution = 'OK' | 'COVERED_BY_ORDER' | 'PARTIALLY_COVERED' | 'UNCOVERED';

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
    resolution: AlertResolution;
    message: string;
    topConsumingRecipes: string[];
}

export interface StockPredictionResponseDTO {
    productId: number;
    productName: string;
    projectedConsumption: number;
    projectedConsumptionUnit: string;
    updatedAt: string;
}
