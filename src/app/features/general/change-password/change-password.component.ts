import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';

export function robustPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    const hasMinLength = value.length >= 8;

    const errors: any = {};
    if (!hasMinLength) errors['minLength'] = true;
    if (!hasUpperCase) errors['uppercase'] = true;
    if (!hasLowerCase) errors['lowercase'] = true;
    if (!hasNumber) errors['number'] = true;
    if (!hasSymbol) errors['symbol'] = true;

    return Object.keys(errors).length > 0 ? errors : null;
}

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
    selector: 'app-change-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './change-password.component.html',
    styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
    private authService = inject(AuthService);
    private router = inject(Router);
    private messageService = inject(MessageService);

    loading = false;

    form = new FormGroup({
        oldPassword: new FormControl('', [Validators.required]),
        newPassword: new FormControl('', [Validators.required, robustPasswordValidator]),
        confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });

    get newPasswordCtrl() { return this.form.get('newPassword'); }

    onSubmit() {
        if (this.form.invalid) {
            this.messageService.showError('Por favor, revisa los errores en la contraseña.');
            return;
        }

        const { oldPassword, newPassword } = this.form.value;
        const userId = this.authService.getUserId();

        if (!userId) {
            this.messageService.showError('Error de sesión. Por favor inicia sesión de nuevo.');
            this.authService.logout();
            return;
        }

        this.loading = true;

        this.authService.changePassword(userId, oldPassword!, newPassword!).subscribe({
            next: () => {
                this.authService.clearFirstLogin();
                this.messageService.showSuccess('Contraseña actualizada correctamente');

                const role = this.authService.getRole();
                if (role === 'ADMIN') {
                    this.router.navigate(['/admin-panel']);
                } else {
                    this.router.navigate(['/welcome']);
                }
            },
            error: (err) => {
                this.loading = false;
                console.error(err);
                this.messageService.showError('Error al cambiar la contraseña. Verifica tu contraseña actual.');
            }
        });
    }
}
