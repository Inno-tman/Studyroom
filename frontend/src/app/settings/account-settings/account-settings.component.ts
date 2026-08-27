import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
        <span class="info-label">Last seen</span>
        <span class="info-value">
          <span *ngIf="online; else offlineText">
            <span class="presence-dot online"></span> Online now
          </span>
          <ng-template #offlineText>
            <span class="presence-dot"></span> {{ lastSeenText }}
          </ng-template>
        </span>
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
            {{ savingPassword ? 'Saving…' : 'Update Password' }}
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
    .info-value { font-size: var(--font-14); color: var(--text-primary); font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
    .capitalize { text-transform: capitalize; }

    .presence-dot {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--text-muted);
      flex-shrink: 0;
    }
    .presence-dot.online {
      background: var(--success);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent);
    }

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
  `]
})
export class AccountSettingsComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);

  online = false;
  lastSeenText = 'Never';
  private statusTimer?: any;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  savingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  ngOnInit(): void {
    this.refreshStatus();
    this.statusTimer = setInterval(() => this.refreshStatus(), 60000);
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearInterval(this.statusTimer);
  }

  async refreshStatus(): Promise<void> {
    try {
      const status = await this.auth.getAccountStatus().toPromise();
      this.online = status?.isOnline ?? false;
      this.lastSeenText = this.formatLastSeen(status?.lastSeenAt);
    } catch {
      this.online = false;
      this.lastSeenText = 'Never';
    }
  }

  private formatLastSeen(iso?: string): string {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    if (diffMs < 0) return 'Just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString();
  }

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
