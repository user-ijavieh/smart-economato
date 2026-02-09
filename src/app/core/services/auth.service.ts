import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginRequest {
  name: string;
  password: string;
}

interface LoginResponse {
  token: string;
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

  private isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  login(name: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/api/auth/login`,
      { name, password } as LoginRequest
    ).pipe(
      tap(response => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
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

  validateToken(): Observable<TokenValidation> {
    return this.http.get<TokenValidation>(`${this.apiUrl}/api/auth/validate`);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.isLoggedIn$.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
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
