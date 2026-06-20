import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { RoomService } from '../../core/services/room.service';

@Component({
  selector: 'app-room-create',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  template: `
    <div class="create-room">
      <div class="page-header">
        <h1>Create Study Room</h1>
        <a routerLink="/rooms" class="btn-outline">Back</a>
      </div>

      <div class="form-container">
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="name">Room Name *</label>
            <input id="name" type="text" [(ngModel)]="name" name="name" required placeholder="e.g., Calculus Study Group" />
          </div>

          <div class="form-group">
            <label for="subject">Subject</label>
            <select id="subject" [(ngModel)]="subject" name="subject">
              <option value="">General</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Literature">Literature</option>
              <option value="History">History</option>
              <option value="Languages">Languages</option>
            </select>
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" [(ngModel)]="description" name="description" placeholder="What will this room be about?" rows="4"></textarea>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="isPrivate" name="isPrivate" />
              <span>Private room (requires join code)</span>
            </label>
          </div>

          <p class="error" *ngIf="error">{{ error }}</p>

          <button type="submit" class="btn-primary" [disabled]="loading || !name">
            {{ loading ? 'Creating...' : 'Create Room' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .create-room { max-width: 640px; }
    .btn-outline { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; font-weight: 500; text-decoration: none; }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

    .form-container { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px; }
    form { display: flex; flex-direction: column; gap: 20px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input, .form-group select, .form-group textarea { padding: 12px 16px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--primary); }
    .form-group input::placeholder, .form-group textarea::placeholder { color: var(--text-muted); }
    .form-group textarea { resize: vertical; }

    .checkbox-group { flex-direction: row; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; text-transform: none !important; font-size: 14px !important; color: var(--text-primary) !important; }
    .checkbox-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary); }

    .error { color: var(--error); font-size: 13px; }
    .btn-primary { padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s; align-self: flex-start; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class RoomCreateComponent {
  private roomService = inject(RoomService);
  private router = inject(Router);

  name = '';
  subject = '';
  description = '';
  isPrivate = false;
  error = '';
  loading = false;

  async onSubmit() {
    if (!this.name) return;
    this.loading = true;
    this.error = '';

    try {
      const room = await this.roomService.create({
        name: this.name,
        subject: this.subject || undefined,
        description: this.description || undefined,
        isPrivate: this.isPrivate
      }).toPromise();

      if (room) this.router.navigate(['/rooms', room.id]);
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to create room.';
    } finally {
      this.loading = false;
    }
  }
}
