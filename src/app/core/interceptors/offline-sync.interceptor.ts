import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, take, filter, switchMap } from 'rxjs/operators';
import { OfflineSyncService } from '../services/offline-sync.service';
import { PwaNotificationService } from '../services/pwa-notification.service';

@Injectable()
export class OfflineSyncInterceptor implements HttpInterceptor {
  private offlineSync = inject(OfflineSyncService);
  private notifications = inject(PwaNotificationService);
  private isRefreshing = new BehaviorSubject<boolean>(false);
  private refreshTokenSubject = new BehaviorSubject<any>(null);

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Skip non-API requests and GET requests (those are cached)
    if (request.method === 'GET') {
      return next.handle(request).pipe(
        catchError((error) => this.handleError(error, request))
      );
    }

    // For POST, PUT, DELETE requests
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // If offline or network error, queue the request for sync
        if (
          error.status === 0 ||
          error.status === 503 ||
          !navigator.onLine
        ) {
          return this.handleOfflineError(request);
        }

        return this.handleError(error, request);
      })
    );
  }

  /**
   * Handle offline errors by queuing the request
   */
  private handleOfflineError(
    request: HttpRequest<any>
  ): Observable<HttpEvent<any>> {
    return new Observable((observer) => {
      this.offlineSync
        .queueRequest(request.method, request.url, request.body)
        .then(() => {
          // Return a success response so the UI doesn't show an error
          observer.next({
            body: { queued: true, message: 'Solicitud encolada. Se enviará cuando haya conexión.' },
          } as any);
          observer.complete();

          // Show user a toast/notification
          this.notifications.showInfo(
            'Modo offline',
            'Tu solicitud se enviará cuando tengas conexión'
          );
        })
        .catch((err) => {
          observer.error(err);
          this.notifications.showError(
            'Error de conexión',
            'No se pudo procesar tu solicitud. Intenta más tarde.'
          );
        });
    });
  }

  /**
   * Handle generic HTTP errors
   */
  private handleError(
    error: HttpErrorResponse,
    request: HttpRequest<any>
  ): Observable<HttpEvent<any>> {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error ${error.status}: ${error.error?.message || error.statusText}`;
    }

    console.error('[SyncInterceptor]', errorMessage);

    // Show notification for critical errors
    if (error.status >= 500) {
      this.notifications.showError(
        'Error del servidor',
        'El servidor no está disponible. Intenta más tarde.'
      );
    } else if (error.status === 401 || error.status === 403) {
      this.notifications.showWarning(
        'Acceso denegado',
        'Tu sesión ha expirado o no tienes permisos'
      );
    } else if (error.status === 400) {
      this.notifications.showWarning(
        'Solicitud inválida',
        error.error?.message || 'Verifica los datos e intenta de nuevo'
      );
    }

    return throwError(() => error);
  }
}
