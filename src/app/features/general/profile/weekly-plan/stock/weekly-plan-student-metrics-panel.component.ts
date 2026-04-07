import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../../../../../shared/components/base-modal/base-modal.component';
import { StudentMetrics } from '../../../../../shared/models/weekly-plan.model';

@Component({
  selector: 'app-weekly-plan-student-metrics-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './weekly-plan-student-metrics-panel.component.html',
  styleUrl: './weekly-plan-student-metrics-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanStudentMetricsPanelComponent {
  @Input() metrics: StudentMetrics[] = [];
  @Input() loading = false;
  @Input() page = 0;
  @Input() totalPages = 0;
  @Input() totalElements = 0;
  @Input() selectedChefId: number | null = null;
  @Input() showChefFilter = false;
  @Input() chefs: Array<{ id: number; name: string }> = [];

  @Output() closed = new EventEmitter<void>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() chefChange = new EventEmitter<number | null>();

  trackByStudent(_: number, item: StudentMetrics): number {
    return item.studentId;
  }
}