import { Injectable, signal } from '@angular/core';

export interface AppearancePrefs {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  compactMode: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  cornerStyle: 'sharp' | 'rounded' | 'soft';
  fontScale: 'small' | 'medium' | 'large' | 'xlarge';
  fontStyle: 'inter' | 'serif' | 'mono';
}

export interface NotificationPrefs {
  studyReminders: boolean;
  roomActivity: boolean;
  weeklySummary: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
  soundType: 'chime' | 'bell' | 'soft' | 'none';
  soundVolume: number;
  showMessagePreviews: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  directMessages: boolean;
  friendRequests: boolean;
  roomInvites: boolean;
  pomodoroComplete: boolean;
  postComments: boolean;
}

export interface StudyPrefs {
  focusDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  dailyStudyGoalMinutes: number;
  autoStartNextSession: boolean;
}

export const ACCENT_COLORS: { name: string; color: string; hover: string }[] = [
  { name: 'Blue', color: '#2563EB', hover: '#1d4ed8' },
  { name: 'Indigo', color: '#6366F1', hover: '#4f46e5' },
  { name: 'Violet', color: '#8B5CF6', hover: '#7c3aed' },
  { name: 'Fuchsia', color: '#D946EF', hover: '#c026d3' },
  { name: 'Pink', color: '#EC4899', hover: '#db2777' },
  { name: 'Rose', color: '#F43F5E', hover: '#e11d48' },
  { name: 'Red', color: '#EF4444', hover: '#dc2626' },
  { name: 'Orange', color: '#F97316', hover: '#ea580c' },
  { name: 'Amber', color: '#F59E0B', hover: '#d97706' },
  { name: 'Lime', color: '#84CC16', hover: '#65a30d' },
  { name: 'Green', color: '#22C55E', hover: '#16a34a' },
  { name: 'Emerald', color: '#10B981', hover: '#059669' },
  { name: 'Teal', color: '#14B8A6', hover: '#0d9488' },
  { name: 'Cyan', color: '#06B6D4', hover: '#0891b2' },
  { name: 'Sky', color: '#0EA5E9', hover: '#0284c7' },
  { name: 'Slate', color: '#64748B', hover: '#475569' }
];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly THEME_KEY = 'studyroom_theme';
  private readonly APPEARANCE_KEY = 'studyroom_appearance';
  private readonly PREFS_KEY = 'studyroom_prefs';
  private readonly STUDY_KEY = 'studyroom_study';

  theme = signal<'dark' | 'light' | 'system'>(this.loadTheme());
  appearance = signal<Omit<AppearancePrefs, 'theme'>>(this.loadAppearance());
  prefs = signal<NotificationPrefs>(this.loadPrefs());
  study = signal<StudyPrefs>(this.loadStudy());

  private readonly systemLight = window.matchMedia('(prefers-color-scheme: light)');

  constructor() {
    this.applyTheme(this.theme());
    this.applyAppearance(this.appearance());
    this.systemLight.addEventListener('change', () => {
      if (this.theme() === 'system') this.applyTheme('system');
    });
  }

  setTheme(theme: 'dark' | 'light' | 'system'): void {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    const current = this.resolvedTheme;
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  get resolvedTheme(): 'dark' | 'light' {
    const theme = this.theme();
    return theme === 'system'
      ? (this.systemLight.matches ? 'light' : 'dark')
      : theme;
  }

  updateAppearance(partial: Partial<Omit<AppearancePrefs, 'theme'>>): void {
    const next = { ...this.appearance(), ...partial };
    this.appearance.set(next);
    localStorage.setItem(this.APPEARANCE_KEY, JSON.stringify(next));
    this.applyAppearance(next);
  }

  updatePrefs(partial: Partial<NotificationPrefs>): void {
    const next = { ...this.prefs(), ...partial };
    this.prefs.set(next);
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(next));
  }

  updateStudy(partial: Partial<StudyPrefs>): void {
    const next = { ...this.study(), ...partial };
    this.study.set(next);
    localStorage.setItem(this.STUDY_KEY, JSON.stringify(next));
  }

  isQuietHour(): boolean {
    const p = this.prefs();
    if (!p.quietHoursEnabled) return false;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = p.quietHoursStart.split(':').map(Number);
    const [eh, em] = p.quietHoursEnd.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  }

  private loadTheme(): 'dark' | 'light' | 'system' {
    const stored = localStorage.getItem(this.THEME_KEY) as 'dark' | 'light' | 'system' | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return 'dark';
  }

  private loadAppearance(): Omit<AppearancePrefs, 'theme'> {
    const defaults: Omit<AppearancePrefs, 'theme'> = {
      accentColor: ACCENT_COLORS[0].color,
      compactMode: false,
      reduceMotion: false,
      highContrast: false,
      cornerStyle: 'rounded',
      fontScale: 'medium',
      fontStyle: 'inter'
    };
    try {
      const stored = localStorage.getItem(this.APPEARANCE_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  private loadPrefs(): NotificationPrefs {
    const defaults: NotificationPrefs = {
      studyReminders: true,
      roomActivity: true,
      weeklySummary: false,
      desktopNotifications: true,
      notificationSound: true,
      soundType: 'chime',
      soundVolume: 0.8,
      showMessagePreviews: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      directMessages: true,
      friendRequests: true,
      roomInvites: true,
      pomodoroComplete: true,
      postComments: true
    };
    try {
      const stored = localStorage.getItem(this.PREFS_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  private loadStudy(): StudyPrefs {
    const defaults: StudyPrefs = {
      focusDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      dailyStudyGoalMinutes: 120,
      autoStartNextSession: true
    };
    try {
      const stored = localStorage.getItem(this.STUDY_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  private applyTheme(theme: 'dark' | 'light' | 'system'): void {
    const resolved = theme === 'system'
      ? (this.systemLight.matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  private applyAppearance(appearance: Omit<AppearancePrefs, 'theme'>): void {
    const el = document.documentElement;

    const accent = ACCENT_COLORS.find(a => a.color === appearance.accentColor);
    el.style.setProperty('--primary', appearance.accentColor);
    el.style.setProperty('--primary-hover', accent?.hover ?? appearance.accentColor);
    el.style.setProperty('--accent', appearance.accentColor);

    el.classList.toggle('compact-mode', appearance.compactMode);
    el.classList.toggle('reduce-motion', appearance.reduceMotion);
    el.classList.toggle('high-contrast', appearance.highContrast);
    el.setAttribute('data-font-scale', appearance.fontScale);
    el.setAttribute('data-font-style', appearance.fontStyle);
    el.setAttribute('data-corner', appearance.cornerStyle);
  }
}
