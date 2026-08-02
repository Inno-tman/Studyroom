import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { NotificationPrefs, SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-notifications-settings',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="card">
      <h2>Notifications</h2>
      <p class="card-subtitle">Choose what you want to be notified about.</p>

      <div class="pref-row" *ngFor="let pref of prefs">
        <div class="pref-info">
          <span class="material-icons pref-icon">{{ pref.icon }}</span>
          <div>
            <div class="pref-name">{{ pref.label }}</div>
            <div class="pref-desc">{{ pref.desc }}</div>
          </div>
        </div>
        <button
          class="theme-toggle"
          [class.on]="isEnabled(pref.key)"
          (click)="toggle(pref.key)"
          [attr.aria-label]="'Toggle ' + pref.label"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }

    .pref-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }
    .pref-row:last-child { border-bottom: none; }

    .pref-info { display: flex; align-items: center; gap: 14px; }
    .pref-icon { font-size: 22px; color: var(--text-secondary); }
    .pref-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .pref-desc { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

    .theme-toggle {
      width: 48px;
      height: 26px;
      border-radius: 13px;
      border: none;
      background: var(--border);
      position: relative;
      cursor: pointer;
      transition: background 0.2s ease;
      flex-shrink: 0;
    }

    .theme-toggle.on { background: var(--primary); }

    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      transition: left 0.2s ease;
    }

    .theme-toggle.on .toggle-knob { left: 25px; }
  `]
})
export class NotificationsSettingsComponent {
  settings: SettingsService = inject(SettingsService);

  prefs: { key: keyof NotificationPrefs; label: string; desc: string; icon: string }[] = [
    { key: 'studyReminders', label: 'Study Reminders', desc: 'Get reminders for your study sessions and pomodoro timers.', icon: 'timer' },
    { key: 'roomActivity', label: 'Room Activity', desc: 'Be notified when someone joins or posts in your study rooms.', icon: 'meeting_room' },
    { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Receive a weekly digest of your study statistics.', icon: 'insights' }
  ];

  isEnabled(key: keyof NotificationPrefs): boolean {
    return this.settings.prefs()[key];
  }

  toggle(key: keyof NotificationPrefs): void {
    this.settings.updatePrefs({ [key]: !this.settings.prefs()[key] });
  }
}
