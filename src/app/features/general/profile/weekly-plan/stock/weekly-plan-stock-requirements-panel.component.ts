import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseModalComponent } from '../../../../../shared/components/base-modal/base-modal.component';
import { WeeklyPlanStockRequirement } from '../../../../../shared/models/weekly-plan.model';

@Component({
  selector: 'app-weekly-plan-stock-requirements-panel',
  standalone: true,
  imports: [CommonModule, BaseModalComponent],
  templateUrl: './weekly-plan-stock-requirements-panel.component.html',
  styleUrl: './weekly-plan-stock-requirements-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanStockRequirementsPanelComponent {
  @Input() requirements: WeeklyPlanStockRequirement[] = [];
  @Input() loading = false;
  @Input() mode: 'view' | 'activation' = 'view';
  @Input() canActivate = false;
  @Input() activating = false;

  @Output() closed = new EventEmitter<void>();
  @Output() activateRequested = new EventEmitter<void>();

  get insufficientCount(): number {
    return this.requirements.filter(item => !item.sufficient).length;
  }

  requestActivation(): void {
    if (!this.canActivate || this.activating) {
      return;
    }
    this.activateRequested.emit();
  }
}