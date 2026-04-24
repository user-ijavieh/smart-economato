import { Component, inject, HostListener, signal, ElementRef } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule, UpperCasePipe],
  template: `
    <div class="language-selector" (click)="toggleMenu($event)">
      <button class="selector-btn" [class.active]="isOpen()" [attr.aria-label]="'COMMON.SWITCH_LANGUAGE' | translate">
        <span class="lang-content">
          <span class="lang-text">{{ getActiveLanguage() | uppercase }}</span>
          @if (getActiveLanguage() === 'es') {
            <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
              <rect width="24" height="16" rx="3" fill="#AA151B"></rect>
              <rect y="4" width="24" height="8" fill="#F1BF00"></rect>
            </svg>
          }
          @if (getActiveLanguage() === 'en') {
            <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
              <rect width="24" height="16" rx="3" fill="#FFFFFF"></rect>
              <rect width="24" height="16" fill="none" stroke="#B22234" stroke-width="2"></rect>
              <path d="M0 2h24M0 6h24M0 10h24M0 14h24" stroke="#B22234" stroke-width="1.4"></path>
              <rect width="10" height="8" rx="1.5" fill="#3C3B6E"></rect>
            </svg>
          }
          @if (getActiveLanguage() === 'ca') {
            <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
              <rect width="24" height="16" rx="3" fill="#FCD116"></rect>
              <rect y="2" width="24" height="2" fill="#A80000"></rect>
              <rect y="6" width="24" height="2" fill="#A80000"></rect>
              <rect y="10" width="24" height="2" fill="#A80000"></rect>
              <rect y="14" width="24" height="2" fill="#A80000"></rect>
            </svg>
          }
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" [class.rotate]="isOpen()">
          <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="language-menu">
          @for (lang of languages; track lang.code) {
            <button 
              class="menu-item" 
              [class.selected]="getActiveLanguage() === lang.code"
              (click)="selectLanguage(lang.code, $event)"
            >
              <span class="menu-item-content">
                <span class="lang-label">{{ lang.label }}</span>
                @if (lang.code === 'es') {
                  <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
                    <rect width="24" height="16" rx="3" fill="#AA151B"></rect>
                    <rect y="4" width="24" height="8" fill="#F1BF00"></rect>
                  </svg>
                }
                @if (lang.code === 'en') {
                  <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
                    <rect width="24" height="16" rx="3" fill="#FFFFFF"></rect>
                    <rect width="24" height="16" fill="none" stroke="#B22234" stroke-width="2"></rect>
                    <path d="M0 2h24M0 6h24M0 10h24M0 14h24" stroke="#B22234" stroke-width="1.4"></path>
                    <rect width="10" height="8" rx="1.5" fill="#3C3B6E"></rect>
                  </svg>
                }
                @if (lang.code === 'ca') {
                  <svg class="flag-svg" viewBox="0 0 24 16" aria-hidden="true">
                    <rect width="24" height="16" rx="3" fill="#FCD116"></rect>
                    <rect y="2" width="24" height="2" fill="#A80000"></rect>
                    <rect y="6" width="24" height="2" fill="#A80000"></rect>
                    <rect y="10" width="24" height="2" fill="#A80000"></rect>
                    <rect y="14" width="24" height="2" fill="#A80000"></rect>
                  </svg>
                }
              </span>
              @if (getActiveLanguage() === lang.code) {
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                  <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
                </svg>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .language-selector {
      position: relative;
    }

    .selector-btn {
      background: var(--theme-surface-glass);
      border: 1px solid var(--theme-border-light);
      color: var(--theme-text-primary);
      border-radius: 8px;
      padding: 0 8px 0 12px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 76px;
      height: 36px;
      outline: none;
    }

    .lang-content {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .selector-btn:hover, .selector-btn.active {
      background: var(--theme-surface-glass-hover);
      border-color: var(--brand-primary);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .selector-btn svg {
      transition: transform 0.2s ease;
      opacity: 0.7;
    }

    .selector-btn svg.rotate {
      transform: rotate(180deg);
    }

    .lang-text {
      letter-spacing: 0.5px;
    }

    .flag-svg {
      width: 18px;
      height: 12px;
      flex: 0 0 auto;
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
    }

    .language-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 130px;
      background: var(--theme-section-header-bg-strong);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--theme-border-light);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
      z-index: 12000;
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: menuIn 0.2s cubic-bezier(0, 0, 0.2, 1);
    }

    @keyframes menuIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: var(--theme-text-primary);
      font-size: 0.85rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    .menu-item-content {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .menu-item:hover {
      background: var(--theme-surface-glass-hover);
      padding-left: 14px;
    }

    .menu-item.selected {
      color: var(--brand-primary);
      background: color-mix(in srgb, var(--brand-primary) 10%, transparent);
    }

    .menu-item svg {
      color: var(--brand-primary);
    }

    /* Light Mode Overrides */
    :host-context([data-theme="light"]) .language-menu {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(0, 0, 0, 0.08);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    :host-context([data-theme="light"]) .menu-item {
      color: #1E293B;
    }

    :host-context([data-theme="light"]) .menu-item:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  `]
})
export class LanguageSelectorComponent {
  private languageService = inject(LanguageService);
  private elementRef = inject(ElementRef);

  isOpen = signal(false);

  languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'ca', label: 'Català' }
  ];

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  selectLanguage(code: string, event: MouseEvent): void {
    event.stopPropagation();
    this.languageService.setLanguage(code);
    this.isOpen.set(false);
  }

  getActiveLanguage(): string {
    return this.languageService.getActiveLanguage();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
