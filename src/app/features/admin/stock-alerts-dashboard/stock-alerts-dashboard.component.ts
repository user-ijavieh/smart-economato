import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { OrderService } from '../../../core/services/order.service';
import { MessageService } from '../../../core/services/message.service';
import { StockAlertDTO, AlertSeverity, AlertResolution } from '../../../shared/models/stock-alert.model';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';

@Component({
    selector: 'app-stock-alerts-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, ToastComponent],
    templateUrl: './stock-alerts-dashboard.component.html',
    styleUrl: './stock-alerts-dashboard.component.css'
})
export class StockAlertsDashboardComponent implements OnInit {
    private stockAlertService = inject(StockAlertService);
    private orderService = inject(OrderService);
    messageService = inject(MessageService);

    alerts: StockAlertDTO[] = [];
    loading = false;
    severityFilter: AlertSeverity | '' = '';

    // Expanded message rows
    expandedMessages = new Set<number>();

    // Order modal
    showOrderModal = false;
    daysAhead = 14;
    orderAlerts: StockAlertDTO[] = [];
    creatingOrder = false;

    ngOnInit(): void {
        this.loadAlerts();
    }

    loadAlerts(): void {
        this.loading = true;
        const severity = this.severityFilter || undefined;
        this.stockAlertService.getActiveAlerts(severity as AlertSeverity | undefined).subscribe({
            next: (data) => {
                this.alerts = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading alerts:', err);
                this.messageService.showError('Error al cargar las alertas de stock');
                this.loading = false;
            }
        });
    }

    onSeverityChange(): void {
        this.loadAlerts();
    }

    toggleMessage(productId: number): void {
        if (this.expandedMessages.has(productId)) {
            this.expandedMessages.delete(productId);
        } else {
            this.expandedMessages.add(productId);
        }
    }

    isExpanded(productId: number): boolean {
        return this.expandedMessages.has(productId);
    }

    getSeverityClass(severity: AlertSeverity): string {
        switch (severity) {
            case 'CRITICAL': return 'severity-critical';
            case 'HIGH': return 'severity-high';
            case 'MEDIUM': return 'severity-medium';
            case 'LOW': return 'severity-low';
            case 'OK': return 'severity-ok';
            default: return '';
        }
    }

    getResolutionClass(resolution: AlertResolution): string {
        switch (resolution) {
            case 'COVERED_BY_ORDER': return 'resolution-covered';
            case 'PARTIALLY_COVERED': return 'resolution-partial';
            case 'UNCOVERED': return 'resolution-uncovered';
            case 'OK': return 'resolution-ok';
            default: return '';
        }
    }

    getResolutionIcon(resolution: AlertResolution): string {
        switch (resolution) {
            case 'COVERED_BY_ORDER': return '✓';
            case 'PARTIALLY_COVERED': return '⚠';
            case 'UNCOVERED': return '✗';
            case 'OK': return '✓';
            default: return '';
        }
    }

    getResolutionLabel(resolution: AlertResolution): string {
        switch (resolution) {
            case 'COVERED_BY_ORDER': return 'Cubierto';
            case 'PARTIALLY_COVERED': return 'Parcial';
            case 'UNCOVERED': return 'No cubierto';
            case 'OK': return 'OK';
            default: return resolution;
        }
    }

    // ── Stats ──

    countBySeverity(severity: AlertSeverity): number {
        return this.alerts.filter(a => a.severity === severity).length;
    }

    // ── Create Order Modal ──

    openOrderModal(): void {
        const uncoveredIds = this.alerts
            .filter(a => a.resolution === 'UNCOVERED' || a.resolution === 'PARTIALLY_COVERED')
            .map(a => a.productId);

        if (uncoveredIds.length === 0) {
            this.messageService.showError('No hay productos sin cubrir para generar una orden.');
            return;
        }

        this.stockAlertService.getBatchAlerts(uncoveredIds).subscribe({
            next: (data) => {
                this.orderAlerts = data;
                this.showOrderModal = true;
            },
            error: () => {
                this.messageService.showError('Error al calcular los productos para la orden');
            }
        });
    }

    closeOrderModal(): void {
        this.showOrderModal = false;
        this.orderAlerts = [];
        this.daysAhead = 14;
    }

    getOrderQuantity(alert: StockAlertDTO): number {
        const dailyConsumption = alert.projectedConsumption / 14;
        const needed = dailyConsumption * this.daysAhead;
        const gap = Math.max(0, needed - alert.currentStock - alert.pendingOrderQuantity);
        return Math.ceil(gap * 100) / 100;
    }

    confirmCreateOrder(): void {
        const details = this.orderAlerts
            .map(a => ({ productId: a.productId, quantity: this.getOrderQuantity(a) }))
            .filter(d => d.quantity > 0);

        if (details.length === 0) {
            this.messageService.showError('No hay cantidades a pedir con los datos actuales.');
            return;
        }

        this.creatingOrder = true;

        const orderRequest = {
            orderDetails: details.map(d => ({
                productId: d.productId,
                quantity: d.quantity
            }))
        } as any;

        this.orderService.create(orderRequest).subscribe({
            next: () => {
                this.messageService.showSuccess('Orden creada correctamente');
                this.closeOrderModal();
                this.creatingOrder = false;
                this.loadAlerts();
            },
            error: (err) => {
                console.error('Error creating order:', err);
                const msg = err.error?.message || 'Error al crear la orden';
                this.messageService.showError(msg);
                this.creatingOrder = false;
            }
        });
    }
}
