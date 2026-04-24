import { ApplicationConfig, provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TranslateModule, TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader, provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorHandlingInterceptor } from './core/interceptors/errorHandling.interceptor';
import { OfflineSyncInterceptor } from './core/interceptors/offline-sync.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, errorHandlingInterceptor])),
    { provide: HTTP_INTERCEPTORS, useClass: OfflineSyncInterceptor, multi: true },
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    provideTranslateService({
      defaultLanguage: 'es',
      loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' })
    })
  ]
};
