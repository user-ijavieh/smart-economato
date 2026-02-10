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

  private isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  login(name: string, password: string): Observable<RoleResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/api/auth/login`,
      { name, password } as LoginRequest
    ).pipe(
      tap(response => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
        localStorage.setItem(this.NAME_KEY, name);
      }),
      switchMap(() =>
        this.http.get<RoleResponse>(`${this.apiUrl}/api/auth/role`).pipe(
          tap(response => {
            localStorage.setItem(this.ROLE_KEY, response.role);
            this.isLoggedIn$.next(true);
          })
        )
      )
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

  validateToken(): Observable<TokenValidation> {
    return this.http.get<TokenValidation>(`${this.apiUrl}/api/auth/validate`);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    localStorage.removeItem(this.NAME_KEY);
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
