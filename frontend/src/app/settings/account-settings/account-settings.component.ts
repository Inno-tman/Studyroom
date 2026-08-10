import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
    <div class="card">
      <h2>Account</h2>
      <p class="card-subtitle">Manage your account details.</p>

      <div class="info-row">
        <span class="info-label">Username</span>
        <span class="info-value">{{ auth.currentUser()?.username }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">{{ auth.currentUser()?.email }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Role</span>
        <span class="info-value capitalize">{{ auth.currentUser()?.role }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Member since</span>
        <span class="info-value">{{ auth.currentUser()?.expiresAt ? 'Active account' : 'Active account' }}</span>
      </div>

      <hr />

      <h3 class="section-title">Change Password</h3>

      <form (ngSubmit)="changePassword()" #passwordForm="ngForm">
        <label>
          Current Password
          <input type="password" name="currentPassword" [(ngModel)]="currentPassword" required #currentField="ngModel" />
        </label>

        <label>
          New Password
          <input type="password" name="newPassword" [(ngModel)]="newPassword" required minlength="6" maxlength="100" #newField="ngModel" />
        </label>

        <label>
          Confirm New Password
          <input type="password" name="confirmPassword" [(ngModel)]="confirmPassword" required #confirmField="ngModel" />
        </label>

        <div *ngIf="confirmPassword && confirmPassword !== newPassword" class="form-error">
          Passwords do not match.
        </div>

        <div class="form-actions">
          <button type="submit" [disabled]="passwordForm.invalid || savingPassword || confirmPassword !== newPassword" class="btn-primary">
            {{ savingPassword ? 'Savingâ€¦' : 'Update Password' }}
          </button>
        </div>

        <div *ngIf="passwordError" class="form-error">{{ passwordError }}</div>
        <div *ngIf="passwordSuccess" class="form-success">{{ passwordSuccess }}</div>
      </form>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 24px; }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .info-label { font-size: var(--font-14); color: var(--text-secondary); }
    .info-value { font-size: var(--font-14); color: var(--text-primary); font-weight: 500; }
    .capitalize { text-transform: capitalize; }

    hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }

    .section-title { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); margin-bottom: 16px; }

    label { display: block; margin-bottom: 16px; font-size: var(--font-14); font-weight: 500; color: var(--text-secondary); }
    input {
      display: block; width: 100%; margin-top: 6px; padding: 10px 12px;
      background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: var(--font-14);
      box-sizing: border-box;
    }
    input:focus { outline: none; border-color: var(--primary); }

    .form-actions { margin-top: 4px; }

    .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: var(--font-14); font-weight: 600; cursor: pointer; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .form-error { color: var(--error); font-size: var(--font-13); margin-top: 8px; }
    .form-success { color: var(--success); font-size: var(--font-13); margin-top: 8px; }
  `]
})
export class AccountSettingsComponent {
  auth = inject(AuthService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  savingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  async changePassword(): Promise<void> {
    this.passwordError = '';
    this.passwordSuccess = '';
    this.savingPassword = true;
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword).toPromise();
      this.passwordSuccess = 'Password updated successfully.';
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      this.passwordError = err?.error?.error || 'Failed to update password. Please try again.';
    } finally {
      this.savingPassword = false;
    }
  }
}
