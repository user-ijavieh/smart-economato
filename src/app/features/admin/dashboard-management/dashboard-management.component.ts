import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardData } from '../../../shared/models/dashboard.model';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-dashboard-management',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard-management.component.html',
  styleUrl: './dashboard-management.component.css'
})
export class DashboardManagementComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

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
        ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: 'rgba(255, 255, 255, 0.4)', 
          font: { size: 10 },
          callback: (value: any) => value + ' €'
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
