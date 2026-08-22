import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { TimerService, TimerState } from '../../core/services/timer.service';
import { SignalRService } from '../../core/services/signalr.service';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [NgIf, NgClass],
  template: `
    <div class="timer-card">
      <div class="timer-mode">
        <button
          [class.active]="!state.isBreak"
          (click)="switchMode('focus')"
          class="mode-btn"
        >Focus</button>
        <button
          [class.active]="state.isBreak"
          (click)="switchMode('break')"
          class="mode-btn"
        >Break</button>
      </div>

      <div class="timer-display" [class.break-mode]="state.isBreak">
        {{ formatTime(state.remainingSeconds) }}
      </div>

      <div class="timer-controls">
        <button *ngIf="!state.isRunning" class="control-btn primary" (click)="startTimer()">
          <span class="material-icons">play_arrow</span>
        </button>
        <button *ngIf="state.isRunning && !state.isPaused" class="control-btn" (click)="pauseTimer()">
          <span class="material-icons">pause</span>
        </button>
        <button *ngIf="state.isRunning && state.isPaused" class="control-btn primary" (click)="resumeTimer()">
          <span class="material-icons">play_arrow</span>
        </button>
        <button class="control-btn" (click)="resetTimer()">
          <span class="material-icons">stop</span>
        </button>
      </div>

      <div class="timer-info" *ngIf="state.sessionCompleted && !state.isRunning">
        Session completed! Great work!
      </div>
    </div>
  `,
  styles: [`
    .timer-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: center; }

    .timer-mode { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }

    .mode-btn { padding: 6px 16px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: var(--font-13); font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .mode-btn.active { background: var(--primary); border-color: var(--primary); color: white; }
    .mode-btn:hover:not(.active) { border-color: var(--text-muted); }

    .timer-display { font-size: var(--font-64); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--primary); margin-bottom: 16px; letter-spacing: 4px; transition: color 0.3s; }
    .timer-display.break-mode { color: var(--success); }

    .timer-controls { display: flex; justify-content: center; gap: 12px; }

    .control-btn { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--border); background: var(--background); color: var(--text-primary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
    .control-btn:hover { border-color: var(--primary); }
    .control-btn.primary { background: var(--primary); border-color: var(--primary); color: white; }
    .control-btn.primary:hover { background: var(--primary-hover); }
    .control-btn .material-icons { font-size: var(--font-24); }

    .timer-info { margin-top: 12px; font-size: var(--font-13); font-weight: 600; color: var(--success); }
  `]
})
export class PomodoroTimerComponent implements OnInit, OnDestroy {
  @Input() roomId = '';
  private timerService = inject(TimerService);
  private signalR = inject(SignalRService);
  private settings = inject(SettingsService);
  private notificationService = inject(NotificationService);

  state: TimerState = {
    isRunning: false, isPaused: false, isBreak: false,
    remainingSeconds: 25 * 60, focusDuration: 25, breakDuration: 5,
    sessionCompleted: false
  };

  private subscriptions: Subscription[] = [];
  private isSynced = false;
  private wasCompleted = false;
  private wasBreak = false;

  async ngOnInit() {
    const study = this.settings.study();
    this.timerService.setFocusDuration(study.focusDuration);
    this.timerService.setBreakDuration(study.breakDuration);

    this.subscriptions.push(
      this.timerService.state$.subscribe(s => {
        const justCompleted = s.sessionCompleted && !this.wasCompleted;
        const wasBreak = this.wasBreak;
        this.state = s;
        this.wasCompleted = s.sessionCompleted;
        this.wasBreak = s.isBreak;
        if (justCompleted && this.settings.prefs().pomodoroComplete) {
          this.notificationService.playSound();
        }
        // Persist a completed focus session so stats/streak stay accurate.
        // Break completion is intentionally ignored (it doesn't create a study session).
        if (justCompleted && !wasBreak) {
          this.signalR.timerCompleted(this.roomId).catch(() => {});
        }
      })
    );

    this.subscriptions.push(
      this.signalR.timerStarted$.subscribe(async data => {
        if (data.roomId === this.roomId && !this.isSynced) {
          this.isSynced = true;
          this.timerService.setFocusDuration(data.durationMinutes);
          this.timerService.start();
        }
      })
    );

    this.subscriptions.push(
      this.signalR.timerPaused$.subscribe(data => {
        if (data.roomId === this.roomId) {
          this.timerService.pause();
        }
      })
    );

    this.subscriptions.push(
      this.signalR.timerReset$.subscribe(data => {
        if (data.roomId === this.roomId) {
          this.timerService.reset();
          this.isSynced = false;
        }
      })
    );
  }

  async startTimer() {
    this.isSynced = true;
    this.timerService.start();
    await this.signalR.startTimer(this.roomId, this.state.focusDuration);
  }

  async pauseTimer() {
    this.timerService.pause();
    await this.signalR.pauseTimer(this.roomId);
  }

  async resumeTimer() {
    this.timerService.start();
  }

  async resetTimer() {
    this.timerService.reset();
    this.isSynced = false;
    await this.signalR.resetTimer(this.roomId);
  }

  switchMode(mode: 'focus' | 'break') {
    if (this.state.isRunning) return;
    if (mode === 'break') {
      this.isSynced = true;
      this.timerService.startBreak();
    }
    if (this.state.isBreak && mode === 'focus') {
      this.timerService.reset();
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
