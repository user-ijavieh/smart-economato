import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private currentTheme: ThemeMode = this.readStoredTheme();
  readonly theme$ = new BehaviorSubject<ThemeMode>(this.currentTheme);

  initTheme(): void {
    this.currentTheme = this.readStoredTheme();
    this.applyThemeAttribute(this.currentTheme);
    this.theme$.next(this.currentTheme);
  }

  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.persistTheme(this.currentTheme);
    this.applyThemeAttribute(this.currentTheme);
    this.theme$.next(this.currentTheme);
  }

  getTheme(): ThemeMode {
    return this.currentTheme;
  }

  isDark(): boolean {
    return this.currentTheme === 'dark';
  }

  private readStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  }

  private persistTheme(theme: ThemeMode): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem('theme', theme);
  }

  private applyThemeAttribute(theme: ThemeMode): void {
    const htmlElement = this.document.documentElement;
    if (theme === 'light') {
      htmlElement.setAttribute('data-theme', 'light');
      return;
    }

    htmlElement.removeAttribute('data-theme');
  }
}
