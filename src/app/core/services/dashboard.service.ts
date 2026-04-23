import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardData, DashboardKpis, TopRecipe, ExpiringProduct, ExpenseDataPoint, RecentOrder } from '../../shared/models/dashboard.model';
import { UserService } from './user.service';
import { StockAlertService } from './stock-alert.service';
import { OrderService } from './order.service';
import { ProductBatchService } from './product-batch.service';
import { SupplierService } from './supplier.service';
import { KitchenService } from './kitchen.service';
import { IncidentService } from './incident.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private userService = inject(UserService);
    private stockAlertService = inject(StockAlertService);
    private orderService = inject(OrderService);
    private batchService = inject(ProductBatchService);
    private supplierService = inject(SupplierService);
    private kitchenService = inject(KitchenService);
    private incidentService = inject(IncidentService);

    getDashboardData(): Observable<DashboardData> {
        // Step 1: Base data (Teachers, Kitchen Audits, Batches, Students, Suppliers)
        const baseData$ = forkJoin({
            teachers: this.userService.getTeachers().pipe(catchError(() => of([]))),
            kitchenAudits: this.kitchenService.getCookingAudits(0, 50).pipe(catchError(() => of({ content: [] }))),
            expiringBatches: this.batchService.getExpiringBatches(15).pipe(catchError(() => of([]))),
            suppliers: this.supplierService.getAll(0, 50).pipe(catchError(() => of({ content: [] }))),
            kitchenReport: this.kitchenService.getKitchenReport('ALL_TIME').pipe(catchError(() => of(null))),
            openIncidents: this.incidentService.getIncidents({ status: 'ABIERTO', size: 1 }).pipe(catchError(() => of({ totalElements: 0 }))),
            recentOrders: this.orderService.getAll(0, 5).pipe(catchError(() => of({ content: [] })))
        });

        // Step 2: Fetch real Total Costs for each supplier
        return baseData$.pipe(
            switchMap(data => {
                const suppliers = data.suppliers.content || [];
                
                if (suppliers.length === 0) {
                    return of(this.processAggregation(data, []));
                }

                // Create a list of requests for total cost per supplier
                const costRequests = suppliers.map(s => 
                    this.orderService.search({ supplierId: s.id, size: 50 }).pipe(
                        map(res => {
                            // Backend might return direct totalCost or we calculate it from orders
                            let total = res.totalCost || 0;
                            if (total === 0 && res.content && Array.isArray(res.content)) {
                                total = res.content.reduce((sum: number, order: any) => sum + (order.totalPrice || 0), 0);
                            }
                            return { label: s.name, value: Math.round(total * 100) / 100 };
                        }),
                        catchError(() => of({ label: s.name, value: 0 }))
                    )
                );

                return forkJoin(costRequests).pipe(
                    map(expensePoints => this.processAggregation(data, expensePoints))
                );
            })
        );
    }

    private processAggregation(data: any, expensePoints: ExpenseDataPoint[]): DashboardData {
        const kpis: DashboardKpis = {
            activeTeachers: data.teachers.length,
            expiringProductsCount: data.expiringBatches.length,
            openIncidentsCount: data.openIncidents?.totalElements || 0
        };

        // Aggregated Top Recipes from KITCHEN AUDITS (REAL)
        const recipeMap = new Map<number, { name: string, count: number, portions: number }>();
        const audits = data.kitchenAudits.content || [];
        
        audits.forEach((audit: any) => {
            if (audit.recipeId) {
                const current = recipeMap.get(audit.recipeId) || { name: audit.recipeName || 'Receta', count: 0, portions: 0 };
                recipeMap.set(audit.recipeId, { 
                    ...current, 
                    count: current.count + 1,
                    portions: current.portions + (audit.quantityCooked || 0)
                });
            }
        });

        const topRecipes: TopRecipe[] = Array.from(recipeMap.entries()).map(([id, val]) => ({
            id,
            name: val.name,
            elaborations: val.count,
            portions: val.portions
        })).sort((a, b) => b.portions - a.portions).slice(0, 5);


        // Map real expiring batches
        const expiringProducts: ExpiringProduct[] = data.expiringBatches.slice(0, 10).map((b: any) => ({
            id: b.id,
            name: b.productName || 'Producto',
            batchCode: b.batchCode,
            expirationDate: b.expirationDate,
            daysRemaining: this.calculateDays(b.expirationDate),
            stock: b.remainingQuantity,
            unit: 'uds'
        }));

        const recentOrders: RecentOrder[] = (Array.isArray(data.recentOrders) ? data.recentOrders : (data.recentOrders?.content || [])).map((o: any) => ({
            id: o.id,
            userName: o.userName || 'Usuario',
            orderDate: o.orderDate
        }));

        const sortedExpenses = [...expensePoints].sort((a, b) => b.value - a.value).slice(0, 10);

        return {
            kpis,
            topRecipes,
            expiringProducts,
            recentOrders,
            expenses: {
                week: sortedExpenses,
                month: sortedExpenses,
                year: sortedExpenses
            }
        };
    }

    private calculateDays(dateStr: string): number {
        if (!dateStr) return 0;
        const diff = new Date(dateStr).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
}
