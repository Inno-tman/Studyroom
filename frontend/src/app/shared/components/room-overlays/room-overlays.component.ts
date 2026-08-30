import { Component, inject, OnDestroy } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RoomTabBarService } from '../../../core/services/room-tab-bar.service';

@Component({
  selector: 'app-room-overlays',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink],
  template: `
    <ng-container *ngIf="room">

      <!-- Invite dialog -->
      <div class="invite-dialog-backdrop" *ngIf="room.showInviteDialog" (click)="room.showInviteDialog = false">
        <div class="invite-dialog" (click)="$event.stopPropagation()">
          <div class="invite-dialog-header">
            <h3>Invite friends to {{ room?.room?.name }}</h3>
            <button class="dialog-close" (click)="room.showInviteDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="invite-dialog-body">
            <p class="invite-hint" *ngIf="room.invitableFriends.length === 0">No friends to invite — everyone you know is already here!</p>
            <div *ngFor="let friend of room.invitableFriends" class="invite-row">
              <div class="member-avatar" [class.has-image]="friend.avatarUrl" routerLink="/profile/{{friend.userId}}" style="cursor:pointer">
                <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
                <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="invite-name">{{ friend.displayName || friend.username }}</span>
              <button class="btn-invite" (click)="room.inviteFriend(friend)" [disabled]="friend.userId === room.invitingId">
                {{ friend.userId === room.invitingId ? 'Inviting...' : 'Invite' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Schedule dialog -->
      <div class="schedule-dialog-backdrop" *ngIf="room.showScheduleDialog" (click)="room.showScheduleDialog = false">
        <form class="schedule-dialog" (click)="$event.stopPropagation()" (ngSubmit)="room.scheduleMeeting()">
          <div class="dialog-header">
            <h3>Schedule a meeting</h3>
            <button class="dialog-close" type="button" (click)="room.showScheduleDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="dialog-body">
            <label class="field">Title <input type="text" [(ngModel)]="room.scheduleTitle" name="room-scheduleTitle" placeholder="e.g. Final review" /></label>
            <label class="field">Description <input type="text" [(ngModel)]="room.scheduleDescription" name="room-scheduleDescription" placeholder="Optional" /></label>
            <label class="field">When <input type="datetime-local" [(ngModel)]="room.scheduleAt" name="room-scheduleAt" /></label>
            <label class="field">Duration
              <select [(ngModel)]="room.scheduleDuration" name="room-scheduleDuration">
                <option [ngValue]="15">15 minutes</option>
                <option [ngValue]="30">30 minutes</option>
                <option [ngValue]="45">45 minutes</option>
                <option [ngValue]="60">60 minutes</option>
                <option [ngValue]="90">90 minutes</option>
                <option [ngValue]="120">120 minutes</option>
              </select>
            </label>
            <p class="form-error" *ngIf="room.scheduleError">{{ room.scheduleError }}</p>
            <button class="btn-primary dialog-submit" type="submit" [disabled]="room.scheduling">
              {{ room.scheduling ? 'Scheduling...' : 'Schedule Meeting' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Schedule broadcast dialog -->
      <div class="schedule-dialog-backdrop" *ngIf="room.showBroadcastDialog" (click)="room.showBroadcastDialog = false">
        <form class="schedule-dialog" (click)="$event.stopPropagation()" (ngSubmit)="room.scheduleBroadcast()">
          <div class="dialog-header">
            <h3>Schedule a broadcast</h3>
            <button class="dialog-close" type="button" (click)="room.showBroadcastDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="dialog-body">
            <label class="field">Title <input type="text" [(ngModel)]="room.broadcastTitle" name="room-broadcastTitle" placeholder="e.g. Anatomy review live" /></label>
            <label class="field">Description <input type="text" [(ngModel)]="room.broadcastDescription" name="room-broadcastDescription" placeholder="Optional" /></label>
            <label class="field">When <input type="datetime-local" [(ngModel)]="room.broadcastAt" name="room-broadcastAt" /></label>
            <label class="field">Duration
              <select [(ngModel)]="room.broadcastDuration" name="room-broadcastDuration">
                <option [ngValue]="15">15 minutes</option>
                <option [ngValue]="30">30 minutes</option>
                <option [ngValue]="45">45 minutes</option>
                <option [ngValue]="60">60 minutes</option>
                <option [ngValue]="90">90 minutes</option>
                <option [ngValue]="120">120 minutes</option>
              </select>
            </label>
            <label class="field">YouTube link (optional)
              <input type="text" [(ngModel)]="room.broadcastYouTubeUrl" name="room-broadcastYouTubeUrl" placeholder="https://youtube.com/watch?v=..." />
            </label>
            <p class="dialog-hint">Optionally include the video you plan to play. You'll still start the broadcast yourself at the scheduled time.</p>
            <p class="form-error" *ngIf="room.broadcastError">{{ room.broadcastError }}</p>
            <button class="btn-primary dialog-submit" type="submit" [disabled]="room.schedulingBroadcast">
              {{ room.schedulingBroadcast ? 'Scheduling...' : 'Schedule Broadcast' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Roles dialog -->
      <div class="invite-dialog-backdrop" *ngIf="room.showRolesDialog" (click)="room.showRolesDialog = false">
        <div class="invite-dialog" (click)="$event.stopPropagation()">
          <div class="invite-dialog-header">
            <h3>Manage roles</h3>
            <button class="dialog-close" (click)="room.showRolesDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="invite-dialog-body">
            <p class="invite-hint">Co-hosts can delete any meeting in this room.</p>
            <div *ngFor="let member of room.manageableMembers" class="invite-row">
              <div class="member-avatar" [class.has-image]="member.avatarUrl">
                <img *ngIf="member.avatarUrl; else roleMemberInitial" [src]="member.avatarUrl" alt="" />
                <ng-template #roleMemberInitial>{{ member.username.charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="invite-name">{{ member.username }}</span>
              <span class="role-tag" *ngIf="member.role === 'cohost'" [class.changing]="room.roleChangingId === member.id">co-host</span>
              <button
                class="btn-invite"
                [class.btn-invite-ghost]="member.role === 'cohost'"
                (click)="room.toggleCoHost(member)"
                [disabled]="room.roleChangingId === member.id"
              >{{ room.roleChangingId === member.id ? '...' : (member.role === 'cohost' ? 'Demote' : 'Make co-host') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Live session chooser -->
      <div class="live-chooser-backdrop" *ngIf="room.showLiveChooser" (click)="room.showLiveChooser = false">
        <div class="live-chooser" (click)="$event.stopPropagation()">
          <div class="live-chooser-header">
            <h3>Start a live session</h3>
            <button class="dialog-close" (click)="room.showLiveChooser = false" aria-label="Close"><span class="material-icons">close</span></button>
          </div>
          <div class="live-chooser-body">
            <button class="live-option" type="button" (click)="room.startCallChoice()">
              <span class="live-option-icon lo-call"><span class="material-icons">videocam</span></span>
              <span class="live-option-text">
                <span class="live-option-title">Start a call</span>
                <span class="live-option-sub">Video call with the room right now</span>
              </span>
              <span class="material-icons live-option-chev">chevron_right</span>
            </button>
            <button *ngIf="room.isHost" class="live-option" type="button" (click)="room.broadcastChoice()">
              <span class="live-option-icon lo-broadcast"><span class="material-icons">smart_display</span></span>
              <span class="live-option-text">
                <span class="live-option-title">Broadcast a video</span>
                <span class="live-option-sub">Play a synced YouTube video for the room</span>
              </span>
              <span class="material-icons live-option-chev">chevron_right</span>
            </button>
            <button class="live-option" type="button" (click)="room.scheduleChoice()">
              <span class="live-option-icon lo-schedule"><span class="material-icons">event</span></span>
              <span class="live-option-text">
                <span class="live-option-title">Schedule a meeting</span>
                <span class="live-option-sub">Plan a meeting for later</span>
              </span>
              <span class="material-icons live-option-chev">chevron_right</span>
            </button>
            <button class="live-option" type="button" (click)="room.scheduleBroadcastChoice()">
              <span class="live-option-icon lo-schedule-bc"><span class="material-icons">smart_display</span></span>
              <span class="live-option-text">
                <span class="live-option-title">Schedule a broadcast</span>
                <span class="live-option-sub">Plan a video broadcast for later</span>
              </span>
              <span class="material-icons live-option-chev">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Share video dialog -->
      <div class="dialog-backdrop" *ngIf="room.showVideoDialog" (click)="room.showVideoDialog = false">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>Broadcast a YouTube video</h3>
            <button class="dialog-close" (click)="room.showVideoDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="dialog-body">
            <label class="field">YouTube link
              <input type="text" [(ngModel)]="room.videoInput" name="room-videoInput" placeholder="https://youtube.com/watch?v=..." (keyup.enter)="room.startBroadcast()" />
            </label>
            <p class="dialog-hint">Paste any YouTube watch, share, or shorten link — it plays in sync for everyone in the room.</p>
            <button class="btn-primary dialog-submit" (click)="room.startBroadcast()" [disabled]="!room.videoInput.trim()">
              Start Broadcast
            </button>
          </div>
        </div>
      </div>

    </ng-container>
  `,
  styles: [`
    .invite-dialog-backdrop, .schedule-dialog-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1300;
    }
    .invite-dialog, .schedule-dialog {
      width: 440px; max-width: 92vw; max-height: 85vh; background: var(--surface);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .invite-dialog-header, .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; border-bottom: 1px solid var(--border);
    }
    .invite-dialog-header h3, .dialog-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .dialog-close:hover { color: var(--text-primary); }
    .invite-dialog-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .invite-hint { font-size: var(--font-13); color: var(--text-muted); }
    .invite-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; }
    .invite-row:hover { background: var(--background); }
    .invite-name { flex: 1; font-size: var(--font-13); font-weight: 500; color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-invite { padding: 6px 12px; background: var(--primary); border: none; border-radius: 8px; color: white; font-size: var(--font-12); font-weight: 600; cursor: pointer; flex-shrink: 0; }
    .btn-invite:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-invite:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-invite-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
    .btn-invite-ghost:hover:not(:disabled) { border-color: var(--error); color: var(--error); background: transparent; }
    .role-tag { font-size: var(--font-11); font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.4px; }
    .dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
    .dialog-hint { font-size: var(--font-12); color: var(--text-muted); margin: 0; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); }
    .field input, .field select { padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; min-height: 44px; }
    .field input:focus, .field select:focus { border-color: var(--primary); }
    .form-error { color: var(--error); font-size: var(--font-13); margin: 0; }
    .dialog-submit { width: 100%; padding: 14px; justify-content: center; min-height: 48px; flex-shrink: 0; }

    .live-chooser-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1300;
    }
    .live-chooser {
      width: 420px; max-width: 92vw; background: var(--surface);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .live-chooser-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; border-bottom: 1px solid var(--border);
    }
    .live-chooser-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); margin: 0; }
    .live-chooser-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .live-option {
      display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 12px; border: 1px solid var(--border); border-radius: 12px;
      background: var(--background); color: var(--text-primary); cursor: pointer; text-align: left;
      transition: all 0.15s; -webkit-tap-highlight-color: transparent;
    }
    .live-option:hover { border-color: var(--primary); transform: translateY(-1px); }
    .live-option-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; color: #fff;
    }
    .live-option-icon .material-icons { font-size: var(--font-22); }
    .live-option-icon.lo-call { background: var(--success); }
    .live-option-icon.lo-broadcast { background: var(--primary); }
    .live-option-icon.lo-schedule { background: var(--accent); }
    .live-option-icon.lo-schedule-bc { background: #ec4899; }
    .live-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .live-option-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .live-option-sub { font-size: var(--font-12); color: var(--text-muted); }
    .live-option-chev { font-size: var(--font-20); color: var(--text-muted); }

    .invite-dialog-backdrop, .schedule-dialog-backdrop, .live-chooser-backdrop, .dialog-backdrop {
      animation: backdropIn 0.18s ease;
    }
    .invite-dialog, .schedule-dialog, .live-chooser, .dialog {
      animation: dialogIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialogIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

    @media (max-width: 900px) {
      .live-option { padding: 14px 12px; }
      .live-option-icon { width: 44px; height: 44px; }
    }

    @media (max-width: 900px) {
      .invite-dialog, .schedule-dialog, .live-chooser { width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; max-height: 88vh; max-height: 88dvh; padding-bottom: env(safe-area-inset-bottom); }
      .invite-dialog-backdrop, .schedule-dialog-backdrop, .live-chooser-backdrop { align-items: flex-end; }
      .dialog-backdrop { align-items: center; padding: 20px; }
      .dialog { width: 100%; max-width: 420px; max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); }
    }
  `]
})
export class RoomOverlaysComponent implements OnDestroy {
  private service = inject(RoomTabBarService);
  private sub?: Subscription;
  room: any = null;

  constructor() {
    this.sub = this.service.activeRoom$.subscribe((r: any) => {
      this.room = r;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
