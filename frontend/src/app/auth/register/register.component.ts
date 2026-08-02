import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

declare global {
  interface Window { google: any; }
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>Create account</h1>
          <p>Join the StudyRoom community</p>
        </div>

        <div class="social-login">
          <div id="google-signin-button"></div>
          <p class="error" *ngIf="error">{{ error }}</p>
          <div class="divider"><span>or</span></div>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" [(ngModel)]="username" name="username" required placeholder="Choose a username" autocomplete="username" />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" [(ngModel)]="email" name="email" required placeholder="Enter your email" autocomplete="email" />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" [(ngModel)]="password" name="password" required placeholder="Create a password" autocomplete="new-password" />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required placeholder="Confirm your password" autocomplete="new-password" />
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>

        <p class="auth-footer">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; margin: -24px; }
    .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; }
    .auth-header { text-align: center; margin-bottom: 32px; }
    .auth-header h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .auth-header p { color: var(--text-secondary); }

    .social-login { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-bottom: 24px; }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      color: var(--text-muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .auth-form { display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input { padding: 12px 16px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 0.15s; }
    .form-group input:focus { border-color: var(--primary); }
    .form-group input::placeholder { color: var(--text-muted); }
    .error { color: var(--error); font-size: 13px; }
    .btn-primary { padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .auth-footer { text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 13px; }
    .auth-footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
  `]
})
export class RegisterComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  loading = false;
  private googleInitTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.initializeGoogleSignIn();
  }

  ngOnDestroy(): void {
    if (this.googleInitTimer) clearInterval(this.googleInitTimer);
  }

  private initializeGoogleSignIn(): void {
    const initialize = () => {
      try {
        if (!window.google?.accounts?.id) return;

        const buttonElement = document.getElementById('google-signin-button');
        if (!buttonElement) return;

        window.google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) =>
            this.ngZone.run(() => this.handleGoogleCredential(response))
        });

        window.google.accounts.id.renderButton(buttonElement, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          width: 320,
          text: 'signin_with'
        });
      } catch (e) {
        console.warn('Google Sign-In init failed, will retry:', e);
      }
    };

    if (window.google?.accounts?.id) {
      initialize();
    } else {
      this.googleInitTimer = setInterval(() => {
        if (window.google?.accounts?.id && this.googleInitTimer) {
          clearInterval(this.googleInitTimer);
          this.googleInitTimer = undefined;
          initialize();
        }
      }, 100);
    }
  }

  private handleGoogleCredential(response: any): void {
    if (!response?.credential) {
      this.error = 'Google authentication failed. Please try again.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.auth.googleLogin(response.credential).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: any) => {
        this.error = err.error?.error || 'Google login failed. Please try again.';
        this.loading = false;
      }
    });
  }

  async onSubmit() {
    if (!this.username || !this.email || !this.password) return;
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.auth.register({ username: this.username, email: this.email, password: this.password }).toPromise();
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error = err.error?.error || 'Registration failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
