import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ACCENT_COLORS, SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2>Appearance</h2>
      <p class="card-subtitle">Customize how StudyRoom looks.</p>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">{{ settings.theme() === 'dark' ? 'dark_mode' : 'light_mode' }}</span>
          <div>
            <div class="setting-name">{{ settings.theme() === 'dark' ? 'Dark Mode' : 'Light Mode' }}</div>
            <div class="setting-desc">Choose between dark and light themes.</div>
          </div>
        </div>
        <button class="theme-toggle" (click)="settings.toggleTheme()" [class.on]="settings.theme() === 'dark'" aria-label="Toggle theme">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">palette</span>
          <div>
            <div class="setting-name">Accent Color</div>
            <div class="setting-desc">Pick the color used for buttons, links and highlights.</div>
          </div>
        </div>
        <div class="accent-picker">
          <button
            *ngFor="let accent of accents"
            class="accent-dot"
            [class.active]="settings.appearance().accentColor === accent.color"
            [style.background]="accent.color"
            [attr.title]="accent.name"
            (click)="settings.updateAppearance({ accentColor: accent.color })"
            [attr.aria-label]="'Set accent to ' + accent.name"
          ></button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">text_fields</span>
          <div>
            <div class="setting-name">Text Size</div>
            <div class="setting-desc">Adjust the base font size across the app.</div>
          </div>
        </div>
        <div class="segmented" role="group" aria-label="Text size">
          <button
            *ngFor="let s of fontScales"
            class="segment"
            [class.active]="settings.appearance().fontScale === s.value"
            (click)="settings.updateAppearance({ fontScale: s.value })"
          >{{ s.label }}</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">font_download</span>
          <div>
            <div class="setting-name">Font Style</div>
            <div class="setting-desc">Change the typeface used throughout StudyRoom.</div>
          </div>
        </div>
        <div class="segmented" role="group" aria-label="Font style">
          <button
            *ngFor="let f of fontStyles"
            class="segment"
            [class.active]="settings.appearance().fontStyle === f.value"
            (click)="settings.updateAppearance({ fontStyle: f.value })"
          >{{ f.label }}</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">compress</span>
          <div>
            <div class="setting-name">Compact Mode</div>
            <div class="setting-desc">Reduce spacing and padding for a denser layout.</div>
          </div>
        </div>
        <button class="theme-toggle" (click)="settings.updateAppearance({ compactMode: !settings.appearance().compactMode })" [class.on]="settings.appearance().compactMode" aria-label="Toggle compact mode">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">slow_motion_video</span>
          <div>
            <div class="setting-name">Reduce Motion</div>
            <div class="setting-desc">Turn off animations and transitions.</div>
          </div>
        </div>
        <button class="theme-toggle" (click)="settings.updateAppearance({ reduceMotion: !settings.appearance().reduceMotion })" [class.on]="settings.appearance().reduceMotion" aria-label="Toggle reduce motion">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
    .card h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 24px; }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .setting-row:last-child { border-bottom: none; }

    .setting-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .setting-icon { font-size: var(--font-22); color: var(--text-secondary); flex-shrink: 0; }
    .setting-name { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .setting-desc { font-size: var(--font-13); color: var(--text-secondary); margin-top: 2px; }

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

    .accent-picker { display: flex; gap: 8px; flex-wrap: wrap; }

    .accent-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
      padding: 0;
    }

    .accent-dot:hover { transform: scale(1.15); }

    .accent-dot.active { border-color: var(--text-primary); }

    .segmented {
      display: flex;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }

    .segment {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--font-13);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .segment:hover { color: var(--text-primary); }

    .segment.active { background: var(--primary); color: white; }

    @media (max-width: 480px) {
      .setting-row { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class AppearanceSettingsComponent {
  settings = inject(SettingsService);
  accents = ACCENT_COLORS;
  fontScales = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' }
  ] as const;
  fontStyles = [
    { label: 'Modern', value: 'inter' },
    { label: 'Serif', value: 'serif' },
    { label: 'Mono', value: 'mono' }
  ] as const;
}
