import { Component, Output, EventEmitter, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { SupplierRequest } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';

@Component({
  selector: 'app-supplier-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-create-modal.component.html',
  styleUrl: './supplier-create-modal.component.css'
})
export class SupplierCreateModalComponent {
  @Output() save = new EventEmitter<SupplierRequest>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('createForm') createForm?: NgForm;

  private messageService = inject(MessageService);

  formData = {
    name: ''
  };

  async onSubmit(): Promise<void> {
    if (this.createForm && !this.createForm.valid) {
      return;
    }

    const confirmed = await this.messageService.confirm(
      'Confirmar creación',
      `¿Estás seguro de que deseas crear el proveedor "${this.formData.name}"?`
    );

    if (!confirmed) return;

    const supplierData: SupplierRequest = {
      name: this.formData.name.trim()
    };

    this.save.emit(supplierData);
  }

  onClose(): void {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    // No cerrar al hacer click fuera
  }
}
