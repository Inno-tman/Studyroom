import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-study-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <h2>Focus Preferences</h2>
      <p class="card-subtitle">Tune your pomodoro timer and focus goals.</p>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">timer</span>
          <div>
            <div class="pref-name">Focus Duration</div>
            <div class="pref-desc">Default length of a focus session in minutes.</div>
          </div>
        </div>
        <div class="number-input">
          <input type="number" min="1" max="180" [ngModel]="settings.study().focusDuration" (ngModelChange)="update('focusDuration', $event)" />
          <span class="unit">min</span>
        </div>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">coffee</span>
          <div>
            <div class="pref-name">Break Duration</div>
            <div class="pref-desc">Default length of a break in minutes.</div>
          </div>
        </div>
        <div class="number-input">
          <input type="number" min="1" max="60" [ngModel]="settings.study().breakDuration" (ngModelChange)="update('breakDuration', $event)" />
          <span class="unit">min</span>
        </div>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">flag</span>
          <div>
            <div class="pref-name">Daily Focus Goal</div>
            <div class="pref-desc">How much you want to focus each day.</div>
          </div>
        </div>
        <div class="number-input">
          <input type="number" min="10" max="1440" [ngModel]="settings.study().dailyStudyGoalMinutes" (ngModelChange)="update('dailyStudyGoalMinutes', $event)" />
          <span class="unit">min</span>
        </div>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="material-icons pref-icon">skip_next</span>
          <div>
            <div class="pref-name">Auto-Start Next Session</div>
            <div class="pref-desc">Automatically begin the break when focus ends, and start focus after the break.</div>
          </div>
        </div>
        <button class="theme-toggle" [class.on]="settings.study().autoStartNextSession" (click)="settings.updateStudy({ autoStartNextSession: !settings.study().autoStartNextSession })" aria-label="Toggle auto-start next session">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 24px; }

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

    .number-input {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px 10px;
    }

    .number-input input {
      width: 64px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: var(--font-15);
      font-weight: 600;
      text-align: right;
      outline: none;
    }

    .number-input input:focus { border-color: var(--primary); }

    .number-input .unit { font-size: var(--font-12); color: var(--text-muted); }

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

    @media (max-width: 480px) {
      .pref-row { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class StudySettingsComponent {
  settings = inject(SettingsService);

  update(key: 'focusDuration' | 'breakDuration' | 'dailyStudyGoalMinutes', value: number): void {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    this.settings.updateStudy({ [key]: Math.max(1, num) });
  }
}
