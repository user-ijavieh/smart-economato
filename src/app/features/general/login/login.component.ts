import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { LanguageSelectorComponent } from '../../../shared/components/layout/language-selector/language-selector.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, LanguageSelectorComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);

  loginForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required])
  });

  loading = false;
  errorMessage = '';

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    const { name, password } = this.loginForm.value;

    this.authService.login(name!, password!).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('LOGIN.SUCCESS') || 'Sesión iniciada correctamente');
        const returnUrl = this.getSafeReturnUrl();

        if (this.authService.isFirstLogin()) {
          this.router.navigate(['/change-password'], {
            queryParams: returnUrl ? { returnUrl } : undefined
          });
        } else {
          if (returnUrl) {
            this.router.navigateByUrl(returnUrl);
            return;
          }

          const role = this.authService.getRole();
          this.router.navigate([role === 'ADMIN' ? '/admin-panel/dashboard' : '/welcome']);
        }
      },
      error: (err) => {
        if (err.message === 'user_hidden') {
          this.errorMessage = this.translate.instant('LOGIN.ERROR_USER_HIDDEN') || 'El usuario está bloqueado o inactivo y no puede acceder al sistema.';
          this.messageService.showError(this.errorMessage);
        } else if (err instanceof HttpErrorResponse && err.status === 401) {
          this.errorMessage = this.translate.instant('LOGIN.ERROR_INVALID') || 'Credenciales incorrectas';
          this.messageService.showError(this.errorMessage);
        } else {
          this.errorMessage = this.translate.instant('LOGIN.ERROR_GENERIC') || 'Error al iniciar sesión';
          this.messageService.showError(this.errorMessage);
        }
        this.loading = false;
        this.cdr.markForCheck();
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
