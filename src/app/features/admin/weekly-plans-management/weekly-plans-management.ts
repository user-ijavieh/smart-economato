import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { UserService } from '../../../core/services/user.service';
import { WeeklyPlanResponse } from '../../../shared/models/weekly-plan.model';
import { User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-weekly-plans-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weekly-plans-management.html',
  styleUrl: './weekly-plans-management.css',
})
export class WeeklyPlansManagement implements OnInit {
  private weeklyPlanService = inject(WeeklyPlanService);
  private userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  teachers: User[] = [];
  selectedTeacherId: number | null = null;
  loadingTeachers = false;

  plans: WeeklyPlanResponse[] = [];
  loadingPlans = false;

  ngOnInit(): void {
    this.loadTeachers();
    this.loadPlans();
  }

  get selectedTeacher(): User | null {
    if (!this.selectedTeacherId) {
      return null;
    }
    return this.teachers.find(teacher => teacher.id === this.selectedTeacherId) || null;
  }

  get visiblePlans(): WeeklyPlanResponse[] {
    if (!this.selectedTeacherId) {
      return this.plans;
    }
    return this.plans.filter(plan => plan.chefId === this.selectedTeacherId);
  }

  get totalPlans(): number {
    return this.visiblePlans.length;
  }

  get activePlans(): number {
    return this.visiblePlans.filter(plan => plan.status === 'ACTIVE' || plan.status === 'IN_PROGRESS').length;
  }

  get draftPlans(): number {
    return this.visiblePlans.filter(plan => plan.status === 'DRAFT').length;
  }

  get completedPlans(): number {
    return this.visiblePlans.filter(plan => plan.status === 'COMPLETED').length;
  }

  get totalSessions(): number {
    return this.visiblePlans.reduce((total, plan) => total + (plan.slots?.length || 0), 0);
  }

  get confirmedSessions(): number {
    return this.visiblePlans.reduce((total, plan) => {
      const confirmed = (plan.slots || []).filter(slot => slot.status === 'CONFIRMED').length;
      return total + confirmed;
    }, 0);
  }

  get viewTitle(): string {
    if (!this.selectedTeacher) {
      return 'Vista global';
    }
    return `Vista del profesor: ${this.selectedTeacher.name}`;
  }

  onTeacherChange(rawValue: string): void {
    this.selectedTeacherId = rawValue ? Number(rawValue) : null;
  }

  createPlan(): void {
    const queryParams = this.selectedTeacherId ? { chefId: this.selectedTeacherId } : undefined;
    this.router.navigate(['/admin-panel/weekly-plans/new'], { queryParams });
  }

  openPlan(plan: WeeklyPlanResponse): void {
    this.router.navigate(['/admin-panel/weekly-plans', plan.id]);
  }

  editPlan(plan: WeeklyPlanResponse, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/admin-panel/weekly-plans', plan.id, 'edit']);
  }

  duplicatePlan(plan: WeeklyPlanResponse, event: MouseEvent): void {
    event.stopPropagation();
    const targetWeek = this.addDaysToDate(plan.weekStartDate, 7);
    this.router.navigate(['/admin-panel/weekly-plans/new'], {
      queryParams: {
        duplicateFrom: plan.id,
        weekStartDate: targetWeek,
        keepStudents: '1',
        chefId: plan.chefId
      }
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      ACTIVE: 'Activo',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Finalizado',
      CANCELLED: 'Cancelado'
    };
    return labels[status] || status;
  }

  private loadTeachers(): void {
    this.loadingTeachers = true;
    this.userService.getTeachers().subscribe({
      next: (teachers) => {
        this.teachers = teachers || [];
        this.loadingTeachers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingTeachers = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadPlans(): void {
    this.loadingPlans = true;
    this.weeklyPlanService.getAllPlans(0, 300).subscribe({
      next: (page) => {
        this.plans = (page.content || []).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
        this.loadingPlans = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingPlans = false;
        this.cdr.detectChanges();
      }
    });
  }

  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

}
