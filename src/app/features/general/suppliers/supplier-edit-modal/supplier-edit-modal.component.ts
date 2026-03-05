import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Supplier, SupplierRequest } from '../../../../shared/models/supplier.model';
import { MessageService } from '../../../../core/services/message.service';

@Component({
  selector: 'app-supplier-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-edit-modal.component.html',
  styleUrl: './supplier-edit-modal.component.css'
})
export class SupplierEditModalComponent implements OnChanges {
  @Input() supplier: Supplier | null = null;

  @Output() save = new EventEmitter<SupplierRequest>();
  @Output() close = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  @ViewChild('editForm') editForm?: NgForm;

  private messageService = inject(MessageService);

  formData = {
    name: ''
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supplier'] && this.supplier) {
      this.formData = {
        name: this.supplier.name
      };
    }
  }

  onSubmit(): void {
    if (this.editForm && !this.editForm.valid) {
      return;
    }

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

  async onDelete(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar "${this.supplier?.name}"? Esta acción no se puede deshacer.`
    );

    if (confirmed) {
      this.delete.emit();
    }
  }
}
