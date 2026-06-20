import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, RegisterDto, LoginDto } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'studyroom_token';
  private readonly USER_KEY = 'studyroom_user';

  currentUser = signal<User | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUser();
  }

  register(dto: RegisterDto): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, dto).pipe(
      tap(user => this.setSession(user))
    );
  }

  login(dto: LoginDto): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/login`, dto).pipe(
      tap(user => this.setSession(user))
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setSession(user: User): void {
    localStorage.setItem(this.TOKEN_KEY, user.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private loadUser(): void {
    const stored = localStorage.getItem(this.USER_KEY);
    if (stored && this.isAuthenticated()) {
      this.currentUser.set(JSON.parse(stored));
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }
}
