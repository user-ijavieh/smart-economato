import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, switchMap, of, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, hasPermission } from '../../shared/models/role-permissions';
import { WebSocketService } from './websocket.service';
import { NotificationService } from './notification.service';
import { PresenceTrackingService } from './presence-tracking.service';
import { SyncCacheInvalidationService } from './sync-cache-invalidation.service';
import { HttpQueryCacheService } from './http-query-cache.service';
import { OrderReviewLockStateService } from './order-review-lock-state.service';
import { OrderReviewCollaborationStateService } from './order-review-collaboration-state.service';

interface LoginRequest {
  name: string;
  password: string;
}

interface LoginResponse {
  token: string;
}

interface RoleResponse {
  role: string;
}

type SessionRole = 'ADMIN' | 'CHEF' | 'ELEVATED' | 'USER';

interface UserProfileResponse {
  id: number;
  name: string;
  user: string;
  role: string;
  firstLogin: boolean;
  hidden?: boolean;
}

interface TokenValidation {
  valid: boolean;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private webSocketService = inject(WebSocketService);
  private notificationService = inject(NotificationService);
  private presenceTrackingService = inject(PresenceTrackingService);
  private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private httpQueryCacheService = inject(HttpQueryCacheService);
  private orderReviewLockStateService = inject(OrderReviewLockStateService);
  private orderReviewCollaborationStateService = inject(OrderReviewCollaborationStateService);
  private apiUrl = environment.apiUrl;
  private TOKEN_KEY = 'auth_token';
  private ROLE_KEY = 'user_role';
  private NAME_KEY = 'user_name';
  private USERNAME_KEY = 'user_username';
  private ID_KEY = 'user_id';
  private FIRST_LOGIN_KEY = 'first_login';

  private isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  private role$Subject = new BehaviorSubject<string | null>(this.getRole());

  constructor() {
    this.syncCacheInvalidationService.initialize();
    this.orderReviewLockStateService.initialize();
    this.orderReviewCollaborationStateService.initialize();
    this.bindRoleEscalationEvents();

    const token = this.getToken();
    const role = this.getRole();
    if (token) {
      this.webSocketService.connect(token, role);
      this.notificationService.connect(token, role);
      this.presenceTrackingService.initialize();
      this.syncSessionProfile().subscribe();
    }
  }

  syncSessionProfile(): Observable<UserProfileResponse | null> {
    if (!this.getToken()) {
      return of(null);
    }

    return this.http.get<UserProfileResponse>(`${this.apiUrl}/api/users/me`).pipe(
      tap(profile => {
        localStorage.setItem(this.NAME_KEY, profile.name);
        localStorage.setItem(this.USERNAME_KEY, profile.user);
        this.setRole(profile.role);
        localStorage.setItem(this.ID_KEY, profile.id.toString());
        localStorage.setItem(this.FIRST_LOGIN_KEY, String(profile.firstLogin));
      })
    );
  }

  login(name: string, password: string): Observable<UserProfileResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/api/auth/login`,
      { name, password } as LoginRequest
    ).pipe(
      tap(response => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
      }),
      switchMap(() => this.http.get<UserProfileResponse>(`${this.apiUrl}/api/users/me`)),
      tap(profile => {
        if (profile.hidden) {
          this.webSocketService.disconnect();
          localStorage.removeItem(this.TOKEN_KEY);
          throw new Error('user_hidden');
        }
        this.syncCacheInvalidationService.initialize();
        this.orderReviewLockStateService.initialize();
        this.orderReviewCollaborationStateService.initialize();
        localStorage.setItem(this.NAME_KEY, profile.name);
        localStorage.setItem(this.USERNAME_KEY, profile.user);
        this.setRole(profile.role);
        localStorage.setItem(this.ID_KEY, profile.id.toString());
        localStorage.setItem(this.FIRST_LOGIN_KEY, String(profile.firstLogin));
        this.webSocketService.connect(this.getToken() || '', profile.role);
        this.notificationService.connect(this.getToken() || '', profile.role);
        this.presenceTrackingService.initialize();
        this.isLoggedIn$.next(true);
      })
    );
  }

  register(userData: {
    name: string;
    password: string;
    email: string;
    role: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/register`, userData);
  }

  changePassword(userId: number, oldPassword: string, newPassword: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/users/${userId}/password`, {
      oldPassword,
      newPassword
    });
  }

  validateToken(): Observable<TokenValidation> {
    return this.http.get<TokenValidation>(`${this.apiUrl}/api/auth/validate`);
  }

  logout(): void {
    this.presenceTrackingService.destroy();
    this.webSocketService.disconnect();
    this.notificationService.disconnect();
    this.syncCacheInvalidationService.destroy();
    this.orderReviewLockStateService.destroy();
    this.orderReviewCollaborationStateService.destroy();
    this.httpQueryCacheService.clearAll();
    localStorage.removeItem(this.TOKEN_KEY);
    this.setRole(null);
    localStorage.removeItem(this.NAME_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.ID_KEY);
    localStorage.removeItem(this.FIRST_LOGIN_KEY);
    localStorage.removeItem('ai_last_chat_id');
    this.isLoggedIn$.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): string | null {
    return localStorage.getItem(this.ROLE_KEY);
  }

  getName(): string | null {
    return localStorage.getItem(this.NAME_KEY);
  }

  getUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY);
  }

  getUserId(): number | null {
    const id = localStorage.getItem(this.ID_KEY);
    return id ? parseInt(id, 10) : null;
  }

  isFirstLogin(): boolean {
    return localStorage.getItem(this.FIRST_LOGIN_KEY) === 'true';
  }

  clearFirstLogin(): void {
    localStorage.setItem(this.FIRST_LOGIN_KEY, 'false');
  }

  hasPermission(method: string, url: string): boolean {
    const role = this.getRole() as Role;
    if (!role) return false;
    return hasPermission(role, method, url);
  }

  canAccess(endpoint: string, method: string = 'GET'): boolean {
    return this.hasPermission(method, `/api${endpoint}`);
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  get authStatus$(): Observable<boolean> {
    return this.isLoggedIn$.asObservable();
  }

  get roleChanges$(): Observable<string | null> {
    return this.role$Subject.asObservable();
  }

  private bindRoleEscalationEvents(): void {
    this.notificationService.incoming$
      .pipe(filter(notification => notification.code === 'ROLE_ESCALATION_CHANGED' && !!notification.newRole))
      .subscribe(notification => {
        const normalizedRole = this.normalizeSessionRole(notification.newRole ?? null);
        if (!normalizedRole) {
          return;
        }

        const previousRole = this.getRole();
        if (previousRole === normalizedRole) {
          return;
        }

        this.setRole(normalizedRole);

        const token = this.getToken();
        if (token) {
          this.webSocketService.connect(token, normalizedRole);
          this.notificationService.connect(token, normalizedRole);
        }

        if (previousRole === 'ADMIN' && normalizedRole !== 'ADMIN' && this.router.url.startsWith('/admin-panel')) {
          void this.router.navigate(['/welcome']);
        }
      });
  }

  private setRole(role: string | null): void {
    if (role) {
      localStorage.setItem(this.ROLE_KEY, role);
    } else {
      localStorage.removeItem(this.ROLE_KEY);
    }
    this.role$Subject.next(role);
  }

  private normalizeSessionRole(role: string | null): SessionRole | null {
    switch (role) {
      case 'ADMIN':
      case 'CHEF':
      case 'ELEVATED':
      case 'USER':
        return role;
      default:
        return null;
    }
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
}
