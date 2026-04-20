import { Component, Input, Output, EventEmitter, OnInit, DestroyRef, inject } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { User } from '../../../../shared/models/user.model';
import { UserService } from '../../../../core/services/user.service';
import { generateUsername, generatePassword } from '../../../../core/utils/credentials-generator';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { SearchableDropdownComponent, SearchableItem } from '../../../../shared/components/searchable-dropdown/searchable-dropdown.component';

@Component({
    selector: 'app-user-form-modal',
    standalone: true,
    imports: [ReactiveFormsModule, BaseModalComponent, SearchableDropdownComponent],
    templateUrl: './user-form-modal.component.html',
    styleUrl: './user-form-modal.component.css'
})
/** Component for user creation and editing with searchable teacher selection */
export class UserFormModalComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private userService = inject(UserService);

    @Input() user: User | null = null;
    @Input() teachers: User[] = [];
    @Output() save = new EventEmitter<any>();
    @Output() close = new EventEmitter<void>();

    userForm!: FormGroup;
    roleOptions = [
        { value: 'USER', label: 'Alumno' },
        { value: 'CHEF', label: 'Profesor' },
        { value: 'ADMIN', label: 'Administrador' }
    ];

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
        if (this.isEditMode) {
            return true;
        }

        const role = String(this.userForm?.get('role')?.value ?? '').toUpperCase();
        return role === 'USER' || role === 'ELEVATED';
    }

    get availableRoleOptions(): Array<{ value: string; label: string }> {
        if (this.isEditMode && String(this.userForm?.get('role')?.value ?? '').toUpperCase() === 'ELEVATED') {
            return [...this.roleOptions, { value: 'ELEVATED', label: 'Alumno' }];
        }
        return this.roleOptions;
    }

    get teacherSearchItems(): SearchableItem[] {
        return this.teachers.map(t => ({
            id: t.id,
            name: `${t.name} (${t.user})`
        }));
    }

    get selectedTeacherName(): string {
        const teacherId = this.userForm?.get('teacherId')?.value;
        const teacher = this.teachers.find(t => t.id === teacherId);
        return teacher ? `${teacher.name} (${teacher.user})` : '';
    }

    onTeacherSelected(item: SearchableItem): void {
        this.userForm.get('teacherId')?.setValue(item.id);
        this.userForm.get('teacherId')?.markAsDirty();
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
                const normalizedRole = String(role ?? '').toUpperCase();

                if (teacherCtrl && !this.isEditMode && normalizedRole !== 'USER' && normalizedRole !== 'ELEVATED') {
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
            this.generateUniqueUser().subscribe(username => {
                this.generatedUser = username;
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
            });
        }
    }

    private generateUniqueUser(): Observable<string> {
        const username = generateUsername();
        return this.userService.checkUsernameExists(username).pipe(
            switchMap(exists => exists ? this.generateUniqueUser() : of(username))
        );
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

}
