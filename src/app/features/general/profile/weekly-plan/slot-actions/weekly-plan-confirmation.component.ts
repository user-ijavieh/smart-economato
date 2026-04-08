import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { BaseModalComponent } from '../../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-weekly-plan-confirmation',
  standalone: true,
  imports: [CommonModule, BaseModalComponent],
  templateUrl: './weekly-plan-confirmation.component.html',
  styleUrl: './weekly-plan-confirmation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanConfirmationComponent {
  @Input() open = false;
  @Input() title = 'Confirmación';
  @Input() message = '¿Estás seguro?';
  @Input() confirmText = 'Confirmar';
  @Input() cancelText = 'Cancelar';
  @Input() isDangerous = false;
  @Input() isLoading = false;
  @Input() details: string[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  doConfirm(): void {
    this.confirmed.emit();
  }
}
