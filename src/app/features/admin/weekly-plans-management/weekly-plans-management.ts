import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { UserService } from '../../../core/services/user.service';
import { WeeklyPlanResponse } from '../../../shared/models/weekly-plan.model';
import { SearchableDropdownComponent, SearchableItem } from '../../../shared/components/searchable-dropdown/searchable-dropdown.component';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-weekly-plans-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableDropdownComponent],
  templateUrl: './weekly-plans-management.html',
  styleUrl: './weekly-plans-management.css',
})
export class WeeklyPlansManagement implements OnInit, OnDestroy {
  private weeklyPlanService = inject(WeeklyPlanService);
  private userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private destroy$ = new Subject<void>();

  teacherItems: SearchableItem[] = [];
  teacherSearchQuery = '';
  teacherPage = 0;
  teacherPageSize = 10;
  teacherHasMore = true;
  loadingMoreTeachers = false;
  selectedTeacherName = '';
  selectedTeacherId: number | null = null;
  loadingTeachers = false;

  plans: WeeklyPlanResponse[] = [];
  loadingPlans = false;

  ngOnInit(): void {
    this.loadTeacherPage('', true);
    this.loadPlans();

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        if (domains.includes('weekly_plan')) {
          this.loadPlans();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (!this.selectedTeacherId) {
      return 'Vista global';
    }
    const teacherLabel = this.selectedTeacherName || `#${this.selectedTeacherId}`;
    return `Vista del profesor: ${teacherLabel}`;
  }

  onTeacherSearch(query: string): void {
    this.loadTeacherPage(query, true);
  }

  onTeacherScrollNearBottom(): void {
    if (!this.teacherHasMore || this.loadingTeachers || this.loadingMoreTeachers) {
      return;
    }

    this.teacherPage++;
    this.loadTeacherPage(this.teacherSearchQuery, false);
  }

  onTeacherSelected(item: SearchableItem): void {
    this.selectedTeacherId = item.id;
    this.selectedTeacherName = item.name;
  }

  clearTeacherSelection(): void {
    this.selectedTeacherId = null;
    this.selectedTeacherName = '';
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

  private loadTeacherPage(query: string, reset: boolean): void {
    const normalizedQuery = query.trim();

    if (this.loadingTeachers || this.loadingMoreTeachers) {
      return;
    }

    if (reset) {
      this.teacherSearchQuery = normalizedQuery;
      this.teacherPage = 0;
      this.teacherHasMore = true;
      this.loadingTeachers = true;
    } else {
      this.loadingMoreTeachers = true;
    }

    this.userService.searchTeachers(normalizedQuery, this.teacherPage, this.teacherPageSize).subscribe({
      next: (page) => {
        const mapped = (page.content || []).map(teacher => ({ id: teacher.id, name: teacher.name }));
        this.teacherItems = reset ? mapped : [...this.teacherItems, ...mapped];
        this.teacherHasMore = !page.last;
        this.loadingTeachers = false;
        this.loadingMoreTeachers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingTeachers = false;
        this.loadingMoreTeachers = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadPlans(): void {
    this.loadingPlans = true;
    this.weeklyPlanService.getAllPlans(0, 50).subscribe({
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
    return this.toIsoDate(date);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }


}
