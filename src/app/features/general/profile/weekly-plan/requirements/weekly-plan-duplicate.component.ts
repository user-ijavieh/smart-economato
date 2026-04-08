import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../../../../../shared/components/base-modal/base-modal.component';
import { WeeklyPlanResponse, WeeklyPlanRequest } from '../../../../../shared/models/weekly-plan.model';
import { normalizeWeekStartDate } from '../weekly-plan.constants';

@Component({
  selector: 'app-weekly-plan-duplicate',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './weekly-plan-duplicate.component.html',
  styleUrl: './weekly-plan-duplicate.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanDuplicateComponent implements OnChanges {
  @Input() open = false;
  @Input() plan: WeeklyPlanResponse | null = null;
  @Input() saving = false;

  @Output() closed = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<WeeklyPlanRequest>();

  private cdr = inject(ChangeDetectorRef);

  targetWeekDate = '';
  includeStudents = true;
  validationMessage = '';

  ngOnChanges(): void {
    if (this.open && this.plan) {
      this.targetWeekDate = '';
      this.includeStudents = true;
      this.validationMessage = '';
      this.cdr.markForCheck();
    }
  }

  getSlotsToCopy(): number {
    return this.plan?.slots.filter(slot => slot.status !== 'CANCELLED').length || 0;
  }

  onTargetWeekChange(value: string): void {
    this.targetWeekDate = normalizeWeekStartDate(value);
  }

  doDuplicate(): void {
    this.validationMessage = '';

    if (!this.targetWeekDate) {
      this.validationMessage = 'Selecciona una semana destino.';
      return;
    }

    if (this.targetWeekDate === this.plan?.weekStartDate) {
      this.validationMessage = 'Selecciona una semana diferente a la actual.';
      return;
    }

    if (!this.plan) {
      this.validationMessage = 'Plan inválido.';
      return;
    }

    // Build request with non-cancelled slots only
    const request: WeeklyPlanRequest = {
      chefId: this.plan.chefId,
      weekStartDate: this.targetWeekDate,
      slots: this.plan.slots
        .filter(slot => slot.status !== 'CANCELLED')
        .map(slot => ({
          recipeId: slot.recipeId,
          quantity: slot.quantity,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sortOrder: slot.sortOrder,
          studentIds: this.includeStudents ? slot.students.map(s => s.studentId) : []
        }))
    };

    this.duplicate.emit(request);
  }
}
