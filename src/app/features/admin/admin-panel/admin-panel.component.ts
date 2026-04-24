import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-admin-panel',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslateModule],
    templateUrl: './admin-panel.component.html',
    styleUrl: './admin-panel.component.css'
})
export class AdminPanelComponent {
    private authService = inject(AuthService);
    private translate = inject(TranslateService);

    get userName(): string {
        return this.authService.getName() || this.translate.instant('ADMIN_PANEL.FALLBACK_NAME');
    }
}
