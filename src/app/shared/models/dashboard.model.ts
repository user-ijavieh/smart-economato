export interface DashboardKpis {
    activeTeachers: number;
    expiringProductsCount: number;
    openIncidentsCount: number;
}

export interface TopRecipe {
    id: number;
    name: string;
    elaborations: number;
    portions: number;
    image?: string;
}

export interface ExpiringProduct {
    id: number;
    name: string;
    batchCode?: string | null;
    expirationDate: string;
    daysRemaining: number;
    stock: number;
    unit: string;
}

export interface ExpenseDataPoint {
    label: string;
    value: number;
}

export interface DashboardData {
    kpis: DashboardKpis;
    topRecipes: TopRecipe[];
    expiringProducts: ExpiringProduct[];
    expenses: {
        week: ExpenseDataPoint[];
        month: ExpenseDataPoint[];
        year: ExpenseDataPoint[];
    };
}
