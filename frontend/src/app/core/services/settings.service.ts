import { Injectable, signal } from '@angular/core';

export interface NotificationPrefs {
  studyReminders: boolean;
  roomActivity: boolean;
  weeklySummary: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly THEME_KEY = 'studyroom_theme';
  private readonly PREFS_KEY = 'studyroom_prefs';

  theme = signal<'dark' | 'light'>(this.loadTheme());
  prefs = signal<NotificationPrefs>(this.loadPrefs());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  updatePrefs(partial: Partial<NotificationPrefs>): void {
    this.prefs.update(p => ({ ...p, ...partial }));
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(this.prefs()));
  }

  private loadTheme(): 'dark' | 'light' {
    const stored = localStorage.getItem(this.THEME_KEY) as 'dark' | 'light' | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return 'dark';
  }

  private loadPrefs(): NotificationPrefs {
    const defaults: NotificationPrefs = {
      studyReminders: true,
      roomActivity: true,
      weeklySummary: false
    };
    try {
      const stored = localStorage.getItem(this.PREFS_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  private applyTheme(theme: 'dark' | 'light'): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
