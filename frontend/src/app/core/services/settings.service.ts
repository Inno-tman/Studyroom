import { Injectable, signal } from '@angular/core';

export interface AppearancePrefs {
  theme: 'dark' | 'light';
  accentColor: string;
  compactMode: boolean;
  reduceMotion: boolean;
  fontScale: 'small' | 'medium' | 'large';
  fontStyle: 'inter' | 'serif' | 'mono';
}

export interface NotificationPrefs {
  studyReminders: boolean;
  roomActivity: boolean;
  weeklySummary: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
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
  { name: 'Emerald', color: '#10B981', hover: '#059669' },
  { name: 'Violet', color: '#8B5CF6', hover: '#7c3aed' },
  { name: 'Rose', color: '#F43F5E', hover: '#e11d48' },
  { name: 'Amber', color: '#F59E0B', hover: '#d97706' },
  { name: 'Teal', color: '#14B8A6', hover: '#0d9488' }
];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly THEME_KEY = 'studyroom_theme';
  private readonly APPEARANCE_KEY = 'studyroom_appearance';
  private readonly PREFS_KEY = 'studyroom_prefs';
  private readonly STUDY_KEY = 'studyroom_study';

  theme = signal<'dark' | 'light'>(this.loadTheme());
  appearance = signal<Omit<AppearancePrefs, 'theme'>>(this.loadAppearance());
  prefs = signal<NotificationPrefs>(this.loadPrefs());
  study = signal<StudyPrefs>(this.loadStudy());

  constructor() {
    this.applyTheme(this.theme());
    this.applyAppearance(this.appearance());
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
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

  private loadTheme(): 'dark' | 'light' {
    const stored = localStorage.getItem(this.THEME_KEY) as 'dark' | 'light' | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return 'dark';
  }

  private loadAppearance(): Omit<AppearancePrefs, 'theme'> {
    const defaults: Omit<AppearancePrefs, 'theme'> = {
      accentColor: ACCENT_COLORS[0].color,
      compactMode: false,
      reduceMotion: false,
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
      desktopNotifications: false,
      notificationSound: true,
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

  private applyTheme(theme: 'dark' | 'light'): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private applyAppearance(appearance: Omit<AppearancePrefs, 'theme'>): void {
    const el = document.documentElement;

    const accent = ACCENT_COLORS.find(a => a.color === appearance.accentColor);
    el.style.setProperty('--primary', appearance.accentColor);
    el.style.setProperty('--primary-hover', accent?.hover ?? appearance.accentColor);
    el.style.setProperty('--accent', appearance.accentColor);

    el.classList.toggle('compact-mode', appearance.compactMode);
    el.classList.toggle('reduce-motion', appearance.reduceMotion);
    el.setAttribute('data-font-scale', appearance.fontScale);
    el.setAttribute('data-font-style', appearance.fontStyle);
  }
}
