import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { WeeklyPlanResponse } from '../../../shared/models/weekly-plan.model';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-weekly-plans',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './weekly-plans.component.html',
  styleUrls: ['./weekly-plans.component.css']
})
export class WeeklyPlansComponent implements OnInit, OnDestroy {
  private weeklyPlanService = inject(WeeklyPlanService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  currentPlan: WeeklyPlanResponse | null = null;
  loadingCurrent = true;
  currentWeekDraftPlan: WeeklyPlanResponse | null = null;
  loadingList = true;

  upcomingPlans: WeeklyPlanResponse[] = [];
  pastPlans: WeeklyPlanResponse[] = [];

  ngOnInit() {
    this.loadCurrentPlan();
    this.loadAllPlans();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('weekly_plan')) {
          this.loadCurrentPlan();
          this.loadAllPlans();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCurrentPlan() {
    this.loadingCurrent = true;
    this.weeklyPlanService.getCurrentWeekPlan().subscribe({
      next: (plan) => {
        this.currentPlan = plan;
        this.loadingCurrent = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.currentPlan = null;
        this.loadingCurrent = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAllPlans() {
    this.loadingList = true;
    this.weeklyPlanService.getAllPlans(0, 50).subscribe({
      next: (page) => {
        const plans = page.content;
        
        // Split into upcoming (drafts, active future) vs past (completed, cancelled)
        // Sort upcoming by date descending (furthest first)
        this.upcomingPlans = plans
           .filter(p => p.status === 'DRAFT' || p.status === 'ACTIVE' || p.status === 'IN_PROGRESS')
           .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
        
        this.pastPlans = plans.filter(p => p.status === 'COMPLETED' || p.status === 'CANCELLED');
        
        this.checkCurrentWeekDraft();

        this.loadingList = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingList = false;
        this.cdr.detectChanges();
      }
    });
  }

  private checkCurrentWeekDraft() {
    if (this.currentPlan) {
      this.currentWeekDraftPlan = null;
      return;
    }

    const currentMonday = this.getCurrentMondayString();
    this.currentWeekDraftPlan = this.upcomingPlans.find(p => p.status === 'DRAFT' && p.weekStartDate === currentMonday) || null;
  }

  private getCurrentMondayString(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(now.setDate(diff));
    
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const date = String(monday.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${date}`;
  }

  createNew() {
    this.router.navigate(['/weekly-plans/wizard']);
  }

  openDetail(plan: WeeklyPlanResponse) {
    this.router.navigate(['/weekly-plans', plan.id]);
  }

  duplicatePlan(plan: WeeklyPlanResponse): void {
    const targetWeek = this.addDaysToDate(plan.weekStartDate, 7);
    this.router.navigate(['/weekly-plans/wizard'], {
      queryParams: {
        duplicateFrom: plan.id,
        weekStartDate: targetWeek,
        keepStudents: '1'
      }
    });
  }

  calculateProgress(plan: WeeklyPlanResponse): { confirmed: number, total: number, percent: number } {
    if (!plan || !plan.slots) return { confirmed: 0, total: 0, percent: 0 };
    const total = plan.slots.length;
    const confirmed = plan.slots.filter(s => s.status === 'CONFIRMED').length;
    const percent = total === 0 ? 0 : Math.round((confirmed / total) * 100);
    return { confirmed, total, percent };
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: this.translate.instant('WEEKLY_PLANS.STATUS.DRAFT'),
      ACTIVE: this.translate.instant('WEEKLY_PLANS.STATUS.ACTIVE'),
      IN_PROGRESS: this.translate.instant('WEEKLY_PLANS.STATUS.IN_PROGRESS'),
      COMPLETED: this.translate.instant('WEEKLY_PLANS.STATUS.COMPLETED'),
      CANCELLED: this.translate.instant('WEEKLY_PLANS.STATUS.CANCELLED')
    };

    return labels[status] || status;
  }

  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setDate(date.getDate() + days);
    
    // Format as YYYY-MM-DD manually to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

}
