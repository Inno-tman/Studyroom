import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile-reminder',
  standalone: true,
  imports: [NgIf],
  template: `
    <div *ngIf="showReminder()" class="reminder-banner">
      <span class="reminder-icon">⚠️</span>
      <span class="reminder-text">Your profile is incomplete — add a profile picture so others can recognize you.</span>
      <button class="reminder-action" (click)="goToProfile()">Complete Profile</button>
    </div>
  `,
  styles: [`
    .reminder-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      background: rgba(245, 158, 11, 0.12);
      border-bottom: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--text-primary);
      font-size: 14px;
    }

    .reminder-icon { font-size: 16px; }

    .reminder-text { flex: 1; }

    .reminder-action {
      background: var(--primary);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
    }

    .reminder-action:hover { opacity: 0.85; }
  `]
})
export class ProfileReminderComponent {
  auth: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  showReminder = computed(() => !!this.auth.currentUser() && !this.auth.isProfileComplete());

  goToProfile(): void {
    this.router.navigate(['/settings/profile']);
  }
}
