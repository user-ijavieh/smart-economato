import { Component, Input, Output, EventEmitter, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    private destroyRef = inject(DestroyRef);

    @Input() user: User | null = null;
    @Input() teachers: User[] = [];
    @Input() existingUsers: string[] = [];
    @Output() save = new EventEmitter<any>();
    @Output() close = new EventEmitter<void>();

    userForm!: FormGroup;
    roles = ['ADMIN', 'CHEF', 'USER', 'ELEVATED'];

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

    get showTeacherField(): boolean {
        const role = this.userForm?.get('role')?.value;
        return role === 'USER' || role === 'ELEVATED';
    }

    ngOnInit(): void {
        if (this.isEditMode) {
            this.userForm = new FormGroup({
                name: new FormControl(this.user?.name || '', [Validators.required, Validators.minLength(3)]),
                user: new FormControl(this.user?.user || '', [Validators.required, Validators.minLength(3)]),
                password: new FormControl(''),
                role: new FormControl(this.user?.role || 'USER', [Validators.required]),
                teacherId: new FormControl(this.user?.teacher?.id || null)
            });
        } else {
            // Create mode
            this.userForm = new FormGroup({
                name: new FormControl('', [Validators.required, Validators.minLength(3)]),
                role: new FormControl('USER', [Validators.required]),
                teacherId: new FormControl(null)
            });
        }

        this.userForm.get('role')?.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(role => {
                const teacherCtrl = this.userForm.get('teacherId');
                if (teacherCtrl && role !== 'USER' && role !== 'ELEVATED') {
                    teacherCtrl.setValue(null);
                }
            });
    }

    onSubmit(): void {
        if (this.userForm.invalid) return;

        if (this.isEditMode) {
            const formValue = this.userForm.value;
            const payload: any = {
                name: formValue.name,
                user: formValue.user,
                role: formValue.role
            };

            if (formValue.password) {
                payload.password = formValue.password;
            }

            if (this.showTeacherField) {
                payload.teacherId = formValue.teacherId === '' ? null : formValue.teacherId;
            }

            this.save.emit(payload);
        } else {
            // Generate unique credentials
            this.generatedUser = this.generateUniqueUser();
            this.generatedPassword = generatePassword();

            const formValue = this.userForm.value;
            const payload: any = {
                name: formValue.name,
                user: this.generatedUser,
                password: this.generatedPassword,
                role: formValue.role
            };

            if (this.showTeacherField) {
                payload.teacherId = formValue.teacherId === '' ? null : formValue.teacherId;
            }

            this.save.emit(payload);

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
