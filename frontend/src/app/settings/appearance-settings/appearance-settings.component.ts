import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="card">
      <h2>Appearance</h2>
      <p class="card-subtitle">Customize how StudyRoom looks.</p>

      <div class="theme-row">
        <div class="theme-info">
          <span class="theme-icon material-icons">{{ settings.theme() === 'dark' ? 'dark_mode' : 'light_mode' }}</span>
          <div>
            <div class="theme-name">{{ settings.theme() === 'dark' ? 'Dark Mode' : 'Light Mode' }}</div>
            <div class="theme-desc">Choose between dark and light themes.</div>
          </div>
        </div>
        <button class="theme-toggle" (click)="settings.toggleTheme()" [class.on]="settings.theme() === 'dark'" aria-label="Toggle theme">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }

    .theme-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
    }

    .theme-info { display: flex; align-items: center; gap: 14px; }
    .theme-icon { font-size: 26px; color: var(--accent); }
    .theme-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .theme-desc { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

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
export class AppearanceSettingsComponent {
  settings = inject(SettingsService);
}
