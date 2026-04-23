import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LoggerService } from '../../../core/services/logger.service';
import { LanguageService } from '../../../core/services/language.service';
import { LanguageSelectorComponent } from '../../../shared/components/layout/language-selector/language-selector.component';

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
    imports: [CommonModule, ReactiveFormsModule, TranslateModule, LanguageSelectorComponent],
    templateUrl: './change-password.component.html',
    styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
    private logger = inject(LoggerService);
    private authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private messageService = inject(MessageService);
    private themeService = inject(ThemeService);
    private translate = inject(TranslateService);
    private languageService = inject(LanguageService);

    loading = false;

    form = new FormGroup({
        oldPassword: new FormControl('', [Validators.required]),
        newPassword: new FormControl('', [Validators.required, robustPasswordValidator]),
        confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });

    get newPasswordCtrl() { return this.form.get('newPassword'); }

    toggleTheme(): void {
        this.themeService.toggleTheme();
    }

    isDarkMode(): boolean {
        return this.themeService.isDark();
    }

    onSubmit() {
        if (this.form.invalid) {
            this.messageService.showError(this.translate.instant('CHANGE_PWD.VALIDATE_ERROR'));
            return;
        }

        const { oldPassword, newPassword } = this.form.value;
        const userId = this.authService.getUserId();

        if (!userId) {
            this.messageService.showError(this.translate.instant('CHANGE_PWD.SESSION_ERROR'));
            this.authService.logout();
            return;
        }

        this.loading = true;

        this.authService.changePassword(userId, oldPassword!, newPassword!).subscribe({
            next: () => {
                this.authService.clearFirstLogin();
                this.messageService.showSuccess(this.translate.instant('CHANGE_PWD.SUCCESS'));

                const returnUrl = this.getSafeReturnUrl();
                if (returnUrl) {
                    this.router.navigateByUrl(returnUrl);
                    return;
                }

                const role = this.authService.getRole();
                if (role === 'ADMIN') {
                    this.router.navigate(['/admin-panel']);
                } else {
                    this.router.navigate(['/welcome']);
                }
            },
            error: (err) => {
                this.loading = false;
                this.logger.error(err);
                this.messageService.showError(this.translate.instant('CHANGE_PWD.ERROR'));
            }
        });
    }

    private getSafeReturnUrl(): string | null {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (!returnUrl) return null;
        if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) return null;
        return returnUrl;
    }
}
