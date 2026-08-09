import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { GooglePhotosService } from '../../core/services/google-photos.service';
import { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
    <div class="card">
      <h2>Profile</h2>
      <p class="card-subtitle">Update your personal information.</p>

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

        <div class="avatar-section">
          <div class="avatar-preview" [class.has-photo]="avatarUrl">
            <img *ngIf="avatarUrl" [src]="avatarUrl" alt="avatar preview" />
            <span *ngIf="!avatarUrl" class="avatar-placeholder">Photo</span>
          </div>

          <div class="avatar-controls">
            <div class="avatar-buttons">
              <button
                type="button"
                class="btn-secondary"
                (click)="fileInput?.click()"
                [disabled]="uploadingFile()"
              >
                <span class="material-symbols-rounded">upload</span>
                {{ uploadingFile() ? 'Uploading…' : 'Upload from device' }}
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="pickFromGooglePhotos()"
                [disabled]="pickingFromPhotos()"
              >
                <span class="material-symbols-rounded">photo_library</span>
                {{ pickingFromPhotos() ? 'Opening Photos…' : 'Select from Google Photos' }}
              </button>
            </div>
            <input
              #fileInput
              type="file"
              accept="image/*"
              hidden
              (change)="onFileSelected($event)"
            />
            <p class="avatar-hint">
              Photos are cropped to a square and stored as your avatar.
            </p>
          </div>
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
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    label { display: block; margin-bottom: 16px; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
    input, textarea {
      display: block; width: 100%; margin-top: 6px; padding: 10px 12px;
      background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px; font-family: inherit;
      box-sizing: border-box;
    }
    textarea { resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); }

    .avatar-section { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .avatar-preview { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border); background: var(--surface-hover); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { font-size: 12px; color: var(--text-secondary); }
    .avatar-controls { display: flex; flex-direction: column; gap: 6px; }
    .avatar-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .avatar-controls .btn-secondary { display: inline-flex; align-items: center; gap: 8px; }
    .avatar-controls .btn-secondary .material-symbols-rounded { font-size: 18px; }
    .avatar-controls .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .avatar-hint { font-size: 12px; color: var(--text-secondary); margin: 0; }

    .form-actions { display: flex; gap: 12px; }

    .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background: var(--surface-hover); color: var(--text-primary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-secondary:hover { opacity: 0.85; }

    .form-error { color: var(--error); font-size: 13px; margin-top: 8px; }
    .form-success { color: var(--success); font-size: 13px; margin-top: 8px; }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ProfileSettingsComponent implements OnInit {
  private auth = inject(AuthService);
  private googlePhotos = inject(GooglePhotosService);

  username = '';
  firstName = '';
  lastName = '';
  schoolName = '';
  avatarUrl = '';
  bio = '';

  saving = this.auth.saving;
  error = this.auth.error;
  success = this.auth.success;
  pickingFromPhotos = signal(false);
  uploadingFile = signal(false);

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

  async pickFromGooglePhotos(): Promise<void> {
    this.auth.clearMessages();
    this.pickingFromPhotos.set(true);
    try {
      this.avatarUrl = await this.googlePhotos.pickAvatar();
    } catch (err: any) {
      this.auth.error.set(err?.message || 'Could not select a photo. Please try again.');
    } finally {
      this.pickingFromPhotos.set(false);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

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
      input.value = '';
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
