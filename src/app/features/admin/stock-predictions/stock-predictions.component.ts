import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { StockAlertService } from '../../../core/services/stock-alert.service';
import { MessageService } from '../../../core/services/message.service';
import { StockPredictionResponseDTO } from '../../../shared/models/stock-alert.model';
import { Page } from '../../../shared/models/page.model';

@Component({
    selector: 'app-stock-predictions',
    standalone: true,
    imports: [CommonModule, ToastComponent],
    templateUrl: './stock-predictions.component.html',
    styleUrl: './stock-predictions.component.css'
})
export class StockPredictionsComponent implements OnInit {
    private stockAlertService = inject(StockAlertService);
    messageService = inject(MessageService);

    predictions: StockPredictionResponseDTO[] = [];
    loading = false;
    currentPage = 0;
    pageSize = 10;
    totalPages = 0;
    totalElements = 0;

    ngOnInit(): void {
        this.loadPredictions();
    }

    loadPredictions(page = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.stockAlertService.getPredictions(page, this.pageSize).subscribe({
            next: (data: Page<StockPredictionResponseDTO>) => {
                this.predictions = data.content;
                this.totalPages = data.totalPages;
                this.totalElements = data.totalElements;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading predictions:', err);
                this.messageService.showError('Error al cargar las predicciones');
                this.loading = false;
            }
        });
    }

    changePage(delta: number): void {
        const next = this.currentPage + delta;
        if (next >= 0 && next < this.totalPages) {
            this.loadPredictions(next);
        }
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}
