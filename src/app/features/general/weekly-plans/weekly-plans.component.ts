import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { WeeklyPlanResponse } from '../../../shared/models/weekly-plan.model';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-weekly-plans',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-plans.component.html',
  styleUrls: ['./weekly-plans.component.css']
})
export class WeeklyPlansComponent implements OnInit {
  private weeklyPlanService = inject(WeeklyPlanService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentPlan: WeeklyPlanResponse | null = null;
  loadingCurrent = true;
  currentWeekDraftPlan: WeeklyPlanResponse | null = null;
  loadingList = true;

  upcomingPlans: WeeklyPlanResponse[] = [];
  pastPlans: WeeklyPlanResponse[] = [];

  ngOnInit() {
    this.loadCurrentPlan();
    this.loadAllPlans();
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
    // For chef/elevated we just want their plans, but currently API returns all or filtered by role logic in backend.
    this.weeklyPlanService.getAllPlans(0, 50).subscribe({
      next: (page) => {
        const now = new Date();
        const plans = page.content;
        
        // Split into upcoming (drafts, active future) vs past (completed, cancelled)
        // Sort upcoming by date descending (furthest first)
        this.upcomingPlans = plans
          .filter(p => p.status === 'DRAFT' || p.status === 'ACTIVE')
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
    const day = now.getDay(); // 0-6 (Sun-Sat)
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0) to get Monday
    
    const monday = new Date(now.setDate(diff));
    
    // Format as YYYY-MM-DD manually to avoid timezone issues
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const date = String(monday.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${date}`;
  }

  createNew() {
    // Navigate to wizard
    this.router.navigate(['/weekly-plans/wizard']);
  }

  openDetail(plan: WeeklyPlanResponse) {
    this.router.navigate(['/weekly-plans', plan.id]);
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
      DRAFT: 'Borrador',
      ACTIVE: 'Activo',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };

    return labels[status] || status;
  }
}
