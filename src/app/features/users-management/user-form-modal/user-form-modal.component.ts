import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../shared/models/user.model';

@Component({
    selector: 'app-user-form-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './user-form-modal.component.html',
    styleUrl: './user-form-modal.component.css'
})
export class UserFormModalComponent {
    @Input() user: User | null = null;
    @Output() save = new EventEmitter<any>();
    @Output() close = new EventEmitter<void>();

    userForm!: FormGroup;
    roles = ['ADMIN', 'CHEF', 'USER'];

    get isEditMode(): boolean {
        return this.user !== null;
    }

    get title(): string {
        return this.isEditMode ? 'Editar Usuario' : 'Crear Usuario';
    }

    ngOnInit(): void {
        this.userForm = new FormGroup({
            name: new FormControl(this.user?.name || '', [Validators.required, Validators.minLength(3)]),
            email: new FormControl(this.user?.email || '', [Validators.required, Validators.email]),
            password: new FormControl('', this.isEditMode ? [] : [Validators.required, Validators.minLength(4)]),
            role: new FormControl(this.user?.role || 'USER', [Validators.required])
        });
    }

    onSubmit(): void {
        if (this.userForm.invalid) return;

        const formValue = this.userForm.value;

        if (this.isEditMode && !formValue.password) {
            const { password, ...dataWithoutPassword } = formValue;
            this.save.emit(dataWithoutPassword);
        } else {
            this.save.emit(formValue);
        }
    }

    onClose(): void {
        this.close.emit();
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.onClose();
        }
    }
}
