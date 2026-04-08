import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WeeklyPlanResponse } from '../../../../../shared/models/weekly-plan.model';
import { Role } from '../../../../../shared/models/role-permissions';
import { WEEKLY_PLAN_STATUS_LABELS, getWeeklyPlanStatusClass } from '../weekly-plan.constants';

@Component({
  selector: 'app-weekly-plan-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weekly-plan-history.component.html',
  styleUrl: './weekly-plan-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanHistoryComponent {
  @Input() plans: WeeklyPlanResponse[] = [];
  @Input() loading = false;
  @Input() page = 0;
  @Input() totalPages = 0;
  @Input() totalElements = 0;
  @Input() statusFilter = '';
  @Input() showChefColumn = false;
  @Input() role: Role | null = null;

  @Output() pageChange = new EventEmitter<number>();
  @Output() statusFilterChange = new EventEmitter<string>();
  @Output() selectPlan = new EventEmitter<WeeklyPlanResponse>();
  @Output() editPlan = new EventEmitter<WeeklyPlanResponse>();
  @Output() duplicatePlan = new EventEmitter<WeeklyPlanResponse>();

  readonly statusLabels = WEEKLY_PLAN_STATUS_LABELS;

  statusClass(status: string): string {
    return getWeeklyPlanStatusClass(status);
  }

  canEdit(plan: WeeklyPlanResponse): boolean {
    const canByRole = this.role === 'ADMIN' || this.role === 'CHEF' || this.role === 'ELEVATED';
    return canByRole && (plan.status === 'DRAFT' || plan.status === 'ACTIVE' || plan.status === 'IN_PROGRESS');
  }

  canDuplicate(plan: WeeklyPlanResponse): boolean {
    const canByRole = this.role === 'ADMIN' || this.role === 'CHEF';
    return canByRole && plan.status !== 'CANCELLED';
  }
}
