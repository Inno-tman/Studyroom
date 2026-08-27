import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, RegisterDto, LoginDto, UpdateProfileDto } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'studyroom_token';
  private readonly REFRESH_KEY = 'studyroom_refresh_token';
  private readonly USER_KEY = 'studyroom_user';

  currentUser = signal<User | null>(null);
  saving = signal(false);
  error = signal('');
  success = signal('');

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

  googleLogin(idToken: string): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/google`, { idToken }).pipe(
      tap(user => this.setSession(user))
    );
  }

  updateProfile(dto: UpdateProfileDto): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/auth/profile`, dto).pipe(
      tap(user => this.setSession(user))
    );
  }

  clearMessages(): void {
    this.error.set('');
    this.success.set('');
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/auth/password`, { currentPassword, newPassword });
  }

  getAccountStatus(): Observable<{ isOnline: boolean; lastSeenAt: string }> {
    return this.http.get<{ isOnline: boolean; lastSeenAt: string }>(`${environment.apiUrl}/users/status`);
  }

  async saveProfile(dto: UpdateProfileDto): Promise<void> {
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    try {
      await this.updateProfile(dto).toPromise();
      this.success.set('Profile updated successfully.');
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Failed to update profile. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  isProfileComplete(): boolean {
    return this.currentUser()?.profileComplete ?? false;
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
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

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  refreshToken(): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/refresh`, {
      refreshToken: this.getRefreshToken()
    }).pipe(
      tap(user => this.setSession(user))
    );
  }

  private setSession(user: User): void {
    localStorage.setItem(this.TOKEN_KEY, user.token);
    if (user.refreshToken) localStorage.setItem(this.REFRESH_KEY, user.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private loadUser(): void {
    const stored = localStorage.getItem(this.USER_KEY);
    const refresh = localStorage.getItem(this.REFRESH_KEY);
    if (stored && this.isAuthenticated()) {
      this.currentUser.set(JSON.parse(stored));
    } else if (stored && refresh && !this.isAuthenticated()) {
      this.refreshToken().subscribe({
        next: user => {
          this.currentUser.set(user);
        },
        error: () => {
          localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.REFRESH_KEY);
          localStorage.removeItem(this.USER_KEY);
        }
      });
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }
}
