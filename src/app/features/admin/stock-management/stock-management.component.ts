import { Component, OnInit, OnDestroy, NgZone, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Subject, of } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { ProductBatchService } from '../../../core/services/product-batch.service';
import {
    AlertResolution,
    AlertSeverity,
    DailyForecastResponse,
    StockAlertDTO,
    StockPredictionResponseDTO,
    WeeklyConsumptionResponse
} from '../../../shared/models/stock-alert.model';
import { Page } from '../../../shared/models/page.model';
import { StockLedgerService } from '../../../core/services/stock-ledger.service';
import { StockLedgerResponseDTO, IntegrityCheckResponseDTO, StockSnapshotResponseDTO, ConsumptionBreakdownDTO } from '../../../shared/models/stock-ledger.model';
import { Product } from '../../../shared/models/product.model';
import { ProductBatchResponseDTO } from '../../../shared/models/product-batch.model';
import { ScrollService } from '../../../core/services/scroll.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';


type Tab = 'alerts' | 'predictions' | 'ledger';

@Component({
    selector: 'app-stock-management',
    standalone: true,
    imports: [CommonModule, FormsModule, ToastComponent, BaseChartDirective, BaseModalComponent],
    templateUrl: './stock-management.component.html',
    styleUrl: './stock-management.component.css'
})
export class StockManagementComponent implements OnInit, OnDestroy {
    private stockAlertService = inject(StockAlertService);
    private productService = inject(ProductService);
    private orderService = inject(OrderService);
    private cdr = inject(ChangeDetectorRef);
    private ngZone = inject(NgZone);
    private authService = inject(AuthService);
    private stockLedgerService = inject(StockLedgerService);
    private productBatchService = inject(ProductBatchService);
    private scrollService = inject(ScrollService);
    messageService = inject(MessageService);

    loadingAlerts = true;
    loadingPredictions = true;
    loadingOrderData = false;

    activeTab: Tab = 'alerts';

    // ── Alerts tab state ──
    alerts: StockAlertDTO[] = [];
    severityFilter: AlertSeverity | '' = '';
    expandedMessages = new Set<number>();

    // ── Mobile modal state ──
    showMobileModal = false;
    selectedAlertForMobile: any = null;

    // ── Sorting state ──
    sortColumn = 'severity';
    sortDir: 'asc' | 'desc' = 'desc';
    sortInteracted = false;

    // ── Order modal ──
    showOrderModal = false;
    daysAhead = 14;
    orderAlerts: StockAlertDTO[] = [];
    creatingOrder = false;

    // ── Predictions tab state ──
    predictions: StockPredictionResponseDTO[] = [];
    currentPage = 0;
    pageSize = 10;
    totalPages = 0;
    totalElements = 0;

    // ── Sorting state for Predictions ──
    sortColumnPredictions = 'projectedConsumption';
    sortDirPredictions: 'asc' | 'desc' = 'desc';
    sortInteractedPredictions = false;

    // ── Mobile modal state for Predictions ──
    showPredictionMobileModal = false;
    selectedPredictionForMobile: any = null;

    // ── Modal Chart state ──
    modalChartData: ChartData<'line' | 'bar'> = { labels: [], datasets: [] };
    loadingModalChart = false;
    stockOutDay: string | null = null;

    modalChartOptions: ChartOptions<'line' | 'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) label += context.parsed.y.toFixed(2);
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: true,
                title: { display: true, text: 'Stock / Consumo' },
                grid: { drawOnChartArea: true }
            },
            y1: {
                type: 'linear',
                display: false, // We'll use shared axis for stock level comparison but keep y1 for potential future dual-ax
                position: 'right',
                beginAtZero: true,
                grid: { drawOnChartArea: false }
            },
            x: { 
                title: { display: true, text: 'Fecha' },
                ticks: { maxTicksLimit: 10 }
            }
        }
    };

    // ── Ledger tab state ──
    products: Product[] = [];
    selectedProductId: number | null = null;
    ledgerHistory: StockLedgerResponseDTO[] = [];
    ledgerSnapshot: StockSnapshotResponseDTO | null = null;
    ledgerIntegrity: IntegrityCheckResponseDTO | null = null;
    globalIntegrityResults: IntegrityCheckResponseDTO[] = [];
    loadingLedger = false;
    verifyingIntegrity = false;
    resettingHistory = false;
    productsWithLedger: Set<number> = new Set();
    downloadingPdf = false;
    ledgerPage = 0;
    ledgerPageSize = 15;
    ledgerTotalElements = 0;
    ledgerTotalPages = 0;
    ledgerSortColumn = 'transactionTimestamp';
    ledgerSortDir: 'asc' | 'desc' = 'desc';

    // ── Manual adjustment modal state ──
    showManualAdjustmentModal = false;
    adjustmentDelta: number | null = null;
    absoluteAdjustmentQuantity: number | null = null;
    adjustmentDirection: 'ENTRY' | 'EXIT' = 'ENTRY';
    adjustmentType: 'AJUSTE' | 'MERMA' | 'ENTRADA' | 'SALIDA' = 'AJUSTE';
    adjustmentDescription = '';
    adjustmentBatchId: number | null = null;
    adjustmentExpirationDate: string = '';
    activeBatchesForAdjustment: ProductBatchResponseDTO[] = [];
    submittingAdjustment = false;
    
    get todayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    // ── Mobile modal for Ledger transactions ──
    showLedgerMobileModal = false;
    selectedLedgerTx: StockLedgerResponseDTO | null = null;

    // ── Custom Selector Ledger (Infinite Scroll) ──
    showLedgerDropdown = false;
    ledgerSearchTerm = '';
    ledgerProducts: Product[] = [];
    ledgerProductsPage = 0;
    ledgerProductsTotalPages = 0;
    loadingLedgerProducts = false;
    private searchSubject = new Subject<string>();
    private searchSubscription?: any;



    ngOnInit(): void {
        this.loadAlerts();
        
        this.searchSubscription = this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(() => {
            this.ledgerProductsPage = 0;
            this.loadLedgerProducts(0, false);
        });
    }

    ngOnDestroy(): void {
        if (this.searchSubscription) {
            this.searchSubscription.unsubscribe();
        }
    }

    switchTab(tab: Tab): void {
        this.activeTab = tab;
        if (tab === 'predictions' && this.predictions.length === 0) {
            this.loadPredictions();
        } else if (tab === 'ledger') {
            if (this.ledgerProducts.length === 0) {
                this.loadLedgerProducts();
            }
        }
        this.showLedgerDropdown = false;
        this.ledgerSearchTerm = '';
        this.cdr.detectChanges();
    }

    // ================================================================
    // ALERTS TAB
    // ================================================================

    loadAlerts(): void {
        this.loadingAlerts = true;
        this.cdr.detectChanges();
        const severity = this.severityFilter || undefined;
        this.stockAlertService.getActiveAlerts(severity as AlertSeverity | undefined).subscribe({
            next: (data: StockAlertDTO[]) => {
                this.alerts = data;
                this.applySorting(); // Apply sorting immediately
                setTimeout(() => { this.loadingAlerts = false; this.cdr.markForCheck(); });
            },
            error: () => {
                this.messageService.showError('Error al cargar las alertas');
                setTimeout(() => { this.loadingAlerts = false; this.cdr.markForCheck(); });
            }
        });
    }

    onSeverityChange(): void { this.loadAlerts(); }

    toggleMessage(id: number): void {
        this.expandedMessages.has(id) ? this.expandedMessages.delete(id) : this.expandedMessages.add(id);
    }
    isExpanded(id: number): boolean { return this.expandedMessages.has(id); }

    openMobileModal(alert: StockAlertDTO): void {
        this.selectedAlertForMobile = {
            ...alert,
            estimatedDailyConsumption: alert.projectedConsumption / 14
        };
        this.showMobileModal = true;
        this.loadModalChartData(alert.productId, alert.currentStock, alert.projectedConsumption / 14);
    }

    closeMobileModal(): void {
        this.showMobileModal = false;
        this.selectedAlertForMobile = null;
    }

    getSeverityClass(s: AlertSeverity): string {
        return { CRITICAL: 'severity-critical', HIGH: 'severity-high', MEDIUM: 'severity-medium', LOW: 'severity-low', OK: 'severity-ok' }[s] ?? '';
    }

    getSeverityLabel(s: AlertSeverity): string {
        return { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Medio', LOW: 'Bajo', OK: 'Normal' }[s] ?? s;
    }

    getResolutionClass(r: AlertResolution): string {
        return { COVERED_BY_ORDER: 'resolution-covered', PARTIALLY_COVERED: 'resolution-partial', UNCOVERED: 'resolution-uncovered', OK: 'resolution-ok' }[r] ?? '';
    }

    getResolutionIcon(r: AlertResolution): string {
        return { COVERED_BY_ORDER: '', PARTIALLY_COVERED: '', UNCOVERED: '', OK: '' }[r] ?? '';
    }

    getResolutionLabel(r: AlertResolution): string {
        return { COVERED_BY_ORDER: 'Cubierto', PARTIALLY_COVERED: 'Parcial', UNCOVERED: 'No cubierto', OK: 'Cubierto' }[r] ?? r;
    }

    countBySeverity(s: AlertSeverity): number { return this.alerts.filter(a => a.severity === s).length; }

    splitMessage(msg: string): string[] {
        if (!msg) return [];
        return msg.split('.')
            .map(token => token.trim())
            .filter(Boolean);
    }

    onSortChange(column: string): void {
        this.sortInteracted = true;
        if (this.sortColumn === column) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDir = 'desc'; // Default to desc for most important items first
        }
        this.applySorting();
    }

    getSortDir(column: string): string {
        if (!this.sortInteracted && this.sortColumn !== column) return 'none';
        return this.sortColumn === column ? this.sortDir : 'none';
    }

    private applySorting(): void {
        const factor = this.sortDir === 'asc' ? 1 : -1;
        this.alerts.sort((a, b) => {
            let valA: any;
            let valB: any;

            switch (this.sortColumn) {
                case 'productName':
                    valA = a.productName?.toLowerCase() || '';
                    valB = b.productName?.toLowerCase() || '';
                    return valA.localeCompare(valB) * factor;
                case 'effectiveGap':
                    valA = a.effectiveGap || 0;
                    valB = b.effectiveGap || 0;
                    return (valA - valB) * factor;
                case 'estimatedDaysRemaining':
                    valA = a.estimatedDaysRemaining || 0;
                    valB = b.estimatedDaysRemaining || 0;
                    return (valA - valB) * factor;
                case 'severity':
                    const severityOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'OK': 0 };
                    valA = severityOrder[a.severity] ?? 0;
                    valB = severityOrder[b.severity] ?? 0;
                    return (valA - valB) * factor;
                default:
                    return 0;
            }
        });
        this.cdr.detectChanges();
    }

    openOrderModal(): void {
        if (this.loadingOrderData) return;
        const ids = this.alerts.filter(a => a.resolution === 'UNCOVERED' || a.resolution === 'PARTIALLY_COVERED').map(a => a.productId);
        if (!ids.length) { this.messageService.showError('No hay productos sin cubrir para generar una orden.'); return; }

        this.loadingOrderData = true;

        this.stockAlertService.getBatchAlerts(ids).pipe(
            switchMap((alerts: StockAlertDTO[]) => {
                if (!alerts.length) return forkJoin([]);

                // Fetch product details for each alert to get unitPrice
                const priceRequests = alerts.map((a: StockAlertDTO) => this.productService.getById(a.productId).pipe(
                    map((product: any) => ({ ...a, unitPrice: product.unitPrice || 0 }))
                ));
                return forkJoin(priceRequests);
            })
        ).subscribe({
            next: (data: any) => { this.orderAlerts = data as any; this.showOrderModal = true; this.loadingOrderData = false; this.cdr.detectChanges(); },
            error: () => { this.messageService.showError('Error al calcular los productos'); this.loadingOrderData = false; this.cdr.detectChanges(); }
        });
    }

    closeOrderModal(): void { this.showOrderModal = false; this.orderAlerts = []; this.daysAhead = 14; }

    getOrderQuantity(a: StockAlertDTO): number {
        const daily = a.projectedConsumption / 14;
        return Math.ceil(Math.max(0, daily * this.daysAhead - a.currentStock - a.pendingOrderQuantity) * 100) / 100;
    }

    getOrderTotal(): number {
        return this.orderAlerts.reduce((sum, a) => {
            const qty = this.getOrderQuantity(a);
            return sum + (qty > 0 ? qty * (a.unitPrice || 0) : 0);
        }, 0);
    }

    confirmCreateOrder(): void {
        const details = this.orderAlerts.map(a => ({ productId: a.productId, quantity: this.getOrderQuantity(a), unitPrice: a.unitPrice || 0 })).filter(d => d.quantity > 0);
        if (!details.length) { this.messageService.showError('No hay cantidades a pedir.'); return; }

        const userId = this.authService.getUserId() || 1; // Fallback to 1 if no auth logic binds
        const payload: any = { userId, details };

        this.creatingOrder = true;
        this.orderService.create(payload).subscribe({
            next: () => { this.messageService.showSuccess('Orden creada correctamente'); this.closeOrderModal(); this.creatingOrder = false; this.loadAlerts(); this.cdr.detectChanges(); },
            error: (err: any) => { this.messageService.showError(err.error?.message || 'Error al crear la orden'); this.creatingOrder = false; this.cdr.detectChanges(); }
        });
    }

    // ================================================================
    // PREDICTIONS TAB
    // ================================================================

    loadPredictions(page = 0): void {
        this.ngZone.run(() => {
            this.loadingPredictions = true;
            this.currentPage = page;
            // Removed array clear to prevent layout shift
            this.cdr.markForCheck();
        });
        
        const backendCols: Record<string, string> = {
            'productName': 'product.name'
        };
        const backendCol = backendCols[this.sortColumnPredictions] || this.sortColumnPredictions;
        const sortParam = `${backendCol},${this.sortDirPredictions}`;

        this.stockAlertService.getPredictions(page, this.pageSize, sortParam).subscribe({
            next: (data: any) => {
                this.ngZone.run(() => {
                    this.predictions = data.content;
                    this.totalPages = data.totalPages;
                    this.totalElements = data.totalElements;
                    this.currentPage = page;
                    this.loadingPredictions = false;
                    this.cdr.markForCheck();
                });
            },
            error: () => {
                this.ngZone.run(() => {
                    this.messageService.showError('Error al cargar predicciones');
                    this.loadingPredictions = false;
                    this.cdr.markForCheck();
                });
            }
        });
    }

    onSortPredictionsChange(column: string): void {
        this.ngZone.run(() => {
            this.sortInteractedPredictions = true;
            if (this.sortColumnPredictions === column) {
                this.sortDirPredictions = this.sortDirPredictions === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumnPredictions = column;
                this.sortDirPredictions = column === 'projectedConsumption' ? 'desc' : 'asc';
            }
            this.loadPredictions(0);
        });
    }

    getSortPredictionsDir(column: string): string {
        if (!this.sortInteractedPredictions && this.sortColumnPredictions !== column) return 'none';
        return this.sortColumnPredictions === column ? this.sortDirPredictions : 'none';
    }

    // The applyPredictionsSorting frontend logic has been removed as the API handles sorting natively for predictions.

    changePage(delta: number): void {
        this.ngZone.run(() => {
            const next = this.currentPage + delta;
            if (next >= 0 && next < this.totalPages) {
                this.scrollService.scrollToTop();
                this.loadPredictions(next);
            }
        });
    }

    openPredictionMobileModal(prediction: StockPredictionResponseDTO): void {
        const currentStock = prediction.currentStock || 0;
        const dailyAvg = prediction.projectedConsumption / 14;
        const daysOfCoverage = dailyAvg > 0 ? currentStock / dailyAvg : 0;

        this.selectedPredictionForMobile = {
            ...prediction,
            currentStock: currentStock,
            unit: prediction.projectedConsumptionUnit,
            daysOfCoverage: Math.round(daysOfCoverage)
        };
        this.showPredictionMobileModal = true;
        this.loadModalChartData(prediction.productId, currentStock, dailyAvg);
    }

    closePredictionMobileModal(): void {
        this.showPredictionMobileModal = false;
        this.selectedPredictionForMobile = null;
    }

    loadModalChartData(productId: number, currentStock: number, dailyAverage: number): void {
        this.loadingModalChart = true;
        this.stockOutDay = null;
        this.modalChartData = { labels: [], datasets: [] };
        this.cdr.markForCheck();

        forkJoin({
            history: this.stockLedgerService.getConsumptionBreakdown(productId, { lastDays: 14 }),
            forecast: this.stockAlertService.getDailyForecastByProduct(productId).pipe(
                catchError(() => of(null as DailyForecastResponse | null))
            )
        }).subscribe({
            next: ({ history, forecast }: { history: ConsumptionBreakdownDTO, forecast: DailyForecastResponse | null }) => {
                this.ngZone.run(() => {
                    const labels: string[] = [];
                    const historyData: (number | null)[] = [];
                    const predictionData: (number | null)[] = [];
                    const stockLevelData: (number | null)[] = [];

                    // 1. Process History (Last 14 days)
                    history.breakdown.forEach((day: any) => {
                        labels.push(new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
                        historyData.push(day.consumed);
                        predictionData.push(null);
                        stockLevelData.push(null);
                    });

                    // 2. Add Current Day Marker (Today)
                    const today = new Date();
                    const todayDateStr = today.toISOString().split('T')[0];
                    const existingToday = history.breakdown.find((d: any) => d.date === todayDateStr);
                    
                    labels.push('Hoy');
                    historyData.push(existingToday ? existingToday.consumed : 0); 
                    predictionData.push(dailyAverage);
                    stockLevelData.push(currentStock);

                    // 3. Process Forecast (Fallback to 14 days if null or empty)
                    let tempStock = currentStock;
                    let outDayFound = false;
                    
                    const forecastValues = (forecast && forecast.dailyForecast && forecast.dailyForecast.length > 0) 
                        ? forecast.dailyForecast 
                        : Array(14).fill(dailyAverage);

                    forecastValues.forEach((val: number, i: number) => {
                        const date = new Date();
                        date.setDate(today.getDate() + i + 1);
                        labels.push(date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
                        
                        historyData.push(null);
                        predictionData.push(val);
                        
                        tempStock = Math.max(0, tempStock - val);
                        stockLevelData.push(tempStock);

                        if (tempStock === 0 && !outDayFound) {
                            this.stockOutDay = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                            outDayFound = true;
                        }
                    });

                    this.modalChartData = {
                        labels,
                        datasets: [
                            {
                                type: 'line',
                                label: 'Stock Estimado',
                                data: stockLevelData,
                                borderColor: '#0ea5e9',
                                backgroundColor: 'transparent',
                                borderWidth: 3,
                                pointBackgroundColor: '#fff',
                                pointBorderColor: '#0ea5e9',
                                pointRadius: 5,
                                pointHoverRadius: 7,
                                tension: 0.1,
                                order: 1,
                                spanGaps: true
                            } as any,
                            {
                                type: 'bar',
                                label: 'Consumo Histórico',
                                data: historyData,
                                backgroundColor: 'rgba(54, 162, 235, 0.4)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1,
                                order: 2
                            } as any,
                            {
                                type: 'bar',
                                label: 'Consumo Proyectado',
                                data: predictionData,
                                backgroundColor: 'rgba(255, 99, 132, 0.3)',
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 1,
                                order: 2
                            } as any
                        ]
                    };

                    this.loadingModalChart = false;
                    this.cdr.markForCheck();
                });
            },
            error: () => {
                this.messageService.showError('Error al cargar datos de la gráfica');
                this.loadingModalChart = false;
                this.cdr.markForCheck();
            }
        });
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    openLedgerMobileModal(tx: StockLedgerResponseDTO): void {
        this.ngZone.run(() => {
            this.selectedLedgerTx = tx;
            this.showLedgerMobileModal = true;
        });
    }

    closeLedgerMobileModal(): void {
        this.ngZone.run(() => {
            this.showLedgerMobileModal = false;
            this.selectedLedgerTx = null;
        });
    }

    closeLedgerDropdown(): void {
        this.ngZone.run(() => {
            this.showLedgerDropdown = false;
        });
    }

    // ================================================================
    // LEDGER TAB
    // ================================================================

    loadLedgerProducts(page: number = 0, append: boolean = false): void {
        if (this.loadingLedgerProducts) return;
        this.loadingLedgerProducts = true;
        this.ledgerProductsPage = page;
        this.cdr.detectChanges();

        this.stockLedgerService.getProductsWithLedger(this.ledgerSearchTerm, page, 20).pipe(
            finalize(() => { 
                this.loadingLedgerProducts = false; 
                this.cdr.detectChanges(); 
            })
        ).subscribe({
            next: (data) => {
                const rawContent = data?.content || (Array.isArray(data) ? data : []);
                const normalizedContent = rawContent.map((item: any) => ({
                    ...item,
                    name: item.name || item.nombre || 'Sin nombre',
                    unit: item.unit || item.unidad || 'Ud'
                }));

                if (append) {
                    this.ledgerProducts = [...(this.ledgerProducts || []), ...normalizedContent];
                } else {
                    this.ledgerProducts = normalizedContent;
                }
                this.ledgerProductsTotalPages = data?.totalPages || 1;
                this.cdr.detectChanges();
            },
            error: () => {
                this.ledgerProducts = this.ledgerProducts || [];
                this.messageService.showError('Error al cargar productos con ledger');
            }
        });
    }

    onLedgerSearchInput(): void {
        this.searchSubject.next(this.ledgerSearchTerm);
    }

    onLedgerDropdownScroll(event: any): void {
        const el = event.target;
        const threshold = 50;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

        if (isNearBottom && !this.loadingLedgerProducts && this.ledgerProductsPage < (this.ledgerProductsTotalPages - 1)) {
            this.loadLedgerProducts(this.ledgerProductsPage + 1, true);
        }
    }

    onProductSelect(id: number | null): void {
        this.ngZone.run(() => {
            this.selectedProductId = id;
            this.showLedgerDropdown = false;
            this.ledgerPage = 0;
            if (id) {
                this.loadLedgerHistory(id);
                this.loadLedgerSnapshot(id);
            } else {
                this.ledgerHistory = [];
                this.ledgerSnapshot = null;
            }
        });
    }

    get selectedProductName(): string {
        if (!this.selectedProductId) return 'Seleccione un producto...';
        const p = this.ledgerProducts.find(p => p.id === this.selectedProductId);
        return p ? `${p.name} (${p.unit})` : 'Producto seleccionado';
    }

    get selectedLedgerUnit(): string {
        if (!this.selectedProductId) return 'Ud';
        const product = this.ledgerProducts.find(p => p.id === this.selectedProductId);
        return product?.unit || 'Ud';
    }

    toggleLedgerDropdown(): void {
        this.showLedgerDropdown = !this.showLedgerDropdown;
        if (this.showLedgerDropdown && (!this.ledgerProducts || this.ledgerProducts.length === 0)) {
            this.loadLedgerProducts();
        }
    }

    loadLedgerHistory(productId: number): void {
        this.loadingLedger = true;
        const sortParam = `${this.ledgerSortColumn},${this.ledgerSortDir}`;

        this.stockLedgerService.getHistory(productId, this.ledgerPage, this.ledgerPageSize, sortParam).subscribe({
            next: (data) => {
                this.ledgerHistory = data.content;
                this.ledgerTotalElements = data.totalElements;
                this.ledgerTotalPages = data.totalPages;
                this.loadingLedger = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.loadingLedger = false;
                this.messageService.showError('Error al cargar el historial del ledger');
                this.cdr.detectChanges();
            }
        });
    }

    onLedgerPageChange(delta: number): void {
        if (!this.selectedProductId) return;
        this.ledgerPage += delta;
        this.scrollService.scrollToTop();
        this.loadLedgerHistory(this.selectedProductId);
    }

    onSortLedgerChange(col: string): void {
        if (this.ledgerSortColumn === col) {
            this.ledgerSortDir = this.ledgerSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.ledgerSortColumn = col;
            this.ledgerSortDir = 'desc';
        }
        this.ledgerPage = 0;
        if (this.selectedProductId) {
            this.loadLedgerHistory(this.selectedProductId);
        }
    }

    getSortLedgerDir(col: string): string {
        return this.ledgerSortColumn === col ? this.ledgerSortDir : '';
    }

    loadLedgerSnapshot(productId: number): void {
        this.stockLedgerService.getSnapshot(productId).subscribe({
            next: (data) => this.ledgerSnapshot = data,
            error: () => this.ledgerSnapshot = null
        });
    }

    verifyIntegrity(): void {
        if (!this.selectedProductId) return;
        this.verifyingIntegrity = true;
        this.cdr.detectChanges();

        this.stockLedgerService.verifyIntegrity(this.selectedProductId).pipe(
            finalize(() => { this.verifyingIntegrity = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (res) => {
                this.ledgerIntegrity = res;
                if (res.valid) {
                    this.messageService.showSuccess(`Integridad verificada: ${res.message}`);
                } else {
                    this.messageService.showError(`¡CORRUPCIÓN DETECTADA!: ${res.message}`);
                }
            },
            error: () => this.messageService.showError('Error al verificar integridad')
        });
    }

    verifyAll(): void {
        this.verifyingIntegrity = true;
        this.cdr.detectChanges();

        this.stockLedgerService.getGlobalLedgerIntegrity().pipe(
            finalize(() => { this.verifyingIntegrity = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (res) => {
                this.globalIntegrityResults = res;
                const corrupted = res.filter(r => !r.valid);
                if (corrupted.length === 0) {
                    this.messageService.showSuccess(`Todas las cadenas (${res.length}) son íntegras.`, 5000);
                } else {
                    this.messageService.showError(`CORRUPCIÓN: Se detectaron ${corrupted.length} productos con errores. Revisa la lista al final de la página.`, 8000);
                }
                
                // Scroll to results section with offset to avoid covering the title
                setTimeout(() => {
                    const el = document.getElementById('globalVerificationResults');
                    if (el) {
                        const yOffset = -20; 
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({top: y, behavior: 'smooth'});
                    }
                }, 100);
            },
            error: () => this.messageService.showError('Error al realizar la verificación global de integridad')
        });
    }

    async downloadPdfById(productId: number): Promise<void> {
        const confirmed = await this.messageService.confirm(
            'Confirmar descarga',
            '¿Deseas descargar este archivo PDF?'
        );
        if (!confirmed) return;

        this.downloadingPdf = true;
        this.stockLedgerService.downloadLedgerPdf(productId).pipe(
            finalize(() => { this.downloadingPdf = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (response) => {
                const blob = response.body;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ledger_${productId}_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                const isValid = response.headers.get('X-Ledger-Integrity-Valid') === 'true';
                const message = response.headers.get('X-Ledger-Integrity-Message');
                if (isValid) {
                    this.messageService.showSuccess(`PDF generado. Estado: ${message}`);
                } else {
                    this.messageService.showWarning(`PDF generado con alertas: ${message}`);
                }
            },
            error: () => this.messageService.showError('Error al generar el PDF del ledger')
        });
    }

    downloadPdf(): void {
        if (!this.selectedProductId) return;
        void this.downloadPdfById(this.selectedProductId);
    }

    async resetProductHistory(): Promise<void> {
        if (!this.selectedProductId) return;

        const confirm1 = await this.messageService.confirm(
            'Confirmación de Seguridad',
            '¿Estás SEGURO de que deseas resetear el historial? Esta acción borrará toda la cadena del ledger.'
        );
        if (!confirm1) return;

        const confirm2 = await this.messageService.confirm(
            '¡ACCIÓN IRREVERSIBLE!',
            'Se perderán todos los datos de auditoría y el snapshot actual. ¿Deseas proceder definitivamente?'
        );
        if (!confirm2) return;

        this.resettingHistory = true;
        this.cdr.detectChanges();

        this.stockLedgerService.resetHistory(this.selectedProductId).pipe(
            finalize(() => { this.resettingHistory = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (msg) => {
                this.messageService.showSuccess(msg);
                this.loadLedgerHistory(this.selectedProductId!);
                this.loadLedgerSnapshot(this.selectedProductId!);
            },
            error: (err) => this.messageService.showError(err.error || 'Error al resetear historial')
        });
    }





    openManualAdjustmentModal(): void {
        if (!this.selectedProductId) return;
        this.showManualAdjustmentModal = true;
        this.adjustmentDelta = null;
        this.absoluteAdjustmentQuantity = null;
        this.adjustmentDirection = 'ENTRY';
        this.adjustmentType = 'AJUSTE';
        this.adjustmentDescription = '';
        this.adjustmentBatchId = null;
        this.adjustmentExpirationDate = '';
        this.productBatchService.getActiveBatches(this.selectedProductId).subscribe({
            next: (batches) => {
                this.activeBatchesForAdjustment = batches;
                this.cdr.detectChanges();
            },
            error: () => this.messageService.showError('Error al cargar lotes activos')
        });
    }

    closeManualAdjustmentModal(): void {
        this.showManualAdjustmentModal = false;
        this.activeBatchesForAdjustment = [];
    }

    submitManualAdjustment(): void {
        if (!this.selectedProductId || !this.absoluteAdjustmentQuantity || !this.adjustmentDescription) return;
        
        // If no batch is selected and we're adding stock, expiration date is mandatory (Backend DTO requirement)
        if (!this.adjustmentBatchId && this.adjustmentDirection === 'ENTRY' && !this.adjustmentExpirationDate) {
            this.messageService.showError('La fecha de caducidad es obligatoria para un nuevo lote.');
            return;
        }

        // Calculate signed delta
        const delta = this.adjustmentDirection === 'ENTRY' 
            ? Math.abs(this.absoluteAdjustmentQuantity) 
            : -Math.abs(this.absoluteAdjustmentQuantity);

        const request = {
            productId: this.selectedProductId,
            quantityDelta: delta,
            movementType: this.adjustmentType,
            description: this.adjustmentDescription,
            batchId: this.adjustmentBatchId || undefined,
            expirationDate: (!this.adjustmentBatchId && this.adjustmentDirection === 'ENTRY') ? this.adjustmentExpirationDate : undefined
        };

        this.submittingAdjustment = true;
        this.stockLedgerService.registerManualAdjustment(request).pipe(
            finalize(() => { this.submittingAdjustment = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: () => {
                this.messageService.showSuccess('Ajuste de stock registrado con éxito');
                this.closeManualAdjustmentModal();
                this.loadLedgerHistory(this.selectedProductId!);
                this.loadLedgerSnapshot(this.selectedProductId!);
            },
            error: (err) => this.messageService.showError(err.error?.message || 'Error al registrar el ajuste')
        });
    }


    getMovementTypeClass(type: string): string {
        const map: Record<string, string> = {
            ENTRADA: 'movement-entrada',
            SALIDA: 'movement-salida',
            AJUSTE: 'movement-ajuste',
            RECEPCION: 'movement-recepcion',
            PRODUCCION: 'movement-produccion'
        };
        return map[type] || '';
    }

    getIntegrityStatusClass(status: string): string {
        const map: Record<string, string> = {
            VALID: 'status-valid',
            CORRUPTED: 'status-corrupted',
            CORRUPTA: 'status-corrupted',
            UNVERIFIED: 'status-unverified'
        };
        return map[status] || '';
    }
}
