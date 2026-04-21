import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const LANGUAGE_STORAGE_KEY = 'smart-economato-language';
const AVAILABLE_LANGUAGES = ['es', 'en'] as const;

type SupportedLanguage = (typeof AVAILABLE_LANGUAGES)[number];

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly supportedLanguages = AVAILABLE_LANGUAGES;
  readonly defaultLanguage: SupportedLanguage = 'es';

  constructor() {
    this.translate.addLangs(this.supportedLanguages as unknown as string[]);
    this.translate.setDefaultLang(this.defaultLanguage);
    this.initLanguage();
  }

  initLanguage(): void {
    const persistedLang = this.getStoredLanguage();
    const browserLang = this.translate.getBrowserLang()?.split('-')[0] as SupportedLanguage | undefined;
    const selectedLanguage = persistedLang ?? (this.supportedLanguages.includes(browserLang as SupportedLanguage) ? browserLang : this.defaultLanguage);
    this.translate.use(selectedLanguage ?? this.defaultLanguage);
  }

  setLanguage(language: string): void {
    const normalized = language?.split('-')[0] as SupportedLanguage;
    const effectiveLanguage = this.supportedLanguages.includes(normalized) ? normalized : this.defaultLanguage;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, effectiveLanguage);
    this.translate.use(effectiveLanguage);
  }

  getActiveLanguage(): string {
    return this.translate.currentLang || this.translate.defaultLang || this.defaultLanguage;
  }

  private getStoredLanguage(): SupportedLanguage | null {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return this.supportedLanguages.includes(stored as SupportedLanguage) ? (stored as SupportedLanguage) : null;
  }
}
