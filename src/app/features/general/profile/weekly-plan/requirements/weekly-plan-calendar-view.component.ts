import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WeeklyPlanResponse, WeeklyPlanSlotResponse, WeeklyPlanSlotStudentResponse } from '../../../../../shared/models/weekly-plan.model';
import { WEEK_DAYS, WEEKLY_PLAN_STATUS_LABELS, SLOT_STATUS_LABELS, STUDENT_STATUS_LABELS, getWeeklyPlanStatusClass, getSlotStatusClass } from '../weekly-plan.constants';
import { WeeklyPlanSlotActionsComponent } from '../slot-actions/weekly-plan-slot-actions.component';

@Component({
  selector: 'app-weekly-plan-calendar-view',
  standalone: true,
  imports: [CommonModule, WeeklyPlanSlotActionsComponent],
  templateUrl: './weekly-plan-calendar-view.component.html',
  styleUrl: './weekly-plan-calendar-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanCalendarViewComponent {
  @Input() plan: WeeklyPlanResponse | null = null;
  @Input() readOnly = false;

  @Output() confirmSlot = new EventEmitter<WeeklyPlanSlotResponse>();
  @Output() cancelSlot = new EventEmitter<WeeklyPlanSlotResponse>();
  @Output() confirmDay = new EventEmitter<number>();
  @Output() cancelStudent = new EventEmitter<{ slot: WeeklyPlanSlotResponse; student: WeeklyPlanSlotStudentResponse }>();

  readonly days = WEEK_DAYS;

  slotsForDay(dayOfWeek: number): WeeklyPlanSlotResponse[] {
    return [...(this.plan?.slots || [])]
      .filter(slot => slot.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime));
  }

  hasPendingSlots(dayOfWeek: number): boolean {
    return this.slotsForDay(dayOfWeek).some(slot => slot.status === 'PENDING' || slot.status === 'IN_PROGRESS');
  }

  canUseActions(): boolean {
    return !!this.plan && !this.readOnly;
  }

  planStatusClass(): string {
    return this.plan ? getWeeklyPlanStatusClass(this.plan.status) : '';
  }

  slotStatusClass(status: WeeklyPlanSlotResponse['status']): string {
    return getSlotStatusClass(status);
  }

  studentStatusLabel(status: WeeklyPlanSlotStudentResponse['status']): string {
    return STUDENT_STATUS_LABELS[status] || status;
  }

  planStatusLabel(status: WeeklyPlanResponse['status']): string {
    return WEEKLY_PLAN_STATUS_LABELS[status] || status;
  }

  slotStatusLabel(status: WeeklyPlanSlotResponse['status']): string {
    return SLOT_STATUS_LABELS[status] || status;
  }

  isLocked(slot: WeeklyPlanSlotResponse): boolean {
    return this.plan?.status !== 'DRAFT' && slot.status === 'CONFIRMED';
  }
}