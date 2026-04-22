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
  readonly defaultLanguage: SupportedLanguage = 'en';

  constructor() {
    this.translate.addLangs(this.supportedLanguages as unknown as string[]);
    this.translate.setDefaultLang(this.defaultLanguage);
    this.initLanguage();
  }

  initLanguage(): void {
    const persistedLang = this.getStoredLanguage();
    // Si hay un idioma guardado, lo usamos, pero si es la primera vez o queremos forzar el cambio:
    const selectedLanguage = persistedLang || this.defaultLanguage;
    this.translate.use(selectedLanguage);
    
    // Si queremos asegurar el cambio ahora mismo, podemos forzarlo:
    if (!persistedLang) {
      this.setLanguage('en');
    }
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
