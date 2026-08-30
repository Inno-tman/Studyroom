import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationPrefs, SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';

type BoolPrefKey = {
  [K in keyof NotificationPrefs]: NotificationPrefs[K] extends boolean ? K : never
}[keyof NotificationPrefs];

@Component({
  selector: 'app-notifications-settings',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="card">
      <h2>Notifications</h2>
      <p class="card-subtitle">Choose how and when ResVibe should get your attention.</p>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">desktop_windows</span>
          <div>
            <div class="pref-name">Desktop Notifications</div>
            <div class="pref-desc">Show browser notifications when you're not looking at the app.</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="settings.prefs().desktopNotifications" (click)="toggle('desktopNotifications')" aria-label="Toggle desktop notifications">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">volume_up</span>
          <div>
            <div class="pref-name">Notification Sound</div>
            <div class="pref-desc">Play a sound when a new message or reminder arrives.</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="settings.prefs().notificationSound" (click)="toggle('notificationSound')" aria-label="Toggle notification sound">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="sound-options" *ngIf="settings.prefs().notificationSound">
        <div class="pref-row">
          <div class="pref-info">
            <span class="material-icons pref-icon">music_note</span>
            <div>
              <div class="pref-name">Sound Type</div>
              <div class="pref-desc">Choose your notification sound.</div>
            </div>
          </div>
          <select class="sound-select" [ngModel]="settings.prefs().soundType" (ngModelChange)="settings.updatePrefs({ soundType: $event })">
            <option value="chime">Chime</option>
            <option value="bell">Bell</option>
            <option value="soft">Soft</option>
            <option value="none">None</option>
          </select>
        </div>
        <div class="pref-row">
          <div class="pref-info">
            <span class="material-icons pref-icon">volume_down</span>
            <div>
              <div class="pref-name">Volume</div>
              <div class="pref-desc">Adjust notification sound volume.</div>
            </div>
          </div>
          <input type="range" class="volume-slider" min="0" max="1" step="0.1"
            [ngModel]="settings.prefs().soundVolume"
            (ngModelChange)="settings.updatePrefs({ soundVolume: $event })" />
        </div>
        <button class="test-sound-btn" (click)="testSound()">
          <span class="material-icons">play_circle</span> Test Sound
        </button>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">preview</span>
          <div>
            <div class="pref-name">Message Previews</div>
            <div class="pref-desc">Include message content in desktop notifications.</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="settings.prefs().showMessagePreviews" (click)="toggle('showMessagePreviews')" aria-label="Toggle message previews">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">bedtime</span>
          <div>
            <div class="pref-name">Quiet Hours</div>
            <div class="pref-desc">Mute notifications between a set time window.</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="settings.prefs().quietHoursEnabled" (click)="toggle('quietHoursEnabled')" aria-label="Toggle quiet hours">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="quiet-hours" *ngIf="settings.prefs().quietHoursEnabled">
        <label>
          From
          <input type="time" [ngModel]="settings.prefs().quietHoursStart" (ngModelChange)="settings.updatePrefs({ quietHoursStart: $event })" />
        </label>
        <label>
          To
          <input type="time" [ngModel]="settings.prefs().quietHoursEnd" (ngModelChange)="settings.updatePrefs({ quietHoursEnd: $event })" />
        </label>
      </div>

      <h3 class="section-title">Event Notifications</h3>

      <div class="pref-row" *ngFor="let pref of eventPrefs">
        <div class="pref-info">
          <span class="material-icons pref-icon">{{ pref.icon }}</span>
          <div>
            <div class="pref-name">{{ pref.label }}</div>
            <div class="pref-desc">{{ pref.desc }}</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="isEnabled(pref.key)" (click)="toggle(pref.key)" [attr.aria-label]="'Toggle ' + pref.label">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 24px; }

    .section-title { font-size: var(--font-13); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px; padding-top: 16px; border-top: 1px solid var(--border); }

    .pref-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .pref-row:last-child { border-bottom: none; }

    .pref-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .pref-icon { font-size: var(--font-22); color: var(--text-secondary); flex-shrink: 0; }
    .pref-name { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .pref-desc { font-size: var(--font-13); color: var(--text-secondary); margin-top: 2px; }

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

    .quiet-hours {
      display: flex;
      gap: 16px;
      padding: 12px 0 12px 36px;
      flex-wrap: wrap;
    }

    .quiet-hours label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--font-12);
      font-weight: 600;
      color: var(--text-secondary);
    }

    .quiet-hours input {
      padding: 8px 10px;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: var(--font-13);
      outline: none;
    }

    .quiet-hours input:focus { border-color: var(--primary); }

    .sound-options { padding-left: 36px; display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .sound-select {
      padding: 8px 12px; background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none;
    }
    .sound-select:focus { border-color: var(--primary); }
    .volume-slider { width: 120px; accent-color: var(--primary); }
    .test-sound-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      cursor: pointer; transition: all 0.15s; width: fit-content;
    }
    .test-sound-btn:hover { border-color: var(--primary); color: var(--primary); }
    .test-sound-btn .material-icons { font-size: 18px; }

    @media (max-width: 480px) {
      .pref-row { flex-direction: column; align-items: flex-start; }
      .quiet-hours { padding-left: 0; }
    }
  `]
})
export class NotificationsSettingsComponent {
  settings: SettingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);

  eventPrefs: { key: BoolPrefKey; label: string; desc: string; icon: string }[] = [
    { key: 'directMessages', label: 'Direct Messages', desc: 'Notify when you receive a direct message.', icon: 'chat' },
    { key: 'roomActivity', label: 'Room Activity', desc: 'Be notified when someone joins or posts in your rooms.', icon: 'meeting_room' },
    { key: 'friendRequests', label: 'Friend Requests', desc: 'Notify when someone sends you a friend request.', icon: 'person_add' },
    { key: 'roomInvites', label: 'Room Invites', desc: 'Notify when a friend invites you to a room.', icon: 'mark_email_unread' },
    { key: 'postComments', label: 'Post Comments', desc: 'Notify when someone comments on or replies to your posts.', icon: 'comment' },
    { key: 'pomodoroComplete', label: 'Pomodoro Complete', desc: 'Alert when a focus session finishes.', icon: 'timer' },
    { key: 'studyReminders', label: 'Focus Reminders', desc: 'Get reminders for your focus sessions.', icon: 'alarm' },
    { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Receive a weekly digest of your focus statistics.', icon: 'insights' }
  ];

  isEnabled(key: BoolPrefKey): boolean {
    return this.settings.prefs()[key];
  }

  toggle(key: BoolPrefKey): void {
    const next = !this.settings.prefs()[key];
    this.settings.updatePrefs({ [key]: next });
    if (key === 'desktopNotifications' && next) {
      this.notificationService.requestPermission();
    }
  }

  testSound(): void {
    this.notificationService.playSound();
  }
}
