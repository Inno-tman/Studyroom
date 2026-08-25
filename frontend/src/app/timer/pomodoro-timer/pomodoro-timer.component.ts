import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimerService, TimerState } from '../../core/services/timer.service';
import { SignalRService } from '../../core/services/signalr.service';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [NgIf, NgClass, FormsModule],
  template: `
    <div class="timer-card">
      <div class="timer-header">
        <div class="phase" [class.break]="state.isBreak" [class.long]="state.isLongBreak">
          <span class="material-icons">{{ state.isBreak ? (state.isLongBreak ? 'spa' : 'free_breakfast') : 'psychology' }}</span>
          {{ phaseLabel }}
        </div>
        <div class="counter" title="Focus sessions completed">
          <span class="material-icons">local_fire_department</span> {{ state.completedSessions }}
        </div>
      </div>

      <div class="timer-display" [class.break-mode]="state.isBreak">
        {{ formatTime(state.remainingSeconds) }}
      </div>

      <div class="timer-mode">
        <button [class.active]="!state.isBreak" (click)="switchMode('focus')" class="mode-btn">Focus</button>
        <button [class.active]="state.isBreak" (click)="switchMode('break')" class="mode-btn">Break</button>
      </div>

      <div class="timer-controls">
        <button *ngIf="!state.isRunning" class="control-btn primary" (click)="startTimer()" aria-label="Start">
          <span class="material-icons">play_arrow</span>
        </button>
        <button *ngIf="state.isRunning && !state.isPaused" class="control-btn" (click)="pauseTimer()" aria-label="Pause">
          <span class="material-icons">pause</span>
        </button>
        <button *ngIf="state.isRunning && state.isPaused" class="control-btn primary" (click)="resumeTimer()" aria-label="Resume">
          <span class="material-icons">play_arrow</span>
        </button>
        <button *ngIf="state.isRunning" class="control-btn" (click)="skip()" aria-label="Skip phase">
          <span class="material-icons">skip_next</span>
        </button>
        <button class="control-btn" (click)="resetTimer()" aria-label="Reset">
          <span class="material-icons">stop</span>
        </button>
      </div>

      <div class="timer-options" *ngIf="isIdle">
        <label class="dur">Focus
          <input type="number" min="1" max="240" [(ngModel)]="focusMin" (change)="onFocusChange()" />
        </label>
        <label class="dur">Break
          <input type="number" min="1" max="120" [(ngModel)]="breakMin" (change)="onBreakChange()" />
        </label>
        <label class="dur">Long
          <input type="number" min="1" max="120" [(ngModel)]="longBreakMin" (change)="onLongBreakChange()" />
        </label>
      </div>

      <label class="auto-toggle">
        <input type="checkbox" [(ngModel)]="autoStart" (change)="onAutoStartChange()" />
        Auto-start next session
      </label>

      <div class="timer-info" *ngIf="state.sessionCompleted && !state.isRunning">
        {{ state.lastCompleted === 'break' ? 'Break' : 'Session' }} completed! Great work!
      </div>
    </div>
  `,
  styles: [`
    .timer-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: center; }

    .timer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .phase { display: flex; align-items: center; gap: 6px; font-size: var(--font-13); font-weight: 700; color: var(--primary); letter-spacing: 0.3px; }
    .phase.break { color: var(--success); }
    .phase.long { color: var(--accent, var(--primary)); }
    .phase .material-icons { font-size: var(--font-20); }
    .counter { display: flex; align-items: center; gap: 4px; font-size: var(--font-13); font-weight: 700; color: var(--text-secondary); }
    .counter .material-icons { font-size: var(--font-18); color: #f97316; }

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

    .timer-options { display: flex; justify-content: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
    .dur { display: flex; flex-direction: column; font-size: var(--font-11); font-weight: 600; color: var(--text-muted); gap: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .dur input { width: 64px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--background); color: var(--text-primary); font-size: var(--font-14); text-align: center; }
    .dur input:focus { outline: none; border-color: var(--primary); }

    .auto-toggle { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; font-size: var(--font-12); color: var(--text-secondary); cursor: pointer; }
    .auto-toggle input { accent-color: var(--primary); }

    .timer-info { margin-top: 12px; font-size: var(--font-13); font-weight: 600; color: var(--success); }
  `]
})
export class PomodoroTimerComponent implements OnInit, OnDestroy {
  @Input() roomId = '';
  private timerService = inject(TimerService);
  private signalR = inject(SignalRService);
  private settings = inject(SettingsService);
  private notification = inject(NotificationService);
  private statsService = inject(StatisticsService);

  state: TimerState = {
    isRunning: false, isPaused: false, isBreak: false, isLongBreak: false,
    remainingSeconds: 25 * 60, focusDuration: 25, breakDuration: 5,
    longBreakDuration: 15, completedSessions: 0, sessionCompleted: false, lastCompleted: null
  };

  focusMin = 25;
  breakMin = 5;
  longBreakMin = 15;
  autoStart = true;

  private subscriptions: Subscription[] = [];
  private isSynced = false;
  private wasRunning = false;
  private wasBreak = false;
  private wasCompleted = false;

  get phaseLabel(): string {
    if (this.state.isBreak) return this.state.isLongBreak ? 'Long Break' : 'Break';
    return 'Focus';
  }

  get isIdle(): boolean {
    return !this.state.isRunning && !this.state.isPaused;
  }

  async ngOnInit() {
    const study = this.settings.study();
    this.focusMin = study.focusDuration;
    this.breakMin = study.breakDuration;
    this.longBreakMin = study.longBreakDuration;
    this.autoStart = study.autoStartNextSession;

    this.subscriptions.push(
      this.timerService.state$.subscribe(s => {
        const justCompleted = s.sessionCompleted && !this.wasCompleted;
        const wasBreak = this.wasBreak;
        // A focus session begins on idle->focus or break->focus transitions.
        const focusBegan = s.isRunning && !s.isBreak && (this.wasBreak || !this.wasRunning);

        this.state = s;
        this.wasRunning = s.isRunning;
        this.wasBreak = s.isBreak;
        this.wasCompleted = s.sessionCompleted;

        // A break begins on idle->break or focus->break transitions.
        const breakBegan = s.isRunning && s.isBreak && (!this.wasBreak || !this.wasRunning);

        // Each focus session (manual or auto-started) creates a StudySession so
        // study time + streak are counted.
        if (focusBegan) {
          this.isSynced = true;
          this.statsService.startSession(this.roomId, s.focusDuration).subscribe({
            error: err => console.error('[timer] startSession HTTP failed', err)
          });
        }
        // Breaks schedule the server timer for end-of-break notification
        // but do NOT create DB sessions — only focus counts toward study time.
        if (breakBegan) {
          this.statsService.startBreak(this.roomId, s.isLongBreak ? s.longBreakDuration : s.breakDuration, s.isLongBreak).subscribe({
            error: err => console.error('[timer] startBreak HTTP failed', err)
          });
        }
        // Persist completion of a focus session -> updates stats read model.
        // Use HTTP (not fire-and-forget SignalR) so the DB write is reliable
        // even if the SignalR connection is reconnecting or cold-starting.
        if (justCompleted && !wasBreak) {
          this.statsService.completeSession(this.roomId).subscribe({
            next: res => {
              if (res.success) console.log('[timer] session finalized via HTTP, minutes=' + res.durationMinutes);
            },
            error: err => console.error('[timer] completeSession HTTP failed', err)
          });
          this.notification.notify('Focus session complete', 'Nice work! Take a breather.');
        }
        if (justCompleted && wasBreak) {
          this.notification.notify(this.state.isLongBreak ? 'Long break complete' : 'Break complete', 'Time to get back to focus.');
        }
      }),
      this.signalR.timerStarted$.subscribe(async data => {
        if (data.roomId === this.roomId && !this.isSynced) {
          this.isSynced = true;
          this.timerService.start();
        }
      }),
      this.signalR.timerPaused$.subscribe(data => {
        if (data.roomId === this.roomId) {
          this.timerService.pause();
        }
      }),
      this.signalR.timerReset$.subscribe(data => {
        if (data.roomId === this.roomId) {
          this.timerService.reset();
          this.isSynced = false;
        }
      })
    );
  }

  startTimer() {
    this.isSynced = true;
    this.timerService.start();
    // Request notification permission while we're inside a user-gesture
    // context so the browser allows it.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  async pauseTimer() {
    this.timerService.pause();
    this.statsService.pauseSession(this.roomId).subscribe({
      error: err => console.error('[timer] pauseSession HTTP failed', err)
    });
  }

  async resumeTimer() {
    // Pausing finalizes the backend session, so resuming must re-register
    // the remaining time or the rest of the session is never recorded.
    const remainingMin = Math.max(1, Math.ceil(this.state.remainingSeconds / 60));
    this.isSynced = true;
    this.statsService.startSession(this.roomId, remainingMin).subscribe({
      error: err => console.error('[timer] resume startSession HTTP failed', err)
    });
    this.timerService.start();
  }

  async resetTimer() {
    this.timerService.reset();
    this.isSynced = false;
    this.statsService.resetSession(this.roomId).subscribe({
      error: err => console.error('[timer] resetSession HTTP failed', err)
    });
  }

  skip() {
    this.timerService.skip();
  }

  switchMode(mode: 'focus' | 'break') {
    if (mode === 'break') {
      // Switching to a break is allowed at any time (stops a running focus if needed).
      if (!this.state.isBreak) {
        this.isSynced = true;
        this.timerService.startBreak();
      }
    } else {
      // Back to focus: stop any running/paused timer and return to idle focus.
      if (this.state.isBreak || this.state.isRunning) {
        this.isSynced = false;
        this.timerService.reset();
      }
    }
  }

  onFocusChange() {
    const v = this.clamp(this.focusMin, 1, 240);
    this.focusMin = v;
    this.settings.updateStudy({ focusDuration: v });
    this.timerService.setFocusDuration(v);
  }

  onBreakChange() {
    const v = this.clamp(this.breakMin, 1, 120);
    this.breakMin = v;
    this.settings.updateStudy({ breakDuration: v });
    this.timerService.setBreakDuration(v);
  }

  onLongBreakChange() {
    const v = this.clamp(this.longBreakMin, 1, 120);
    this.longBreakMin = v;
    this.settings.updateStudy({ longBreakDuration: v });
    this.timerService.setLongBreakDuration(v);
  }

  onAutoStartChange() {
    this.settings.updateStudy({ autoStartNextSession: this.autoStart });
  }

  private clamp(v: number, min: number, max: number): number {
    const n = Math.floor(Number(v) || min);
    return Math.min(max, Math.max(min, n));
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
