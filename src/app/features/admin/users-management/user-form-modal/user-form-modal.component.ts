import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../../shared/models/user.model';
import { generateUsername, generatePassword } from '../../../../core/utils/credentials-generator';

@Component({
    selector: 'app-user-form-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './user-form-modal.component.html',
    styleUrl: './user-form-modal.component.css'
})
export class UserFormModalComponent implements OnInit {
    @Input() user: User | null = null;
    @Input() existingUsers: string[] = [];
    @Output() save = new EventEmitter<any>();
    @Output() close = new EventEmitter<void>();

    userForm!: FormGroup;
    roles = ['ADMIN', 'CHEF', 'USER'];

    // Auto-generated credentials (create mode only)
    generatedUser = '';
    generatedPassword = '';
    showCredentials = false;
    credentialsCopied = false;

    get isEditMode(): boolean {
        return this.user !== null;
    }

    get title(): string {
        return this.isEditMode ? 'Editar Usuario' : 'Crear Usuario';
    }

    ngOnInit(): void {
        if (this.isEditMode) {
            this.userForm = new FormGroup({
                name: new FormControl(this.user?.name || '', [Validators.required, Validators.minLength(3)]),
                user: new FormControl(this.user?.user || '', [Validators.required, Validators.minLength(3)]),
                password: new FormControl(''),
                role: new FormControl(this.user?.role || 'USER', [Validators.required])
            });
        } else {
            // Create mode: only name and role
            this.userForm = new FormGroup({
                name: new FormControl('', [Validators.required, Validators.minLength(3)]),
                role: new FormControl('USER', [Validators.required])
            });
        }
    }

    onSubmit(): void {
        if (this.userForm.invalid) return;

        if (this.isEditMode) {
            const formValue = this.userForm.value;
            if (!formValue.password) {
                const { password, ...dataWithoutPassword } = formValue;
                this.save.emit(dataWithoutPassword);
            } else {
                this.save.emit(formValue);
            }
        } else {
            // Generate unique credentials
            this.generatedUser = this.generateUniqueUser();
            this.generatedPassword = generatePassword();

            const formValue = this.userForm.value;
            this.save.emit({
                name: formValue.name,
                user: this.generatedUser,
                password: this.generatedPassword,
                role: formValue.role
            });

            this.showCredentials = true;
        }
    }

    private generateUniqueUser(): string {
        let username: string;
        let attempts = 0;

        do {
            username = generateUsername();
            attempts++;
        } while (this.existingUsers.includes(username) && attempts < 100);

        return username;
    }

    copyCredentials(): void {
        const text = `Usuario: ${this.generatedUser}\nContraseña: ${this.generatedPassword}`;
        navigator.clipboard.writeText(text).then(() => {
            this.credentialsCopied = true;
            setTimeout(() => this.credentialsCopied = false, 2000);
        });
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
