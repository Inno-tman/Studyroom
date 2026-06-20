import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  remainingSeconds: number;
  focusDuration: number;
  breakDuration: number;
  sessionCompleted: boolean;
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private timerState = new BehaviorSubject<TimerState>({
    isRunning: false,
    isPaused: false,
    isBreak: false,
    remainingSeconds: 25 * 60,
    focusDuration: 25,
    breakDuration: 5,
    sessionCompleted: false
  });

  state$ = this.timerState.asObservable();
  private subscription?: Subscription;

  start(): void {
    const state = this.timerState.value;
    if (state.isRunning && !state.isPaused) return;

    if (state.isPaused) {
      this.timerState.next({ ...state, isPaused: false });
    } else {
      const duration = state.isBreak ? state.breakDuration : state.focusDuration;
      this.timerState.next({ ...state, isRunning: true, isPaused: false, remainingSeconds: duration * 60, sessionCompleted: false });
    }

    this.startCountdown();
  }

  pause(): void {
    this.subscription?.unsubscribe();
    this.timerState.next({ ...this.timerState.value, isPaused: true });
  }

  reset(): void {
    this.subscription?.unsubscribe();
    const state = this.timerState.value;
    this.timerState.next({
      ...state,
      isRunning: false,
      isPaused: false,
      isBreak: false,
      remainingSeconds: state.focusDuration * 60,
      sessionCompleted: false
    });
  }

  setFocusDuration(minutes: number): void {
    const state = this.timerState.value;
    if (!state.isRunning) {
      this.timerState.next({ ...state, focusDuration: minutes, remainingSeconds: minutes * 60 });
    }
  }

  setBreakDuration(minutes: number): void {
    this.timerState.next({ ...this.timerState.value, breakDuration: minutes });
  }

  private startCountdown(): void {
    this.subscription?.unsubscribe();
    this.subscription = interval(1000).subscribe(() => {
      const state = this.timerState.value;
      if (state.remainingSeconds <= 1) {
        this.subscription?.unsubscribe();
        if (!state.isBreak) {
          this.timerState.next({ ...state, remainingSeconds: 0, isBreak: true, sessionCompleted: true });
          this.start();
        } else {
          this.timerState.next({ ...state, remainingSeconds: 0, isBreak: false, isRunning: false, sessionCompleted: true });
        }
      } else {
        this.timerState.next({ ...state, remainingSeconds: state.remainingSeconds - 1 });
      }
    });
  }
}
