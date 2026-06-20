import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to StudyRoom</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="Enter your username"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="Enter your password"
              autocomplete="current-password"
            />
          </div>

          <p class="error" *ngIf="error">{{ error }}</p>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <p class="auth-footer">
          Don't have an account? <a routerLink="/register">Sign up</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      margin: -24px;
    }

    .auth-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
    }

    .auth-header { text-align: center; margin-bottom: 32px; }
    .auth-header h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .auth-header p { color: var(--text-secondary); }

    .auth-form { display: flex; flex-direction: column; gap: 20px; }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group input {
      padding: 12px 16px;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }

    .form-group input:focus {
      border-color: var(--primary);
    }

    .form-group input::placeholder {
      color: var(--text-muted);
    }

    .error { color: var(--error); font-size: 13px; }

    .btn-primary {
      padding: 12px 24px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .auth-footer { text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 13px; }
    .auth-footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  error = '';
  loading = false;

  async onSubmit() {
    if (!this.username || !this.password) return;
    this.loading = true;
    this.error = '';

    try {
      await this.auth.login({ username: this.username, password: this.password }).toPromise();
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error = err.error?.error || 'Login failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
