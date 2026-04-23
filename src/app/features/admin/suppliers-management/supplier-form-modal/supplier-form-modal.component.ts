import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Supplier } from '../../../../shared/models/supplier.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
    selector: 'app-supplier-form-modal',
    standalone: true,
    imports: [ReactiveFormsModule, BaseModalComponent],
    templateUrl: './supplier-form-modal.component.html',
    styleUrl: './supplier-form-modal.component.css'
})
export class SupplierFormModalComponent implements OnInit {
    @Input() supplier: Supplier | null = null;
    @Output() save = new EventEmitter<any>();
    @Output() close = new EventEmitter<void>();

    supplierForm!: FormGroup;

    get isEditMode(): boolean {
        return this.supplier !== null;
    }

    get title(): string {
        return this.isEditMode ? 'Editar Proveedor' : 'Crear Proveedor';
    }

    ngOnInit(): void {
        this.supplierForm = new FormGroup({
            name: new FormControl(this.supplier?.name || '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
            email: new FormControl(this.supplier?.email || '', [Validators.email]),
            phone: new FormControl(this.supplier?.phone || '')
        });
    }

    onSubmit(): void {
        if (this.supplierForm.invalid) return;

        const formValue = this.supplierForm.value;
        this.save.emit({
            name: formValue.name.trim(),
            email: formValue.email?.trim() || undefined,
            phone: formValue.phone?.trim() || undefined
        });
    }

    onClose(): void {
        this.close.emit();
    }
}
