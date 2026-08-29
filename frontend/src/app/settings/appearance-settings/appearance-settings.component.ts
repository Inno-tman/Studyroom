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
      <p class="card-subtitle">Customize how ResVibe looks.</p>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">brightness_6</span>
          <div>
            <div class="setting-name">Theme</div>
            <div class="setting-desc">Choose light, dark, or follow your system setting.</div>
          </div>
        </div>
        <div class="segmented" role="group" aria-label="Theme">
          <button
            *ngFor="let t of themeOptions"
            class="segment"
            [class.active]="settings.theme() === t.value"
            (click)="settings.setTheme(t.value)"
          >
            <span class="material-icons seg-icon">{{ t.icon }}</span>{{ t.label }}
          </button>
        </div>
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
          <label class="accent-custom" [class.active]="!isPresetAccent()" title="Custom color">
            <input type="color" [value]="settings.appearance().accentColor" (input)="onCustomColor($event)" aria-label="Pick a custom accent color" />
            <span class="material-icons">colorize</span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">aspect_ratio</span>
          <div>
            <div class="setting-name">Corner Style</div>
            <div class="setting-desc">Change how rounded cards and panels are.</div>
          </div>
        </div>
        <div class="segmented" role="group" aria-label="Corner style">
          <button
            *ngFor="let c of cornerStyles"
            class="segment"
            [class.active]="settings.appearance().cornerStyle === c.value"
            (click)="settings.updateAppearance({ cornerStyle: c.value })"
          >{{ c.label }}</button>
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
            <div class="setting-desc">Change the typeface used throughout ResVibe.</div>
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

      <div class="setting-row">
        <div class="setting-info">
          <span class="material-icons setting-icon">contrast</span>
          <div>
            <div class="setting-name">High Contrast</div>
            <div class="setting-desc">Strengthen text and borders for easier reading.</div>
          </div>
        </div>
        <button class="theme-toggle" (click)="settings.updateAppearance({ highContrast: !settings.appearance().highContrast })" [class.on]="settings.appearance().highContrast" aria-label="Toggle high contrast">
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

    .accent-custom {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--border);
      background: conic-gradient(#ff3b30, #ffcc00, #34c759, #32ade6, #5856d6, #ff2d95, #ff3b30);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .accent-custom:hover { transform: scale(1.15); }
    .accent-custom.active { border-color: var(--text-primary); }
    .accent-custom .material-icons {
      font-size: 14px;
      color: white;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    }
    .accent-custom input[type="color"] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: none;
      padding: 0;
    }

    .seg-icon { font-size: 16px; vertical-align: -3px; margin-right: 4px; }

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
  themeOptions = [
    { label: 'Light', value: 'light', icon: 'light_mode' },
    { label: 'System', value: 'system', icon: 'brightness_auto' },
    { label: 'Dark', value: 'dark', icon: 'dark_mode' }
  ] as const;
  cornerStyles = [
    { label: 'Sharp', value: 'sharp' },
    { label: 'Rounded', value: 'rounded' },
    { label: 'Soft', value: 'soft' }
  ] as const;
  fontScales = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
    { label: 'Extra', value: 'xlarge' }
  ] as const;
  fontStyles = [
    { label: 'Modern', value: 'inter' },
    { label: 'Serif', value: 'serif' },
    { label: 'Mono', value: 'mono' }
  ] as const;

  isPresetAccent(): boolean {
    return ACCENT_COLORS.some(a => a.color === this.settings.appearance().accentColor);
  }

  onCustomColor(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value && /^#[0-9A-Fa-f]{6}$/.test(input.value)) {
      this.settings.updateAppearance({ accentColor: input.value });
    }
  }
}
