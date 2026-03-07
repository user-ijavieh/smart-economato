import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { StockAlertDTO, StockPredictionResponseDTO, AlertSeverity, AlertResolution } from '../../../shared/models/stock-alert.model';
import { Page } from '../../../shared/models/page.model';

type Tab = 'alerts' | 'predictions';

@Component({
    selector: 'app-stock-management',
    standalone: true,
    imports: [CommonModule, FormsModule, ToastComponent],
    templateUrl: './stock-management.component.html',
    styleUrl: './stock-management.component.css'
})
export class StockManagementComponent implements OnInit {
    private stockAlertService = inject(StockAlertService);
    private productService = inject(ProductService);
    private orderService = inject(OrderService);
    private cdr = inject(ChangeDetectorRef);
    private authService = inject(AuthService);
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

    ngOnInit(): void {
        this.loadAlerts();
    }

    switchTab(tab: Tab): void {
        this.activeTab = tab;
        if (tab === 'predictions' && this.predictions.length === 0) {
            this.loadPredictions();
        } else {
            this.cdr.detectChanges();
        }
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
}
