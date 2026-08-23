import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { SettingsService } from './settings.service';

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  isLongBreak: boolean;
  remainingSeconds: number;
  focusDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  completedSessions: number;
  sessionCompleted: boolean;
  lastCompleted: 'focus' | 'break' | null;
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private timerState = new BehaviorSubject<TimerState>({
    isRunning: false,
    isPaused: false,
    isBreak: false,
    isLongBreak: false,
    remainingSeconds: 25 * 60,
    focusDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    completedSessions: 0,
    sessionCompleted: false,
    lastCompleted: null
  });

  constructor(private settings: SettingsService) {
    this.syncFromSettings();
  }

  state$ = this.timerState.asObservable();
  private subscription?: Subscription;

  private patch(partial: Partial<TimerState>): void {
    this.timerState.next({ ...this.timerState.value, ...partial });
  }

  /** Pull durations + auto-start from settings (idle timer only). */
  syncFromSettings(): void {
    const s = this.settings.study();
    this.patch({
      focusDuration: s.focusDuration,
      breakDuration: s.breakDuration,
      longBreakDuration: s.longBreakDuration
    });
  }

  private breakSeconds(state: TimerState): number {
    return (state.isLongBreak ? state.longBreakDuration : state.breakDuration) * 60;
  }

  /** Resume if paused, otherwise start the current phase. */
  start(): void {
    const state = this.timerState.value;
    if (state.isRunning && !state.isPaused) return;

    if (state.isPaused) {
      this.patch({ isPaused: false });
    } else {
      const seconds = state.isBreak ? this.breakSeconds(state) : state.focusDuration * 60;
      this.patch({ isRunning: true, isPaused: false, remainingSeconds: seconds, sessionCompleted: false, lastCompleted: null });
    }
    this.startCountdown();
  }

  startFocus(): void {
    const state = this.timerState.value;
    this.patch({
      isBreak: false,
      isLongBreak: false,
      isRunning: true,
      isPaused: false,
      remainingSeconds: state.focusDuration * 60,
      sessionCompleted: false,
      lastCompleted: null
    });
    this.startCountdown();
  }

  startBreak(): void {
    const state = this.timerState.value;
    this.patch({
      isBreak: true,
      isRunning: true,
      isPaused: false,
      remainingSeconds: this.breakSeconds(state),
      sessionCompleted: false,
      lastCompleted: null
    });
    this.startCountdown();
  }

  pause(): void {
    this.subscription?.unsubscribe();
    this.patch({ isPaused: true });
  }

  reset(): void {
    this.subscription?.unsubscribe();
    const state = this.timerState.value;
    this.patch({
      isRunning: false,
      isPaused: false,
      isBreak: false,
      isLongBreak: false,
      remainingSeconds: state.focusDuration * 60,
      sessionCompleted: false,
      lastCompleted: null
    });
  }

  /** Jump to the next phase without counting the current one. */
  skip(): void {
    const state = this.timerState.value;
    if (!state.isRunning && !state.isPaused) return;
    if (state.isBreak) this.startFocus();
    else this.startBreak();
  }

  setFocusDuration(minutes: number): void {
    const state = this.timerState.value;
    if (!state.isRunning) {
      this.patch({
        focusDuration: minutes,
        remainingSeconds: state.isBreak ? state.remainingSeconds : minutes * 60
      });
    } else {
      this.patch({ focusDuration: minutes });
    }
  }

  setBreakDuration(minutes: number): void {
    const state = this.timerState.value;
    if (!state.isRunning) {
      this.patch({
        breakDuration: minutes,
        remainingSeconds: state.isBreak && !state.isLongBreak ? minutes * 60 : state.remainingSeconds
      });
    } else {
      this.patch({ breakDuration: minutes });
    }
  }

  setLongBreakDuration(minutes: number): void {
    const state = this.timerState.value;
    if (!state.isRunning) {
      this.patch({
        longBreakDuration: minutes,
        remainingSeconds: state.isBreak && state.isLongBreak ? minutes * 60 : state.remainingSeconds
      });
    } else {
      this.patch({ longBreakDuration: minutes });
    }
  }

  private startCountdown(): void {
    this.subscription?.unsubscribe();
    this.subscription = interval(1000).subscribe(() => {
      const state = this.timerState.value;
      if (state.remainingSeconds <= 1) {
        this.subscription?.unsubscribe();
        if (!state.isBreak) {
          // A focus session finished -> maybe a long break is now due.
          const completed = state.completedSessions + 1;
          const dueLong = completed % this.settings.study().longBreakInterval === 0;
          const nextBreakSeconds = (dueLong ? state.longBreakDuration : state.breakDuration) * 60;
          this.patch({
            remainingSeconds: nextBreakSeconds,
            isBreak: true,
            isLongBreak: dueLong,
            isRunning: false,
            sessionCompleted: true,
            completedSessions: completed,
            lastCompleted: 'focus'
          });
          if (this.settings.study().autoStartNextSession) this.startBreak();
        } else {
          this.patch({
            remainingSeconds: state.focusDuration * 60,
            isBreak: false,
            isLongBreak: false,
            isRunning: false,
            sessionCompleted: true,
            lastCompleted: 'break'
          });
          if (this.settings.study().autoStartNextSession) this.startFocus();
        }
      } else {
        this.patch({ remainingSeconds: state.remainingSeconds - 1 });
      }
    });
  }
}
