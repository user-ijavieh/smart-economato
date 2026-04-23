import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const LANGUAGE_STORAGE_KEY = 'smart-economato-language';
const AVAILABLE_LANGUAGES = ['es', 'en', 'ca'] as const;

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
    
    if (persistedLang) {
      this.translate.use(persistedLang);
      return;
    }

    // Si no hay idioma guardado, intentamos detectar el del navegador
    const browserLang = this.translate.getBrowserLang();
    const detectedLang = (browserLang && (this.supportedLanguages as readonly string[]).includes(browserLang))
      ? (browserLang as SupportedLanguage)
      : this.defaultLanguage;

    this.translate.use(detectedLang);
    
    // Guardamos la detección inicial para que sea consistente en la sesión
    localStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLang);
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
