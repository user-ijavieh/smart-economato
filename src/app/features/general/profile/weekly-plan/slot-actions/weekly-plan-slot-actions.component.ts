import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WeeklyPlanResponse, WeeklyPlanSlotResponse } from '../../../../../shared/models/weekly-plan.model';
import { getSlotStatusClass } from '../weekly-plan.constants';

@Component({
  selector: 'app-weekly-plan-slot-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-plan-slot-actions.component.html',
  styleUrl: './weekly-plan-slot-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanSlotActionsComponent {
  @Input() planStatus: WeeklyPlanResponse['status'] | null = null;
  @Input() slotStatus: WeeklyPlanSlotResponse['status'] | null = null;
  @Input() readOnly = false;
  @Input() showDayAction = false;

  @Output() confirmSlot = new EventEmitter<void>();
  @Output() cancelSlot = new EventEmitter<void>();
  @Output() confirmDay = new EventEmitter<void>();

  canActOnSlot(): boolean {
    return !this.readOnly
      && (this.planStatus === 'ACTIVE' || this.planStatus === 'IN_PROGRESS')
      && (this.slotStatus === 'PENDING' || this.slotStatus === 'IN_PROGRESS');
  }

  canConfirmDay(): boolean {
    return !this.readOnly && (this.planStatus === 'ACTIVE' || this.planStatus === 'IN_PROGRESS');
  }

  slotStatusClass(): string {
    return this.slotStatus ? getSlotStatusClass(this.slotStatus) : '';
  }
}