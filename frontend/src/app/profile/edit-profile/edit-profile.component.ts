import { Component, inject, input, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
    <div class="edit-section">
      <h2>Edit Profile</h2>
      <form (ngSubmit)="save()" #profileForm="ngForm">
        <div class="form-grid">
          <label>
            Username
            <input
              type="text"
              name="username"
              [(ngModel)]="username"
              required
              minlength="3"
              maxlength="50"
              #usernameField="ngModel"
            />
          </label>

          <label>
            First Name
            <input type="text" name="firstName" [(ngModel)]="firstName" maxlength="100" />
          </label>

          <label>
            Last Name
            <input type="text" name="lastName" [(ngModel)]="lastName" maxlength="100" />
          </label>

          <label>
            School Name
            <input type="text" name="schoolName" [(ngModel)]="schoolName" maxlength="150" />
          </label>
        </div>

        <label>
          Avatar URL
          <input
            type="text"
            name="avatarUrl"
            [(ngModel)]="avatarUrl"
            placeholder="https://example.com/avatar.jpg"
          />
        </label>

        <div *ngIf="avatarUrl" class="avatar-preview">
          <img [src]="avatarUrl" alt="avatar preview" />
        </div>

        <label>
          Bio
          <textarea
            name="bio"
            [(ngModel)]="bio"
            rows="4"
            maxlength="1000"
            placeholder="Tell others about yourself…"
          ></textarea>
        </label>

        <div *ngIf="usernameField.invalid && usernameField.touched" class="form-error">
          Username must be at least 3 characters.
        </div>

        <div class="form-actions">
          <button type="submit" [disabled]="profileForm.invalid || saving()" class="btn-primary">
            {{ saving() ? 'Saving…' : 'Save Changes' }}
          </button>
          <button type="button" class="btn-secondary" (click)="reset()">Reset</button>
        </div>

        <div *ngIf="error()" class="form-error">{{ error() }}</div>
        <div *ngIf="success()" class="form-success">{{ success() }}</div>
      </form>
    </div>
  `,
  styles: [`
    .edit-section { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px; }
    .edit-section h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 20px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    label { display: block; margin-bottom: 16px; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
    input, textarea {
      display: block; width: 100%; margin-top: 6px; padding: 10px 12px;
      background: var(--surface-alt, var(--background)); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px; font-family: inherit;
      box-sizing: border-box;
    }
    textarea { resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); }

    .avatar-preview { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; margin-bottom: 16px; }
    .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }

    .form-actions { display: flex; gap: 12px; }

    .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background: var(--surface-hover); color: var(--text-primary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-secondary:hover { opacity: 0.85; }

    .form-error { color: var(--error); font-size: 13px; margin-top: 8px; }
    .form-success { color: #10b981; font-size: 13px; margin-top: 8px; }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class EditProfileComponent implements OnInit {
  private auth = inject(AuthService);

  username = '';
  firstName = '';
  lastName = '';
  schoolName = '';
  avatarUrl = '';
  bio = '';

  saving = this.auth.saving;
  error = this.auth.error;
  success = this.auth.success;

  ngOnInit(): void {
    this.reset();
  }

  reset(): void {
    const user = this.auth.currentUser() ?? ({} as User);
    this.username = user.username ?? '';
    this.firstName = user.firstName ?? '';
    this.lastName = user.lastName ?? '';
    this.schoolName = user.schoolName ?? '';
    this.avatarUrl = user.avatarUrl ?? '';
    this.bio = user.bio ?? '';
    this.auth.clearMessages();
  }

  async save(): Promise<void> {
    await this.auth.saveProfile({
      username: this.username.trim(),
      firstName: this.firstName.trim() || undefined,
      lastName: this.lastName.trim() || undefined,
      schoolName: this.schoolName.trim() || undefined,
      avatarUrl: this.avatarUrl.trim() || undefined,
      bio: this.bio.trim() || undefined
    });
  }
}
