import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductBatchResponseDTO } from '../../../../shared/models/product-batch.model';
import { MessageService } from '../../../../core/services/message.service';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-batch-expiration-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './batch-expiration-modal.component.html',
  styleUrl: './batch-expiration-modal.component.css'
})
export class BatchExpirationModalComponent {
  @Input({ required: true }) batch!: ProductBatchResponseDTO;
  @Output() save = new EventEmitter<{ expirationDate: string; reason?: string; batchCode?: string }>();
  @Output() close = new EventEmitter<void>();

  private messageService = inject(MessageService);

  expirationDate = '';
  reason = '';
  batchCode = '';

  ngOnInit() {
    if (this.batch && this.batch.expirationDate) {
      this.expirationDate = this.batch.expirationDate;
    }

    this.batchCode = this.batch?.batchCode?.trim() || '';
  }

  onSubmit() {
    if (!this.expirationDate) {
      this.messageService.showError('La fecha de caducidad es obligatoria.');
      return;
    }

    this.save.emit({
      expirationDate: this.expirationDate,
      reason: this.reason || undefined,
      batchCode: this.batchCode.trim() || undefined
    });
  }

  onClose() {
    this.close.emit();
  }
}
