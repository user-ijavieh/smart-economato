import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, hasPermission } from '../../shared/models/role-permissions';

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

interface UserProfileResponse {
  id: number;
  name: string;
  user: string;
  role: string;
  firstLogin: boolean;
}

interface TokenValidation {
  valid: boolean;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = environment.apiUrl;
  private TOKEN_KEY = 'auth_token';
  private ROLE_KEY = 'user_role';
  private NAME_KEY = 'user_name';
  private ID_KEY = 'user_id';
  private FIRST_LOGIN_KEY = 'first_login';

  private isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

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
        localStorage.setItem(this.NAME_KEY, profile.name);
        localStorage.setItem(this.ROLE_KEY, profile.role);
        localStorage.setItem(this.ID_KEY, profile.id.toString());
        localStorage.setItem(this.FIRST_LOGIN_KEY, String(profile.firstLogin));
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
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    localStorage.removeItem(this.NAME_KEY);
    localStorage.removeItem(this.ID_KEY);
    localStorage.removeItem(this.FIRST_LOGIN_KEY);
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

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
}
