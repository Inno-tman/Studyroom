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
      <span class="reminder-icon material-icons">lightbulb</span>
      <span class="reminder-text">Tip: add a profile picture whenever you get a chance — it helps others recognize you.</span>
      <button class="reminder-action" (click)="goToProfile()">Set up profile</button>
    </div>
  `,
  styles: [`
    .reminder-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
      color: var(--text-primary);
      font-size: var(--font-14);
    }

    .reminder-icon { font-size: var(--font-16); color: var(--accent); }

    .reminder-text { flex: 1; }

    .reminder-action {
      background: var(--primary);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: var(--font-13);
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
