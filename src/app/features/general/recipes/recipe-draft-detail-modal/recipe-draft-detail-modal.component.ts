import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipeDraft } from '../../../../shared/models/recipe-draft.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-recipe-draft-detail-modal',
  standalone: true,
  imports: [CommonModule, BaseModalComponent],
  templateUrl: './recipe-draft-detail-modal.component.html',
  styleUrl: './recipe-draft-detail-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeDraftDetailModalComponent {
  @Input({ required: true }) draft!: RecipeDraft;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() resubmit = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }

  editDraft(): void {
    this.edit.emit();
  }

  deleteDraft(): void {
    this.delete.emit();
  }

  resubmitDraft(): void {
    this.resubmit.emit();
  }

  canEditDraft(): boolean {
    return this.draft.status === 'PENDING' || this.draft.status === 'REJECTED';
  }

  canDeleteDraft(): boolean {
    return this.draft.status === 'PENDING' || this.draft.status === 'REJECTED';
  }

  canResubmitDraft(): boolean {
    return this.draft.status === 'REJECTED';
  }

  getDraftStatusLabel(status: RecipeDraft['status']): string {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'APPROVED':
        return 'Aprobado';
      case 'REJECTED':
        return 'Rechazado';
      default:
        return status;
    }
  }

  getDraftStatusClass(status: RecipeDraft['status']): string {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'badge-default';
    }
  }
}
