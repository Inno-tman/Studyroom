import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
    <div class="card">
      <div class="card-head">
        <div class="card-head-icon">
          <span class="material-icons">person</span>
        </div>
        <div>
          <h2>Profile</h2>
          <p class="card-subtitle">Update your personal information.</p>
        </div>
      </div>

      <form (ngSubmit)="save()" #profileForm="ngForm">
        <section class="avatar-section">
          <div class="avatar-wrap">
            <div class="avatar-preview" [class.has-photo]="avatarUrl">
              <img *ngIf="avatarUrl" [src]="avatarUrl" alt="avatar preview" />
              <span *ngIf="!avatarUrl" class="material-icons avatar-placeholder">person</span>
              <div class="avatar-overlay" (click)="fileInput?.click()">
                <span class="material-icons">{{ uploadingFile() ? 'hourglass_top' : 'photo_camera' }}</span>
                <span class="overlay-label">{{ uploadingFile() ? 'Uploading…' : 'Change' }}</span>
              </div>
            </div>
            <span class="avatar-initial" *ngIf="!avatarUrl">{{ displayNameInitial }}</span>
          </div>

          <div class="avatar-copy">
            <p class="avatar-title">Profile Photo</p>
            <p class="avatar-hint">Click the avatar or browse to upload. JPG or PNG, cropped to a square.</p>
            <button
              type="button"
              class="btn-upload"
              (click)="fileInput?.click()"
              [disabled]="uploadingFile()"
            >
              <span class="material-icons">{{ uploadingFile() ? 'hourglass_top' : 'upload' }}</span>
              {{ uploadingFile() ? 'Uploading…' : 'Upload photo' }}
            </button>
            <input
              #fileInput
              type="file"
              accept="image/*"
              hidden
              (change)="onFileSelected($event)"
            />
          </div>
        </section>

        <div class="form-grid">
          <label>
            <span class="field-label">Username</span>
            <input
              type="text"
              name="username"
              [(ngModel)]="username"
              required
              minlength="3"
              maxlength="50"
              #usernameField="ngModel"
              [class.invalid]="usernameField.invalid && usernameField.touched"
            />
            <span *ngIf="usernameField.invalid && usernameField.touched" class="field-error">
              Must be at least 3 characters.
            </span>
          </label>

          <label>
            <span class="field-label">First Name</span>
            <input type="text" name="firstName" [(ngModel)]="firstName" maxlength="100" />
          </label>

          <label>
            <span class="field-label">Last Name</span>
            <input type="text" name="lastName" [(ngModel)]="lastName" maxlength="100" />
          </label>

          <label>
            <span class="field-label">School Name</span>
            <input type="text" name="schoolName" [(ngModel)]="schoolName" maxlength="150" />
          </label>
        </div>

        <label>
          <span class="field-label">Bio</span>
          <textarea
            name="bio"
            [(ngModel)]="bio"
            rows="4"
            maxlength="1000"
            placeholder="Tell others about yourself…"
          ></textarea>
          <span class="char-count">{{ bio.length }}/1000</span>
        </label>

        <div class="avatar-url" *ngIf="avatarUrl">
          <span class="field-label">Avatar URL</span>
          <input type="text" name="avatarUrl" [(ngModel)]="avatarUrl" readonly />
        </div>

        <div class="form-actions">
          <button type="submit" [disabled]="profileForm.invalid || saving()" class="btn-primary">
            <span class="material-icons">check</span>
            {{ saving() ? 'Saving…' : 'Save Changes' }}
          </button>
          <button type="button" class="btn-secondary" (click)="reset()">Discard</button>
        </div>

        <div *ngIf="error()" class="form-error">{{ error() }}</div>
        <div *ngIf="success()" class="form-success">
          <span class="material-icons">check_circle</span>
          {{ success() }}
        </div>
      </form>
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 32px 32px;
    }

    .card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
    .card-head-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card-head-icon .material-icons { font-size: 22px; }
    .card h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0; }
    .card-subtitle { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }

    .avatar-section {
      display: flex; align-items: center; gap: 24px;
      padding: 20px; margin-bottom: 24px;
      background: var(--background); border: 1px dashed var(--border);
      border-radius: 14px;
      flex-wrap: wrap;
    }

    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar-preview {
      width: 96px; height: 96px; border-radius: 50%;
      overflow: hidden; border: 3px solid var(--primary);
      background: var(--surface-hover);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
    }
    .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { font-size: 40px; color: var(--text-muted); }

    .avatar-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,0.5); color: white;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; opacity: 0; cursor: pointer; transition: opacity 0.2s ease;
    }
    .avatar-overlay:hover, .avatar-preview:hover .avatar-overlay { opacity: 1; }
    .avatar-overlay .material-icons { font-size: 22px; }
    .overlay-label { font-size: 11px; font-weight: 600; }

    .avatar-initial {
      position: absolute; bottom: 2px; right: 2px;
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--primary); color: white; border: 3px solid var(--surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
    }

    .avatar-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .avatar-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
    .avatar-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 8px; }
    .btn-upload {
      display: inline-flex; align-items: center; gap: 8px;
      align-self: flex-start;
      background: var(--primary); color: white; border: none;
      padding: 10px 18px; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-upload:hover { background: var(--primary-hover); }
    .btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }

    .avatar-copy input[type="file"] { display: none; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; margin-bottom: 20px; }

    label { display: block; margin-bottom: 20px; }
    .field-label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--text-secondary); }

    input, textarea {
      display: block; width: 100%; padding: 10px 12px;
      background: var(--background); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text-primary); font-size: 14px; font-family: inherit;
      box-sizing: border-box; transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    textarea { resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent); }
    input.invalid { border-color: var(--error); }
    .field-error { display: block; margin-top: 6px; font-size: 12px; color: var(--error); }

    .char-count { display: block; text-align: right; margin-top: 4px; font-size: 11px; color: var(--text-muted); }

    .avatar-url { margin-bottom: 20px; }
    .avatar-url input { color: var(--text-muted); font-size: 12px; opacity: 0.85; cursor: not-allowed; }

    .form-actions { display: flex; gap: 12px; margin-top: 4px; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--primary); color: white; border: none;
      padding: 11px 22px; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--surface-hover); color: var(--text-primary);
      border: 1px solid var(--border);
      padding: 10px 20px; border-radius: 10px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      transition: opacity 0.15s ease;
    }
    .btn-secondary:hover { opacity: 0.85; }

    .form-error { display: flex; align-items: center; gap: 6px; color: var(--error); font-size: 13px; margin-top: 16px; }
    .form-success { display: flex; align-items: center; gap: 6px; color: var(--success); font-size: 13px; margin-top: 16px; }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .card { padding: 20px; }
      .avatar-section { flex-direction: column; align-items: center; text-align: center; }
      .avatar-copy { align-items: center; }
      .btn-upload { align-self: center; }
    }
  `]
})
export class ProfileSettingsComponent implements OnInit {
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
  uploadingFile = signal(false);

  ngOnInit(): void {
    this.reset();
  }

  get displayNameInitial(): string {
    return (this.username || this.firstName || '?').charAt(0).toUpperCase();
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

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.processFile(file);
    }
  }

  private async processFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.auth.error.set('Please choose an image file.');
      return;
    }

    this.auth.clearMessages();
    this.uploadingFile.set(true);
    try {
      this.avatarUrl = await this.readImageFile(file);
    } catch {
      this.auth.error.set('Could not read that image. Please try another file.');
    } finally {
      this.uploadingFile.set(false);
    }
  }

  private readImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(this.resizeToSquare(img));
        img.onerror = () => reject(new Error('image load failed'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('file read failed'));
      reader.readAsDataURL(file);
    });
  }

  private resizeToSquare(img: HTMLImageElement): string {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No canvas context');
    }

    const scale = Math.max(size / img.width, size / img.height);
    const sw = size / scale;
    const sh = size / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
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
