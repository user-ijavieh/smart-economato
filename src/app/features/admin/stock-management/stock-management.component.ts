import { Component, OnInit, OnDestroy, NgZone, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin, Subject, of } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, catchError, takeUntil } from 'rxjs/operators';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ProductBatchService } from '../../../core/services/product-batch.service';
import { BatchTypeaheadDTO } from '../../../core/services/product-batch.service';
import { SupplierService } from '../../../core/services/supplier.service';
import {
    AlertResolution,
    AlertSeverity,
    AlertType,
    DailyForecastResponse,
    StockAlertDTO,
    StockPredictionResponseDTO,
    WeeklyConsumptionResponse
} from '../../../shared/models/stock-alert.model';
import { Page } from '../../../shared/models/page.model';
import { StockLedgerService } from '../../../core/services/stock-ledger.service';
import {
    StockLedgerResponseDTO,
    IntegrityCheckResponseDTO,
    StockSnapshotResponseDTO,
    ConsumptionBreakdownDTO,
    BlockchainStatsResponseDTO,
    BlockchainVerificationResponseDTO,
    LedgerBlockResponseDTO
} from '../../../shared/models/stock-ledger.model';
import { Product } from '../../../shared/models/product.model';
import { ProductBatchResponseDTO } from '../../../shared/models/product-batch.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { ScrollService } from '../../../core/services/scroll.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../general/barcode-scanner/barcode-scanner.component';
import { OrderBuilderComponent } from '../../../shared/components/order-builder/order-builder.component';
import { WeeklyPlanRepositionOrderItem } from '../../../shared/models/weekly-plan.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


type Tab = 'alerts' | 'predictions' | 'ledger';
type AlertChartMode = 'prediction' | 'expiration' | 'combined';


@Component({
    selector: 'app-stock-management',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective, BaseModalComponent, BarcodeScannerComponent, OrderBuilderComponent, TranslateModule],
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
    private supplierService = inject(SupplierService);
    private scrollService = inject(ScrollService);
    private route = inject(ActivatedRoute);
    private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
    private translate = inject(TranslateService);
    messageService = inject(MessageService);

    private destroy$ = new Subject<void>();

    loadingAlerts = true;
    loadingPredictions = true;
    loadingOrderData = false;
    autoOpenOrderModal = false;

    activeTab: Tab = 'alerts';

    // ── Alerts tab state ──
    alerts: StockAlertDTO[] = [];
    severityFilter: AlertSeverity | '' = '';
    expandedMessages = new Set<number>();

    // ── Mobile modal state ──
    showMobileModal = false;
    selectedAlertForMobile: (StockAlertDTO & { estimatedDailyConsumption: number }) | null = null;

    // ── Sorting state ──
    sortColumn = 'severity';
    sortDir: 'asc' | 'desc' = 'desc';
    sortInteracted = false;

    // ── Order modal ──
    showOrderModal = false;
    daysAhead = 14;
    orderItems: WeeklyPlanRepositionOrderItem[] = [];
    suppliers: Supplier[] = [];
    loadingSuppliers = false;
    orderBuilderDirty = false;

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
    modalChartMode: AlertChartMode = 'prediction';
    modalChartTitle = this.translate.instant('STOCK_MGMT.ALERTS.CHART.TITLE');

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
                title: { display: true, text: this.translate.instant('STOCK_MGMT.ALERTS.CHART.Y_AXIS') },
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
                title: { display: true, text: this.translate.instant('STOCK_MGMT.ALERTS.CHART.X_AXIS') },
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
    ledgerTabTapCount = 0;
    ledgerTechnicalMode = false;

    blockchainStats: BlockchainStatsResponseDTO | null = null;
    blockchainVerification: BlockchainVerificationResponseDTO | null = null;
    blockchainBlocks: LedgerBlockResponseDTO[] = [];
    blockchainMempool: StockLedgerResponseDTO[] = [];
    selectedBlockchainBlock: LedgerBlockResponseDTO | null = null;

    loadingBlockchainStats = false;
    loadingBlockchainVerification = false;
    loadingBlockchainBlocks = false;
    loadingBlockchainMempool = false;
    loadingBlockchainBlockDetail = false;

    blockchainBlocksPage = 0;
    blockchainBlocksTotalPages = 0;
    blockchainMempoolPage = 0;
    blockchainMempoolTotalPages = 0;

    // ── Manual adjustment modal state ──
    showManualAdjustmentModal = false;
    adjustmentDelta: number | null = null;
    absoluteAdjustmentQuantity: number | null = null;
    adjustmentDirection: 'ENTRY' | 'EXIT' = 'ENTRY';
    adjustmentType: 'AJUSTE' | 'MERMA' | 'ENTRADA' | 'SALIDA' = 'AJUSTE';
    adjustmentDescription = '';
    adjustmentBatchId: number | null = null;
    adjustmentBatchReference = '';
    adjustmentExpirationDate: string = '';
    activeBatchesForAdjustment: ProductBatchResponseDTO[] = [];
    batchTypeaheadSuggestions: BatchTypeaheadDTO[] = [];
    submittingAdjustment = false;
    private adjustmentBatchSearchSubject = new Subject<string>();
    private adjustmentBatchSearchSubscription?: any;
    
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
    showLedgerScannerModal = false;
    private searchSubject = new Subject<string>();
    private searchSubscription?: any;


    private getLocale(): string {
        return this.translate.currentLang === 'en' ? 'en-US' : 'es-ES';
    }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            this.autoOpenOrderModal = params.get('openOrderModal') === '1';
        });

        this.loadAlerts();
        this.loadSuppliers();
        
        this.searchSubscription = this.searchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe(() => {
            this.ledgerProductsPage = 0;
            this.loadLedgerProducts(0, false);
        });

        this.adjustmentBatchSearchSubscription = this.adjustmentBatchSearchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe((query: string) => {
            this.loadBatchTypeahead(query);
        });

        this.syncCacheInvalidationService.invalidatedDomains$
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ domains }) => {
                if (domains.includes('product') || domains.includes('batch') || domains.includes('order') || domains.includes('recipe')) {
                    if (this.activeTab === 'alerts' && !this.loadingAlerts) {
                        this.loadAlerts();
                    } else if (this.activeTab === 'predictions' && !this.loadingPredictions) {
                        this.loadPredictions();
                    } else if (this.activeTab === 'ledger' && !this.loadingLedger && this.selectedProductId) {
                        this.loadLedgerHistory(this.selectedProductId);
                        this.loadLedgerSnapshot(this.selectedProductId);
                    }
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.searchSubscription) {
            this.searchSubscription.unsubscribe();
        }
        if (this.adjustmentBatchSearchSubscription) {
            this.adjustmentBatchSearchSubscription.unsubscribe();
        }
    }

    switchTab(tab: Tab): void {
        const previousTab = this.activeTab;
        this.activeTab = tab;
        if (tab !== 'ledger') {
            this.ledgerTabTapCount = 0;
        }
        if (tab === 'predictions' && this.predictions.length === 0) {
            this.loadPredictions();
        } else if (tab === 'ledger') {
            if (this.ledgerProducts.length === 0) {
                this.loadLedgerProducts();
            }
            if (this.ledgerTechnicalMode && previousTab !== 'ledger') {
                this.refreshBlockchainTechnicalData();
            }
        }
        this.showLedgerDropdown = false;
        this.ledgerSearchTerm = '';
        this.cdr.detectChanges();
    }

    onLedgerTabClick(): void {
        if (this.activeTab === 'ledger') {
            this.ledgerTabTapCount += 1;
        } else {
            this.ledgerTabTapCount = 1;
        }

        this.switchTab('ledger');

        if (this.ledgerTabTapCount >= 5 && !this.ledgerTechnicalMode) {
            if (!this.hasBlockchainAdminAccess()) {
                this.messageService.showWarning(this.translate.instant('STOCK_MGMT.MESSAGES.ADMIN_ONLY_BLOCKCHAIN'));
                this.ledgerTabTapCount = 0;
                return;
            }
            this.ledgerTechnicalMode = true;
            this.messageService.showSuccess(this.translate.instant('STOCK_MGMT.MESSAGES.BLOCKCHAIN_MODE_ACTIVE'));
            this.refreshBlockchainTechnicalData();
        }
    }

    hasBlockchainAdminAccess(): boolean {
        return this.authService.getRole() === 'ADMIN';
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
                if (this.autoOpenOrderModal) {
                    this.autoOpenOrderModal = false;
                    setTimeout(() => this.openOrderModal());
                }
                setTimeout(() => { this.loadingAlerts = false; this.cdr.markForCheck(); });
            },
            error: () => {
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
        this.loadAlertChartData(alert, alert.projectedConsumption / 14);
    }

    closeMobileModal(): void {
        this.showMobileModal = false;
        this.selectedAlertForMobile = null;
    }

    getSeverityClass(s: AlertSeverity): string {
        return { CRITICAL: 'severity-critical', HIGH: 'severity-high', MEDIUM: 'severity-medium', LOW: 'severity-low', OK: 'severity-ok' }[s] ?? '';
    }
    getSeverityLabel(s: AlertSeverity): string {
        return this.translate.instant('STOCK_MGMT.ALERTS.STATS.' + s);
    }

    getResolutionClass(r: AlertResolution): string {
        return { COVERED_BY_ORDER: 'resolution-covered', PARTIALLY_COVERED: 'resolution-partial', UNCOVERED: 'resolution-uncovered', EXPIRING: 'resolution-expiring', OK: 'resolution-ok' }[r] ?? '';
    }

    getResolutionIcon(r: AlertResolution): string {
        return { COVERED_BY_ORDER: '', PARTIALLY_COVERED: '', UNCOVERED: '', EXPIRING: '', OK: '' }[r] ?? '';
    }

    getResolutionLabel(r: AlertResolution): string {
        return this.translate.instant('STOCK_MGMT.ALERTS.RESOLUTION.' + r);
    }

    getAlertTypeClass(t?: AlertType): string {
        return { PREDICTION: 'alert-type-prediction', EXPIRATION: 'alert-type-expiration', COMBINED: 'alert-type-combined' }[t || 'PREDICTION'] ?? '';
    }

    getAlertTypeLabel(t?: AlertType): string {
        return this.translate.instant('STOCK_MGMT.ALERTS.TYPE.' + (t || 'PREDICTION'));
    }

    countBySeverity(s: AlertSeverity): number { return this.alerts.filter(a => a.severity === s).length; }

    countByType(t: AlertType): number { return this.alerts.filter(a => (a.alertType || 'PREDICTION') === t).length; }

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
        const ids = this.alerts
            .filter(a => (a.alertType || 'PREDICTION') !== 'EXPIRATION')
            .filter(a => a.resolution === 'UNCOVERED' || a.resolution === 'PARTIALLY_COVERED')
            .map(a => a.productId);
        if (ids.length === 0) {
            this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.NO_UNCOVERED_PRODUCTS'));
            return;
        }

        this.loadingOrderData = true;
        this.stockAlertService.getBatchAlerts(ids).pipe(
            switchMap((alerts: StockAlertDTO[]) => {
                const priceRequests = alerts.map((a: StockAlertDTO) => this.productService.getById(a.productId).pipe(
                    map((product: Product) => {
                        const item: WeeklyPlanRepositionOrderItem = {
                            ...a,
                            unitPrice: product.unitPrice || 0,
                            supplierId: product.supplier?.id ?? null,
                            supplierName: product.supplier?.name ?? null,
                            orderQuantity: 0,
                            // Populate mandatory WeeklyPlanStockRequirement fields
                            requiredQuantity: a.effectiveGap || 0,
                            grossRequiredQuantity: a.effectiveGap || 0,
                            availabilityPercentage: a.currentStock > 0 ? 100 : 0,
                            availableStock: a.currentStock || 0,
                            grossAvailableStock: a.currentStock || 0,
                            reservedByOtherPlans: 0,
                            grossReservedByOtherPlans: 0,
                            sufficient: a.severity === 'OK'
                        };
                        return item;
                    })
                ));
                return forkJoin(priceRequests);
            }),
            finalize(() => {
                this.loadingOrderData = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data: WeeklyPlanRepositionOrderItem[]) => {
                this.orderItems = data;
                this.showOrderModal = true;
            },
            error: () => this.loadingOrderData = false
        });
    }

    loadSuppliers(): void {
        if (this.loadingSuppliers || this.suppliers.length > 0) return;
        this.loadingSuppliers = true;
        this.supplierService.getAll(0, 50, 'name,asc').pipe(
            finalize(() => {
                this.loadingSuppliers = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (page) => {
                this.suppliers = page?.content || [];
            },
            error: () => {
            }
        });
    }

    openOrderModalForSingleProduct(alert: StockAlertDTO): void {
        this.loadingOrderData = true;
        this.productService.getById(alert.productId).pipe(
            map((product: Product) => {
                const item: WeeklyPlanRepositionOrderItem = {
                    ...alert,
                    unitPrice: product.unitPrice || 0,
                    supplierId: product.supplier?.id ?? null,
                    supplierName: product.supplier?.name ?? null,
                    orderQuantity: 0,
                    requiredQuantity: alert.effectiveGap || 0,
                    grossRequiredQuantity: alert.effectiveGap || 0,
                    availabilityPercentage: 100,
                    availableStock: alert.currentStock || 0,
                    grossAvailableStock: alert.currentStock || 0,
                    reservedByOtherPlans: 0,
                    grossReservedByOtherPlans: 0,
                    sufficient: false
                };
                return item;
            }),
            finalize(() => {
                this.loadingOrderData = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (item: WeeklyPlanRepositionOrderItem) => {
                this.orderItems = [item];
                this.showOrderModal = true;
                this.closeMobileModal();
            },
            error: () => this.loadingOrderData = false
        });
    }

    closeOrderModal(): void {
        this.showOrderModal = false;
        this.orderItems = [];
        this.daysAhead = 14;
    }

    onDaysAheadChange(value: number): void {
        this.daysAhead = value;
        this.cdr.detectChanges();
    }

    getOrderQuantityCalculator = (item: WeeklyPlanRepositionOrderItem): number => {
        const daily = (item.projectedConsumption || 0) / 14;
        const needed = Math.max(0, daily * this.daysAhead - (item.currentStock || 0) - (item.pendingOrderQuantity || 0));
        return Math.ceil(needed * 100) / 100;
    }

    onStockOrderBuilderCompleted(): void {
        this.closeOrderModal();
        this.loadAlerts();
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
            'productName': 'productName'
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
        this.loadAlertChartData({
            productId: prediction.productId,
            productName: prediction.productName,
            unit: prediction.projectedConsumptionUnit,
            currentStock,
            pendingOrderQuantity: 0,
            projectedConsumption: prediction.projectedConsumption,
            effectiveGap: currentStock - prediction.projectedConsumption,
            estimatedDaysRemaining: Math.max(0, Math.round(daysOfCoverage)),
            severity: 'LOW',
            resolution: 'OK',
            message: '',
            topConsumingRecipes: [],
            alertType: 'PREDICTION'
        }, dailyAvg);
    }

    closePredictionMobileModal(): void {
        this.showPredictionMobileModal = false;
        this.selectedPredictionForMobile = null;
    }

    loadAlertChartData(alert: StockAlertDTO, dailyAverage = alert.projectedConsumption / 14): void {
        this.loadingModalChart = true;
        this.stockOutDay = null;
        this.modalChartData = { labels: [], datasets: [] };
        this.modalChartMode = (alert.alertType || 'PREDICTION').toLowerCase() as AlertChartMode;
        this.modalChartTitle = alert.alertType === 'EXPIRATION'
            ? this.translate.instant('STOCK_MGMT.ALERTS.CHART.TITLE_EXPIRATION')
            : alert.alertType === 'COMBINED'
                ? this.translate.instant('STOCK_MGMT.ALERTS.CHART.TITLE_COMBINED')
                : this.translate.instant('STOCK_MGMT.ALERTS.CHART.TITLE_CONSUMPTION');
        this.cdr.markForCheck();

        forkJoin({
            history: this.stockLedgerService.getConsumptionBreakdown(alert.productId, { lastDays: 14 }),
            forecast: this.stockAlertService.getDailyForecastByProduct(alert.productId).pipe(
                catchError(() => of(null as DailyForecastResponse | null))
            )
        }).subscribe({
            next: ({ history, forecast }: { history: ConsumptionBreakdownDTO, forecast: DailyForecastResponse | null }) => {
                this.ngZone.run(() => {
                    this.modalChartData = this.buildAlertChartData(alert, history, forecast, dailyAverage);

                    this.loadingModalChart = false;
                    this.cdr.markForCheck();
                });
            },
            error: () => {
                this.loadingModalChart = false;
                this.cdr.markForCheck();
            }
        });
    }

    private buildAlertChartData(
        alert: StockAlertDTO,
        history: ConsumptionBreakdownDTO,
        forecast: DailyForecastResponse | null,
        dailyAverage: number
    ): ChartData<'line' | 'bar'> {
        if ((alert.alertType || 'PREDICTION') === 'EXPIRATION') {
            return this.buildExpirationChartData(alert, forecast);
        }

        return this.buildConsumptionChartData(alert, history, forecast, dailyAverage, alert.alertType === 'COMBINED');
    }

    private buildConsumptionChartData(
        alert: StockAlertDTO,
        history: ConsumptionBreakdownDTO,
        forecast: DailyForecastResponse | null,
        dailyAverage: number,
        includeExpirations: boolean
    ): ChartData<'line' | 'bar'> {
        const labels: string[] = [];
        const historyData: (number | null)[] = [];
        const predictionData: (number | null)[] = [];
        const stockLevelData: (number | null)[] = [];

        history.breakdown.forEach((day: any) => {
            labels.push(new Date(day.date).toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'short' }));
            historyData.push(day.consumed);
            predictionData.push(null);
            stockLevelData.push(null);
        });

        const today = new Date();
        const todayDateStr = today.toISOString().split('T')[0];
        const existingToday = history.breakdown.find((d: any) => d.date === todayDateStr);

        labels.push(this.translate.instant('STOCK_MGMT.ALERTS.CHART.TODAY'));
        historyData.push(existingToday ? existingToday.consumed : 0);
        predictionData.push(dailyAverage);
        stockLevelData.push(alert.currentStock);

        const expirationMap = new Map<string, number>();
        if (includeExpirations && forecast?.activeBatches?.length) {
            forecast.activeBatches.forEach(batch => {
                if (batch.expirationDate && !batch.depleted) {
                    const qty = expirationMap.get(batch.expirationDate) || 0;
                    expirationMap.set(batch.expirationDate, qty + batch.remainingQuantity);
                }
            });
        }

        let tempStock = alert.currentStock;
        let outDayFound = false;
        const forecastValues = forecast?.dailyForecast?.length ? forecast.dailyForecast : Array(14).fill(dailyAverage);

        for (let i = 0; i < forecastValues.length; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i + 1);
            const dateStr = date.toISOString().split('T')[0];

            labels.push(date.toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'short' }));
            historyData.push(null);
            const dailyConsumption = forecastValues[i] || 0;
            predictionData.push(dailyConsumption);

            tempStock = Math.max(0, tempStock - dailyConsumption);

            const expiringQty = expirationMap.get(dateStr);
            if (expiringQty !== undefined && tempStock > 0) {
                tempStock = Math.max(0, tempStock - expiringQty);
            }

            stockLevelData.push(tempStock);

            if (tempStock === 0 && !outDayFound) {
                this.stockOutDay = date.toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
                outDayFound = true;
            }
        }

        return {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: includeExpirations ? this.translate.instant('STOCK_MGMT.ALERTS.CHART.ESTIMATED_STOCK_EXP') : this.translate.instant('STOCK_MGMT.ALERTS.CHART.ESTIMATED_STOCK'),
                    data: stockLevelData,
                    borderColor: includeExpirations ? '#f59e0b' : '#0ea5e9',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: includeExpirations ? '#f59e0b' : '#0ea5e9',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.1,
                    order: 1,
                    spanGaps: true
                } as any,
                {
                    type: 'bar',
                    label: this.translate.instant('STOCK_MGMT.ALERTS.CHART.HISTORY'),
                    data: historyData,
                    backgroundColor: 'rgba(54, 162, 235, 0.4)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    order: 2
                } as any,
                {
                    type: 'bar',
                    label: this.translate.instant('STOCK_MGMT.ALERTS.CHART.PROJECTED'),
                    data: predictionData,
                    backgroundColor: includeExpirations ? 'rgba(245, 158, 11, 0.28)' : 'rgba(255, 99, 132, 0.3)',
                    borderColor: includeExpirations ? 'rgba(245, 158, 11, 1)' : 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    order: 2
                } as any
            ]
        };
    }

    private buildExpirationChartData(alert: StockAlertDTO, forecast: DailyForecastResponse | null): ChartData<'line' | 'bar'> {
        const batches = (forecast?.activeBatches || [])
            .filter(batch => batch.expirationDate && !batch.depleted)
            .slice()
            .sort((left, right) => left.expirationDate!.localeCompare(right.expirationDate!));

        const labels = batches.map(batch => new Date(batch.expirationDate as string).toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'short' }));
        const quantities = batches.map(batch => batch.remainingQuantity);
        const stockLine = batches.map(() => alert.currentStock);

        if (batches.length > 0) {
            this.stockOutDay = batches[0].expirationDate
                ? new Date(batches[0].expirationDate).toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'long', year: 'numeric' })
                : null;
        }

        return {
            labels: labels.length > 0 ? labels : [this.translate.instant('STOCK_MGMT.ALERTS.CHART.NO_BATCHES')],
            datasets: [
                {
                    type: 'bar',
                    label: this.translate.instant('STOCK_MGMT.ALERTS.CHART.QTY_EXPIRATION'),
                    data: labels.length > 0 ? quantities : [0],
                    backgroundColor: 'rgba(245, 158, 11, 0.35)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1,
                    order: 2
                } as any,
                {
                    type: 'line',
                    label: this.translate.instant('STOCK_MGMT.ALERTS.CHART.CURRENT_STOCK'),
                    data: labels.length > 0 ? stockLine : [alert.currentStock],
                    borderColor: '#22c55e',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.1,
                    order: 1,
                    spanGaps: true
                } as any
            ]
        };
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString(this.getLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
                    name: item.name || item.nombre || this.translate.instant('STOCK_MGMT.LEDGER.NO_NAME'),
                    unit: item.unit || item.unidad || this.translate.instant('STOCK_MGMT.LEDGER.NO_UNIT')
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

    openLedgerBarcodeScanner(): void {
        this.showLedgerScannerModal = true;
    }

    closeLedgerBarcodeScanner(): void {
        this.showLedgerScannerModal = false;
    }

    onLedgerProductFound(product: Product): void {
        this.closeLedgerBarcodeScanner();
        this.ledgerSearchTerm = product.name || '';
        this.selectedProductId = product.id;
        this.ledgerProducts = [product, ...(this.ledgerProducts || []).filter(item => item.id !== product.id)];
        this.showLedgerDropdown = false;
        this.ledgerPage = 0;
        this.loadLedgerHistory(product.id);
        this.loadLedgerSnapshot(product.id);
        this.loadLedgerProducts(0, false);
    }

    get selectedProductName(): string {
        if (!this.selectedProductId) return this.translate.instant('STOCK_MGMT.LEDGER.SELECT_PRODUCT_PLACEHOLDER');
        const p = this.ledgerProducts.find(p => p.id === this.selectedProductId);
        return p ? `${p.name} (${p.unit})` : this.translate.instant('STOCK_MGMT.LEDGER.SELECTED_PRODUCT');
    }

    get selectedLedgerUnit(): string {
        if (!this.selectedProductId) return this.translate.instant('STOCK_MGMT.LEDGER.NO_UNIT');
        const product = this.ledgerProducts.find(p => p.id === this.selectedProductId);
        return product?.unit || this.translate.instant('STOCK_MGMT.LEDGER.NO_UNIT');
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

    refreshBlockchainTechnicalData(): void {
        if (!this.ledgerTechnicalMode) return;
        this.loadBlockchainStats();
        this.loadBlockchainVerification();
        this.loadBlockchainBlocks(0);
        this.loadBlockchainMempool(0);
    }

    loadBlockchainStats(): void {
        this.loadingBlockchainStats = true;
        this.stockLedgerService.getBlockchainStats().pipe(
            finalize(() => {
                this.loadingBlockchainStats = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data) => {
                this.blockchainStats = data;
            },
            error: () => { }
        });
    }

    loadBlockchainVerification(): void {
        this.loadingBlockchainVerification = true;
        this.stockLedgerService.verifyBlockchain().pipe(
            finalize(() => {
                this.loadingBlockchainVerification = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data) => {
                this.blockchainVerification = data;
            },
            error: () => { }
        });
    }

    loadBlockchainBlocks(page = 0): void {
        this.loadingBlockchainBlocks = true;
        this.stockLedgerService.getBlockchainBlocks(page, 8, 'blockNumber,desc').pipe(
            finalize(() => {
                this.loadingBlockchainBlocks = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data) => {
                this.blockchainBlocks = data?.content || [];
                this.blockchainBlocksPage = page;
                this.blockchainBlocksTotalPages = data?.totalPages || 0;
            },
            error: () => { }
        });
    }

    loadBlockchainMempool(page = 0): void {
        this.loadingBlockchainMempool = true;
        this.stockLedgerService.getMempool(page, 8, 'id,asc').pipe(
            finalize(() => {
                this.loadingBlockchainMempool = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data) => {
                this.blockchainMempool = data?.content || [];
                this.blockchainMempoolPage = page;
                this.blockchainMempoolTotalPages = data?.totalPages || 0;
            },
            error: () => { }
        });
    }

    onBlockchainBlocksPageChange(delta: number): void {
        const next = this.blockchainBlocksPage + delta;
        if (next < 0 || next >= this.blockchainBlocksTotalPages) return;
        this.loadBlockchainBlocks(next);
    }

    onBlockchainMempoolPageChange(delta: number): void {
        const next = this.blockchainMempoolPage + delta;
        if (next < 0 || next >= this.blockchainMempoolTotalPages) return;
        this.loadBlockchainMempool(next);
    }

    openBlockchainBlockDetail(blockNumber: number): void {
        this.loadingBlockchainBlockDetail = true;
        this.stockLedgerService.getBlockchainBlock(blockNumber).pipe(
            finalize(() => {
                this.loadingBlockchainBlockDetail = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (data) => {
                this.selectedBlockchainBlock = data;
            },
            error: () => { }
        });
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
                    this.messageService.showSuccess(this.translate.instant('STOCK_MGMT.MESSAGES.INTEGRITY_VALID', {message: res.message}));
                } else {
                    this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.INTEGRITY_CORRUPTED', {message: res.message}));
                }
            },
            error: () => this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_VERIFY_INTEGRITY'))
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
                    this.messageService.showSuccess(this.translate.instant('STOCK_MGMT.MESSAGES.ALL_CHAINS_VALID', {count: res.length}), 5000);
                } else {
                    this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.GLOBAL_CORRUPTION_DETECTED', {count: corrupted.length}), 8000);
                }
                
                // Scroll to results section with offset to avoid covering the title
                setTimeout(() => {
                    const el = document.getElementById('globalVerificationResults');
                    if (el) {
                        const scrollContainer = document.querySelector<HTMLElement>('.scrollable-content')
                            ?? document.querySelector<HTMLElement>('.contenedor-principal');

                        if (scrollContainer) {
                            const targetTop = el.offsetTop - 20;
                            scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
                            return;
                        }

                        const yOffset = -20;
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            },
            error: () => this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_GLOBAL_VERIFICATION'))
        });
    }

    async downloadPdfById(productId: number): Promise<void> {
        const confirmed = await this.messageService.confirm(
            this.translate.instant('STOCK_MGMT.MODALS.CONFIRM_DOWNLOAD_TITLE'),
            this.translate.instant('STOCK_MGMT.MODALS.CONFIRM_DOWNLOAD_TEXT')
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
                    this.messageService.showSuccess(this.translate.instant('STOCK_MGMT.MESSAGES.PDF_GENERATED_OK', {message: message}));
                } else {
                    this.messageService.showWarning(this.translate.instant('STOCK_MGMT.MESSAGES.PDF_GENERATED_WARNING', {message: message}));
                }
            },
            error: () => this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_GENERATE_PDF'))
        });
    }

    downloadPdf(): void {
        if (!this.selectedProductId) return;
        void this.downloadPdfById(this.selectedProductId);
    }

    async resetProductHistory(): Promise<void> {
        if (!this.selectedProductId) return;

        const confirm1 = await this.messageService.confirm(
            this.translate.instant('STOCK_MGMT.MODALS.RESET_SECURITY_TITLE'),
            this.translate.instant('STOCK_MGMT.MODALS.RESET_SECURITY_TEXT')
        );
        if (!confirm1) return;

        const confirm2 = await this.messageService.confirm(
            this.translate.instant('STOCK_MGMT.MODALS.RESET_IRREVERSIBLE_TITLE'),
            this.translate.instant('STOCK_MGMT.MODALS.RESET_IRREVERSIBLE_TEXT')
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
            error: (err) => this.messageService.showError(err.error || this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_RESET_HISTORY'))
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
        this.adjustmentBatchReference = '';
        this.adjustmentExpirationDate = '';
        this.batchTypeaheadSuggestions = [];
        this.productBatchService.getActiveBatches(this.selectedProductId).subscribe({
            next: (batches) => {
                this.activeBatchesForAdjustment = batches;
                this.cdr.detectChanges();
            },
            error: () => this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_LOAD_BATCHES'))
        });
    }

    closeManualAdjustmentModal(): void {
        this.showManualAdjustmentModal = false;
        this.activeBatchesForAdjustment = [];
        this.batchTypeaheadSuggestions = [];
        this.adjustmentBatchReference = '';
    }

    onAdjustmentBatchReferenceInput(): void {
        this.adjustmentBatchId = null;
        this.adjustmentBatchSearchSubject.next(this.adjustmentBatchReference);
    }

    selectBatchSuggestion(suggestion: BatchTypeaheadDTO): void {
        this.adjustmentBatchId = suggestion.id;
        this.adjustmentBatchReference = suggestion.batchCode?.trim()
            ? suggestion.batchCode.trim()
            : `#${suggestion.id}`;
        this.batchTypeaheadSuggestions = [];
        this.cdr.detectChanges();
    }

    onAdjustmentBatchReferenceFocus(): void {
        const clean = this.adjustmentBatchReference.trim();
        if (!clean) {
            this.batchTypeaheadSuggestions = [...this.activeBatchesForAdjustment];
            this.cdr.detectChanges();
            return;
        }

        this.onAdjustmentBatchReferenceInput();
    }

    private loadBatchTypeahead(query: string): void {
        const clean = query?.trim() || '';
        if (!this.selectedProductId || clean.length < 1) {
            this.batchTypeaheadSuggestions = [];
            this.cdr.detectChanges();
            return;
        }

        this.productBatchService.getBatchTypeahead(clean, this.selectedProductId, 8).subscribe({
            next: (suggestions) => {
                this.batchTypeaheadSuggestions = suggestions;
                this.cdr.detectChanges();
            },
            error: () => {
                this.batchTypeaheadSuggestions = [];
                this.cdr.detectChanges();
            }
        });
    }

    submitManualAdjustment(): void {
        if (!this.selectedProductId || !this.absoluteAdjustmentQuantity || !this.adjustmentDescription) return;
        
        // If no batch is selected and we're adding stock, expiration date is mandatory (Backend DTO requirement)
        if (!this.adjustmentBatchId
            && this.adjustmentBatchReference.trim().length === 0
            && this.adjustmentDirection === 'ENTRY'
            && !this.adjustmentExpirationDate) {
            this.messageService.showError(this.translate.instant('STOCK_MGMT.MESSAGES.EXPIRATION_DATE_REQUIRED'));
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
            batchReference: (!this.adjustmentBatchId && this.adjustmentBatchReference.trim().length > 0)
                ? this.adjustmentBatchReference.trim()
                : undefined,
            expirationDate: (!this.adjustmentBatchId
                && this.adjustmentBatchReference.trim().length === 0
                && this.adjustmentDirection === 'ENTRY') ? this.adjustmentExpirationDate : undefined
        };

        this.submittingAdjustment = true;
        this.stockLedgerService.registerManualAdjustment(request).pipe(
            finalize(() => { this.submittingAdjustment = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: () => {
                this.messageService.showSuccess(this.translate.instant('STOCK_MGMT.MESSAGES.ADJUSTMENT_SUCCESS'));
                this.closeManualAdjustmentModal();
                this.loadLedgerHistory(this.selectedProductId!);
                this.loadLedgerSnapshot(this.selectedProductId!);
            },
            error: (err) => this.messageService.showError(err.error?.message || this.translate.instant('STOCK_MGMT.MESSAGES.ERROR_REGISTER_ADJUSTMENT'))
        });
    }


    getMovementTypeClass(type: string): string {
        const map: Record<string, string> = {
            ENTRADA: 'movement-entrada',
            SALIDA: 'movement-salida',
            AJUSTE: 'movement-ajuste',
            MERMA: 'movement-merma',
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
