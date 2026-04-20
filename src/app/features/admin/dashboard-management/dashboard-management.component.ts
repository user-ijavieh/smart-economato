import { Component, OnInit, OnDestroy, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardData } from '../../../shared/models/dashboard.model';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../../core/services/theme.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dashboard-management',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard-management.component.html',
  styleUrl: './dashboard-management.component.css'
})
export class DashboardManagementComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  dashboardData?: DashboardData;
  loading = true;
  activeTab: 'summary' | 'detailed' = 'summary'; // Pattern following users-management
  currentPeriod: 'week' | 'month' | 'year' = 'month';

  // Chart configuration
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },

    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 12 } },
        title: {
          display: true,
          text: 'Proveedores',
          color: 'rgba(255, 255, 255, 0.7)',
          font: { size: 16, weight: 500 },
          padding: { top: 15 }
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          font: { size: 12 },
          callback: (value: any) => value + ' €'
        },
        title: {
          display: true,
          text: 'Total gastos en euros',
          color: 'rgba(255, 255, 255, 0.7)',
          font: { size: 16, weight: 500 },
          padding: { bottom: 15 }
        }
      }
    }
  };

  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: 'rgba(90, 120, 220, 0.7)',
        hoverBackgroundColor: 'rgba(90, 120, 220, 0.9)',
        borderRadius: 6,
      }
    ]
  };

  ngOnInit(): void {
    this.loadDashboardData();
    this.listenToThemeChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private listenToThemeChanges(): void {
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.updateChartTheme(theme);
      });
  }

  private updateChartTheme(theme: 'dark' | 'light'): void {
    const isDark = theme === 'dark';

    // Axis title colors
    const titleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(51, 65, 85, 0.8)';
    const tickColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(100, 116, 139, 0.6)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    if (this.barChartOptions?.scales?.['x']) {
      const xScale: any = this.barChartOptions.scales['x'];
      xScale.ticks.color = tickColor;
      xScale.title.color = titleColor;
    }

    if (this.barChartOptions?.scales?.['y']) {
      const yScale: any = this.barChartOptions.scales['y'];
      yScale.ticks.color = tickColor;
      yScale.title.color = titleColor;
      yScale.grid.color = gridColor;
    }

    this.chart?.update();
    this.cdr.detectChanges();
  }

  get userName(): string {
    return this.authService.getName() || 'Administrador';
  }

  get userInitials(): string {
    const name = this.userName;
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  loadDashboardData(): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.updateChartData();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading dashboard data', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  switchTab(tab: 'summary' | 'detailed'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  setPeriod(period: 'week' | 'month' | 'year'): void {
    this.currentPeriod = period;
    this.updateChartData();
  }

  updateChartData(): void {
    if (!this.dashboardData) return;

    const periodData = this.dashboardData.expenses[this.currentPeriod];
    this.barChartData.labels = periodData.map(d => d.label);
    this.barChartData.datasets[0].data = periodData.map(d => d.value);

    this.chart?.update();
    this.cdr.detectChanges();
  }
}
