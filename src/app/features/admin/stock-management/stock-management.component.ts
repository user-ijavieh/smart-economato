import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { StockAlertDTO, StockPredictionResponseDTO, AlertSeverity, AlertResolution } from '../../../shared/models/stock-alert.model';
import { Page } from '../../../shared/models/page.model';
import { StockLedgerService } from '../../../core/services/stock-ledger.service';
import { StockLedgerResponseDTO, IntegrityCheckResponseDTO, StockSnapshotResponseDTO } from '../../../shared/models/stock-ledger.model';
import { Product } from '../../../shared/models/product.model';
import { finalize } from 'rxjs';

type Tab = 'alerts' | 'predictions' | 'ledger';

@Component({
    selector: 'app-stock-management',
    standalone: true,
    imports: [CommonModule, FormsModule, ToastComponent],
    templateUrl: './stock-management.component.html',
    styleUrl: './stock-management.component.css'
})
export class StockManagementComponent implements OnInit, OnDestroy {
    private stockAlertService = inject(StockAlertService);
    private productService = inject(ProductService);
    private orderService = inject(OrderService);
    private cdr = inject(ChangeDetectorRef);
    private authService = inject(AuthService);
    private stockLedgerService = inject(StockLedgerService);
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
    selectedAlertForMobile: StockAlertDTO | null = null;

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
    selectedPredictionForMobile: StockPredictionResponseDTO | null = null;

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

    // ── Batch movement modal ──
    showBatchModal = false;
    batchReason = '';
    batchMovements: { productId: number; productName: string; quantityDelta: number; movementType: string; description: string }[] = [];
    processingBatch = false;

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
        this.selectedAlertForMobile = alert;
        this.showMobileModal = true;
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
            switchMap(alerts => {
                if (!alerts.length) return forkJoin([]);

                // Fetch product details for each alert to get unitPrice
                const priceRequests = alerts.map(a => this.productService.getById(a.productId).pipe(
                    map(product => ({ ...a, unitPrice: product.unitPrice || 0 }))
                ));
                return forkJoin(priceRequests);
            })
        ).subscribe({
            next: (data) => { this.orderAlerts = data as any; this.showOrderModal = true; this.loadingOrderData = false; this.cdr.detectChanges(); },
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
        this.loadingPredictions = true;
        this.currentPage = page;
        this.predictions = [];
        this.cdr.detectChanges();
        
        const backendCols: Record<string, string> = {
            'productName': 'product.name'
        };
        const backendCol = backendCols[this.sortColumnPredictions] || this.sortColumnPredictions;
        const sortParam = `${backendCol},${this.sortDirPredictions}`;

        this.stockAlertService.getPredictions(page, this.pageSize, sortParam).subscribe({
            next: (data) => {
                this.predictions = data.content;
                this.totalPages = data.totalPages;
                this.totalElements = data.totalElements;
                this.currentPage = page;
                this.loadingPredictions = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.messageService.showError('Error al cargar predicciones');
                this.loadingPredictions = false;
                this.cdr.detectChanges();
            }
        });
    }

    onSortPredictionsChange(column: string): void {
        this.sortInteractedPredictions = true;
        if (this.sortColumnPredictions === column) {
            this.sortDirPredictions = this.sortDirPredictions === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumnPredictions = column;
            this.sortDirPredictions = column === 'projectedConsumption' ? 'desc' : 'asc';
        }
        this.loadPredictions(0);
    }

    getSortPredictionsDir(column: string): string {
        if (!this.sortInteractedPredictions && this.sortColumnPredictions !== column) return 'none';
        return this.sortColumnPredictions === column ? this.sortDirPredictions : 'none';
    }

    // The applyPredictionsSorting frontend logic has been removed as the API handles sorting natively for predictions.

    changePage(delta: number): void {
        const next = this.currentPage + delta;
        if (next >= 0 && next < this.totalPages) {
            this.scrollToTop();
            this.loadPredictions(next);
        }
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const container = document.querySelector('.contenedor-principal');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    openPredictionMobileModal(prediction: StockPredictionResponseDTO): void {
        this.selectedPredictionForMobile = prediction;
        this.showPredictionMobileModal = true;
    }

    closePredictionMobileModal(): void {
        this.showPredictionMobileModal = false;
        this.selectedPredictionForMobile = null;
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
        this.cdr.detectChanges();
    }

    get selectedProductName(): string {
        if (!this.selectedProductId) return 'Seleccione un producto...';
        const p = this.ledgerProducts.find(p => p.id === this.selectedProductId);
        return p ? `${p.name} (${p.unit})` : 'Producto seleccionado';
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
        this.loadLedgerHistory(this.selectedProductId);
        
        // Scroll to the header of the history section to see filters and context
        setTimeout(() => {
            const el = document.getElementById('ledgerHistoryHeader');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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

    downloadPdfById(productId: number): void {
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
        this.downloadPdfById(this.selectedProductId);
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

    // --- Batch ---
    openBatchModal(): void {
        this.batchReason = '';
        this.batchMovements = [{ productId: 0, productName: '', quantityDelta: 0, movementType: 'AJUSTE', description: '' }];
        this.showBatchModal = true;
        this.cdr.detectChanges();
    }

    closeBatchModal(): void {
        this.showBatchModal = false;
        this.cdr.detectChanges();
    }

    addBatchMovement(): void {
        this.batchMovements.push({ productId: 0, productName: '', quantityDelta: 0, movementType: 'AJUSTE', description: '' });
    }

    removeBatchMovement(index: number): void {
        this.batchMovements.splice(index, 1);
        if (this.batchMovements.length === 0) this.addBatchMovement();
    }

    onBatchProductSelect(index: number, pid: number): void {
        const prod = this.products.find(p => p.id === Number(pid));
        if (prod) {
            this.batchMovements[index].productId = prod.id;
            this.batchMovements[index].productName = prod.name;
        }
    }

    processBatch(): void {
        const validMovements = this.batchMovements.filter(m => m.productId > 0 && m.quantityDelta !== 0);
        if (!validMovements.length) {
            this.messageService.showError('Debes añadir al menos un movimiento válido (producto y cantidad distinta de cero)');
            return;
        }
        if (!this.batchReason.trim()) {
            this.messageService.showError('Debes indicar un motivo para la operación batch');
            return;
        }

        this.processingBatch = true;
        this.cdr.detectChanges();

        const payload = {
            movements: validMovements.map(m => ({
                productId: m.productId,
                quantityDelta: m.quantityDelta,
                movementType: m.movementType as any,
                description: m.description || this.batchReason
            })),
            reason: this.batchReason,
            orderId: null,
            recipeCookingAuditId: null
        };

        this.stockLedgerService.processBatch(payload).pipe(
            finalize(() => { this.processingBatch = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (res) => {
                this.messageService.showSuccess(res.message);
                this.closeBatchModal();
                if (this.selectedProductId && validMovements.some(m => m.productId === this.selectedProductId)) {
                    this.onProductSelect(this.selectedProductId);
                }
            },
            error: (err) => {
                this.messageService.showError(err.error?.message || err.error?.errorDetail || 'Error al procesar lote');
            }
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
