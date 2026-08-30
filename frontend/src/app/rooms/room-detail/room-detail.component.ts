import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass, NgTemplateOutlet, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RoomService } from '../../core/services/room.service';
import { MeetingService } from '../../core/services/meeting.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { NotesService } from '../../core/services/notes.service';
import { StatisticsService, LeaderboardEntry, RoomCollectiveStats, UnverifiedSession } from '../../core/services/statistics.service';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';
import { FriendService } from '../../core/services/friend.service';
import { YouTubeBroadcastService } from '../../core/services/youtube-broadcast.service';
import { RoomTabBarService } from '../../core/services/room-tab-bar.service';
import { Room } from '../../shared/models/room.model';
import { Meeting } from '../../shared/models/meeting.model';
import { Message } from '../../shared/models/message.model';
import { UserDto } from '../../shared/models/room.model';
import { Friend } from '../../shared/models/social.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { NotesEditorComponent } from '../../notes/notes-editor/notes-editor.component';
import { PomodoroTimerComponent } from '../../timer/pomodoro-timer/pomodoro-timer.component';
import { AiChatPanelComponent } from '../../ai/ai-chat-panel/ai-chat-panel.component';
import { MeetingRoomComponent } from '../../meeting/meeting-room/meeting-room.component';
import { RoomTasksPanelComponent, TaskMember } from '../room-tasks/room-tasks-panel.component';

interface RoomTab { id: string; label: string; icon: string; }

const TABS: RoomTab[] = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'focus', label: 'Focus', icon: 'timer' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'tasks', label: 'Tasks', icon: 'checklist' },
  { id: 'meet', label: 'Meet', icon: 'videocam' },
  { id: 'stats', label: 'Stats', icon: 'bar_chart' }
];

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, NgTemplateOutlet, DatePipe, FormsModule, RouterLink, LoadingComponent, NotesEditorComponent, PomodoroTimerComponent, AiChatPanelComponent, MeetingRoomComponent, RoomTasksPanelComponent],
  template: `
    <div class="room-detail" [style.background-image]="room?.backgroundUrl ? 'url(' + room?.backgroundUrl + ')' : 'none'">
      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="room-header" [class.has-bg]="room?.backgroundUrl">
        <div class="room-info">
          <a routerLink="/rooms" class="back-link">
            <span class="material-icons">arrow_back</span>
            <span class="back-label">Rooms</span>
          </a>
          <h1>{{ room?.name }}</h1>
          <div class="room-badges">
            <span class="subject-badge">{{ room?.subject || 'General' }}</span>
            <span class="members-badge">{{ room?.memberCount }} members</span>
            <span class="focus-badge" *ngIf="focusCount > 0">
              <span class="material-icons">local_fire_department</span>
              {{ focusCount }} focusing
            </span>
            <span *ngIf="room?.isPrivate" class="private-badge">Private</span>
          </div>
          <p class="room-description" *ngIf="room?.description">{{ room?.description }}</p>
        </div>
        <div class="room-actions" *ngIf="!isMobile">
          <button *ngIf="!isMember" class="btn-primary" (click)="joinRoom()" [disabled]="joining">
            {{ joining ? 'Joining...' : 'Join Room' }}
          </button>
          <button *ngIf="isMember && inCall" class="btn-call-dismiss" (click)="toggleCall()">
            <span class="material-icons">call_end</span>
            <span class="end-call-label-desk">End Call</span>
          </button>
          <button *ngIf="isMember && !inCall" class="btn-primary studio-btn" (click)="showLiveChooser = true">
            <span class="material-icons">rocket_launch</span>
            Start live session
          </button>
          <button *ngIf="isMember" class="btn-outline share-btn" (click)="copyRoomLink()" title="Copy invite link">
            <span class="material-icons">link</span>
            Invite link
          </button>
          <label *ngIf="isMember && isHost" class="btn-outline bg-upload-btn" title="Change room background">
            <span class="material-icons">image</span>
            <input type="file" accept="image/*" (change)="onBackgroundUpload($event)" hidden />
          </label>
          <button *ngIf="isMember" class="btn-outline-danger" (click)="leaveRoom()">Leave</button>
        </div>
      </div>

      <div class="room-content" *ngIf="isMember">
        <!-- ── Mobile quick actions ─────────────────────────── -->
        <div class="mobile-quick" *ngIf="isMobile">
          <button class="quick-studio" type="button" (click)="showLiveChooser = true" aria-label="Start a live session">
            <span class="material-icons">rocket_launch</span>
            <span class="quick-studio-text">
              <span class="quick-studio-title">Start live session</span>
              <span class="quick-studio-sub">Call, broadcast, or schedule a meeting</span>
            </span>
            <span class="material-icons quick-studio-chev">chevron_right</span>
          </button>
          <button class="quick-icon" type="button" (click)="copyRoomLink()" title="Copy invite link">
            <span class="material-icons">link</span>
          </button>
        </div>
        <!-- ── Members ───────────────────────────────────────── -->
        <div class="members-bar">
          <span class="members-title" *ngIf="!isMobile">Members ({{ members.length }})</span>
          <div class="members-avatars" [class.scrollable]="isMobile">
            <div *ngFor="let member of members" class="member-chip" [title]="member.username + (member.role === 'cohost' ? ' (co-host)' : '')">
              <div class="member-avatar" [class.has-image]="member.avatarUrl">
                <img *ngIf="member.avatarUrl; else memberInitial" [src]="member.avatarUrl" alt="" />
                <ng-template #memberInitial>{{ member.username.charAt(0).toUpperCase() }}</ng-template>
                <span class="role-dot" *ngIf="member.role === 'host'" title="Host"><span class="material-icons">star</span></span>
                <span class="role-dot cohost" *ngIf="member.role === 'cohost'" title="Co-host"><span class="material-icons">shield</span></span>
              </div>
              <span class="member-name" *ngIf="!isMobile">{{ member.username }}</span>
            </div>
            <button class="invite-chip" (click)="openInviteDialog()">
              <span class="material-icons">person_add</span>
              <span class="invite-chip-label">{{ isMobile ? 'Invite' : '' }}</span>
            </button>
            <button class="invite-chip" *ngIf="isHost" (click)="showRolesDialog = true" title="Manage roles">
              <span class="material-icons">shield</span>
              <span class="invite-chip-label">{{ isMobile ? 'Roles' : '' }}</span>
            </button>
          </div>
        </div>

        <!-- ── Weekly leaderboard + collective progress ─────── -->
        <div class="leaderboard-section" *ngIf="isMember && leaderboard.length > 0">
          <div class="leaderboard-header">
            <span class="material-icons">emoji_events</span>
            <span class="leaderboard-title">Weekly Leaderboard</span>
            <span class="leaderboard-sub">Last 7 days · verified minutes</span>
          </div>

          <div class="collective-progress" *ngIf="collectiveStats">
            <div class="collective-label">
              <span>Group Focus</span>
              <span class="collective-amount">{{ formatDuration(collectiveStats.totalMinutes) }} / {{ formatDuration(collectiveStats.goalMinutes) }} goal</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="collectiveStats.progress"></div>
            </div>
            <div class="collective-meta">
              {{ collectiveStats.totalSessions }} sessions this week · {{ collectiveStats.memberCount }} members
            </div>
          </div>

          <div class="leaderboard-list">
            <div class="leaderboard-row" *ngFor="let entry of leaderboard; let i = index">
              <span class="lb-rank" [class]="'rank-' + entry.rank">
                <ng-container *ngIf="entry.rank === 1">🥇</ng-container>
                <ng-container *ngIf="entry.rank === 2">🥈</ng-container>
                <ng-container *ngIf="entry.rank === 3">🥉</ng-container>
                <ng-container *ngIf="entry.rank > 3">{{ entry.rank }}</ng-container>
              </span>
              <div class="lb-avatar" [class.has-image]="entry.avatarUrl">
                <img *ngIf="entry.avatarUrl; else lbInitial" [src]="entry.avatarUrl" alt="" />
                <ng-template #lbInitial>{{ entry.username.charAt(0).toUpperCase() }}</ng-template>
              </div>
              <div class="lb-info">
                <span class="lb-name">{{ entry.username }}</span>
                <span class="lb-sessions">{{ entry.sessions }} sessions</span>
              </div>
              <div class="lb-stats">
                <span class="lb-minutes">{{ formatDuration(entry.verifiedMinutes) }}</span>
                <span class="lb-streak" *ngIf="entry.streak > 1">
                  <span class="material-icons">local_fire_department</span>{{ entry.streak }}d
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── YouTube broadcast (persistent while live) ─────── -->
        <div class="broadcast-bar" *ngIf="isBroadcasting">
          <div class="broadcast-header">
            <span class="material-icons broadcast-icon">smart_display</span>
            <span class="broadcast-title">Now watching</span>
            <span class="live-badge">LIVE</span>
            <span class="broadcast-by" *ngIf="broadcastStartedBy">· {{ broadcastStartedBy }}</span>
            <div class="bc-controls">
              <button class="bc-btn" (click)="toggleMute()" [title]="broadcastMuted ? 'Unmute' : 'Mute'">
                <span class="material-icons">{{ broadcastMuted ? 'volume_off' : 'volume_up' }}</span>
              </button>
              <ng-container *ngIf="isHost">
                <button class="bc-btn" (click)="hostPlay()" title="Play"><span class="material-icons">play_arrow</span></button>
                <button class="bc-btn" (click)="hostPause()" title="Pause"><span class="material-icons">pause</span></button>
                <button class="bc-btn" (click)="hostSeek(-10)" title="Back 10s"><span class="material-icons">replay_10</span></button>
                <button class="bc-btn" (click)="hostSeek(10)" title="Forward 10s"><span class="material-icons">forward_10</span></button>
                <button class="bc-btn bc-stop" (click)="stopBroadcast()" title="Stop broadcast"><span class="material-icons">stop</span></button>
              </ng-container>
            </div>
          </div>
          <div class="broadcast-stage">
            <div [id]="ytElementId" class="yt-player"></div>
            @if (showPlayOverlay) {
              <button class="broadcast-play-overlay" type="button" (click)="userPlay()">
                <span class="material-icons">play_arrow</span>
              </button>
            }
          </div>
          <p class="broadcast-hint">Open the <strong>Chat</strong> tab to comment while watching.</p>
        </div>

        <!-- ── Next meeting hero (always visible) ────────────── -->
        <div class="next-meeting" *ngIf="nextMeeting" (click)="activeTab = 'meet'">
          <div class="next-meeting-icon"><span class="material-icons">videocam</span></div>
          <div class="next-meeting-info">
            <span class="next-meeting-label">Next meeting {{ nextMeetingIn }}</span>
            <span class="next-meeting-title">{{ nextMeeting.title }}</span>
            <span class="next-meeting-meta">
              {{ nextMeeting.scheduledAt | date:'EEE, MMM d, h:mm a' }} &middot; {{ nextMeeting.durationMinutes }} min
            </span>
          </div>
          <button class="next-meeting-cta" (click)="$event.stopPropagation(); activeTab = 'meet'">
            <span class="material-icons">play_arrow</span> Join
          </button>
        </div>

        <!-- ── Desktop top tabs ──────────────────────────────── -->
        <div class="tab-bar" *ngIf="!isMobile">
          <button
            *ngFor="let tab of tabs"
            class="tab-btn"
            [class.active]="activeTab === tab.id"
            (click)="selectTab(tab.id)"
          >
            <span class="material-icons">{{ tab.icon }}</span>
            {{ tab.label }}
            <span *ngIf="tab.id === 'chat' && unreadCount > 0" class="tab-badge">{{ unreadCount }}</span>
            <span *ngIf="tab.id === 'meet' && upcomingMeetings.length > 0" class="tab-badge">{{ upcomingMeetings.length }}</span>
          </button>
        </div>

        <!-- ── Smart schedule helper: meetings in other rooms ─ -->
        <div class="smart-schedule" *ngIf="otherMeetings.length > 0">
          <div class="smart-schedule-head">
            <span class="material-icons">auto_awesome</span>
            <span>Smart Schedule</span>
            <span class="smart-schedule-sub">You have meetings in other rooms</span>
          </div>
          <div class="smart-schedule-list">
            <div *ngFor="let m of otherMeetings" class="smart-schedule-item">
              <span class="ssi-icon material-icons">videocam</span>
              <div class="ssi-info">
                <span class="ssi-title">{{ m.title }}</span>
                <span class="ssi-meta">
                  {{ m.roomName }}
                  &middot; {{ m.scheduledAt | date:'EEE, MMM d, h:mm a' }}
                  &middot; {{ m.durationMinutes }} min
                </span>
              </div>
              <button
                class="ssi-accept"
                [class.accepted]="m.acceptedByMe"
                (click)="acceptMeeting(m)"
              >
                <span class="material-icons">{{ m.acceptedByMe ? 'check' : 'add' }}</span>
                {{ m.acceptedByMe ? 'Accepted' : 'Accept' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Unified tab body (all devices) ────────────────── -->
        <div class="tab-body" [class.tab-body-bottom-pad]="isMobile">
          <div *ngIf="activeTab === 'chat'" class="tab-pane chat-pane">
            <ng-container *ngTemplateOutlet="chatBody" />
          </div>

          <div *ngIf="activeTab === 'focus'" class="tab-pane focus-pane">
            <app-pomodoro-timer [roomId]="roomId" />
          </div>

          <div *ngIf="activeTab === 'notes'" class="tab-pane notes-pane">
            <app-notes-editor [roomId]="roomId" />
          </div>

          <div *ngIf="activeTab === 'ai'" class="tab-pane ai-pane">
            <app-ai-chat-panel [subject]="room?.subject || ''" [notesContext]="notesContext" [roomId]="room?.id || ''" />
          </div>

          <div *ngIf="activeTab === 'tasks'" class="tab-pane tasks-pane">
            <app-room-tasks-panel [roomId]="roomId" [members]="taskMembers" />
          </div>

          <div *ngIf="activeTab === 'meet'" class="tab-pane meet-pane">
            <ng-container *ngTemplateOutlet="meetingsBody" />
          </div>

          <div *ngIf="activeTab === 'stats'" class="tab-pane stats-pane">
            <div class="room-stats-grid" *ngIf="roomStats">
              <div class="rs-card">
                <span class="material-icons rs-icon">schedule</span>
                <span class="rs-value">{{ formatDuration(roomStats.totalMinutes) }}</span>
                <span class="rs-label">Total Focus Time</span>
              </div>
              <div class="rs-card">
                <span class="material-icons rs-icon">check_circle</span>
                <span class="rs-value">{{ roomStats.totalSessions }}</span>
                <span class="rs-label">Sessions</span>
              </div>
              <div class="rs-card">
                <span class="material-icons rs-icon">people</span>
                <span class="rs-value">{{ roomStats.memberCount }}</span>
                <span class="rs-label">Members</span>
              </div>
              <div class="rs-card">
                <span class="material-icons rs-icon">flag</span>
                <span class="rs-value">{{ formatDuration(roomStats.goalMinutes) }}</span>
                <span class="rs-label">Room Goal</span>
              </div>
            </div>

            <div class="room-leaderboard" *ngIf="roomLeaderboard.length > 0">
              <h3>Weekly Leaderboard</h3>
              <div class="lb-row" *ngFor="let entry of roomLeaderboard; let i = index" [class.me]="entry.userId === currentUserId">
                <span class="lb-rank">{{ i + 1 }}</span>
                <div class="lb-avatar" [class.has-image]="entry.avatarUrl">
                  <img *ngIf="entry.avatarUrl" [src]="entry.avatarUrl" alt="" />
                  <span *ngIf="!entry.avatarUrl">{{ entry.username.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="lb-name">{{ entry.username }}</span>
                <span class="lb-time">{{ formatDuration(entry.verifiedMinutes) }}</span>
              </div>
            </div>

            <div class="room-hourly" *ngIf="roomHourly.length > 0">
              <h3>Focus by Hour (This Room)</h3>
              <div class="hourly-chart-sm">
                <div class="hour-col-sm" *ngFor="let h of roomHourly" [title]="h.hour + ':00 — ' + formatDuration(h.minutes)">
                  <div class="hour-fill-sm" [style.height.%]="getHourHeight(h.minutes)"></div>
                  <span class="hour-label-sm" *ngIf="h.hour % 3 === 0">{{ h.hour }}</span>
                </div>
              </div>
            </div>

            <!-- ── Verification review queue (host/co-host only) ── -->
            <div class="review-queue" *ngIf="isModerator && reviewQueue.length > 0">
              <h3>Verification Queue</h3>
              <p class="review-queue-hint">Flagged focus time in this room that needs your confirmation — owners may add a note first.</p>
              <div class="review-queue-list">
                <div class="review-row" *ngFor="let r of reviewQueue">
                  <div class="review-info">
                    <span class="review-duration">{{ r.durationLabel }}</span>
                    <span class="review-reason">{{ reasonLabel(r.verifiedReason) }}</span>
                    <span class="review-date" *ngIf="r.startedAt">{{ r.startedAt | date:'MMM d, h:mm a' }}</span>
                    <span class="review-comment" *ngIf="r.verificationComment">"{{ r.verificationComment }}"</span>
                    <span class="review-requested" *ngIf="r.verificationRequestedAt">
                      <span class="material-icons">schedule</span> Owner requested review
                    </span>
                  </div>
                  <div class="review-actions">
                    <button class="btn-primary btn-sm" [disabled]="r.__busy" (click)="reviewSession(r, true)">Approve</button>
                    <button class="btn-outline-danger btn-sm" [disabled]="r.__busy" (click)="reviewSession(r, false)">Decline</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Non-member join prompt -->
      <div class="join-prompt" *ngIf="!isMember && room">
        <span class="material-icons">groups</span>
        <p>Join this room to start studying with others!</p>
        <button class="btn-primary join-big" (click)="joinRoom()" [disabled]="joining">
          {{ joining ? 'Joining...' : 'Join Room' }}
        </button>
      </div>

      <!-- Guest meeting join (invite link with ?meeting=1&code=) -->
      <div class="guest-meeting" *ngIf="guestMeeting && !isMember && room">
        <div class="guest-card">
          <span class="material-icons guest-icon">videocam</span>
          <h1>{{ room.name }}</h1>
          <p class="guest-sub">You've been invited to join this meeting as a guest.</p>
          <button class="btn-primary guest-join" (click)="startGuestCall()" [disabled]="inCall">
            <span class="material-icons">videocam</span> Join Meeting
          </button>
          <a routerLink="/rooms" class="guest-back">Go to Rooms</a>
        </div>
      </div>

      <!-- ── Call overlay (LiveKit) ──────────────────────────── -->
      <div class="call-overlay" *ngIf="(isMember || guestMeeting) && inCall">
        <app-meeting-room
          [roomId]="roomId"
          [roomName]="room?.name || 'Meeting'"
          [joinCode]="guestMeeting ? (guestCode ?? '') : (room?.joinCode ?? '')"
          (leaveRequest)="toggleCall()"
        />
      </div>

      <!-- ── Shared templates ────────────────────────────────── -->
      <ng-template #chatBody>
        <div class="messages" #messageContainer>
          <ng-container *ngFor="let msg of messages; let i = index">
            <div class="day-divider" *ngIf="showDayDivider(i)">
              <span>{{ messages[i].createdAt | date:'mediumDate' }}</span>
            </div>
            <div class="message" [class.own]="msg.userId === currentUserId" [class.avatar-gap]="msg.userId === currentUserId || isFirstOfGroup(i)">
              <div class="message-avatar" *ngIf="msg.userId !== currentUserId && isFirstOfGroup(i)" [class.has-image]="msg.avatarUrl" routerLink="/profile/{{msg.userId}}" style="cursor:pointer">
                <img *ngIf="msg.avatarUrl; else messageInitial" [src]="msg.avatarUrl" alt="" />
                <ng-template #messageInitial>{{ msg.username.charAt(0).toUpperCase() }}</ng-template>
              </div>
              <div class="message-body">
                <div class="message-header" *ngIf="msg.userId !== currentUserId && isFirstOfGroup(i)">
                  <span class="message-user">{{ msg.username }}</span>
                </div>
                <div class="bubble">
                  <span class="bubble-content">{{ msg.content }}</span>
                  <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
                </div>
              </div>
            </div>
          </ng-container>
        </div>
        <div class="chat-input">
          <input
            type="text"
            [(ngModel)]="newMessage"
            (keyup.enter)="sendMessage()"
            placeholder="Type a message..."
            [disabled]="!isMember"
          />
          <button class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim()">
            <span class="material-icons">send</span>
          </button>
        </div>
      </ng-template>

      <ng-template #meetingsBody>
        <div class="meet-actions">
          <button class="meet-action meet-primary" type="button" (click)="showLiveChooser = true" aria-label="Start a live session">
            <span class="material-icons">rocket_launch</span>
            <span class="meet-action-text">
              <span class="meet-action-title">Start live session</span>
              <span class="meet-action-sub">Call, broadcast, or schedule a meeting</span>
            </span>
            <span class="material-icons meet-action-chev">chevron_right</span>
          </button>
        </div>
        <div class="meetings-panel" *ngIf="upcomingMeetings.length > 0">
          <div class="panel-header">
            <h2><span class="material-icons">event</span> Upcoming Meetings</h2>
            <button class="schedule-mini" (click)="copyMeetingLink()" title="Copy meeting link">
              <span class="material-icons">link</span> Copy link
            </button>
            <button class="schedule-mini" (click)="openScheduleDialog()">
              <span class="material-icons">add</span> Schedule
            </button>
          </div>
          <div class="meeting-list">
            <div *ngFor="let meeting of upcomingMeetings" class="meeting-item">
              <div class="meeting-avatar">
                <span class="material-icons">videocam</span>
              </div>
              <div class="meeting-info">
                <span class="meeting-title">{{ meeting.title }}</span>
                <span class="meeting-meta">
                  <span class="material-icons">schedule</span>
                  {{ meeting.scheduledAt | date:'EEE, MMM d, h:mm a' }}
                  &middot; {{ meeting.durationMinutes }} min
                  &middot; by {{ meeting.createdByUsername }}
                </span>
                <span *ngIf="meeting.description" class="meeting-desc">{{ meeting.description }}</span>
              </div>
              <button
                class="meeting-accept"
                [class.accepted]="meeting.acceptedByMe"
                (click)="acceptMeeting(meeting)"
                title="Accept / decline meeting"
              ><span class="material-icons">{{ meeting.acceptedByMe ? 'check_circle' : 'check_circle_outline' }}</span>
                {{ meeting.acceptedCount || 0 }}</button>
              <button
                *ngIf="canDeleteMeeting(meeting)"
                class="meeting-delete"
                (click)="deleteMeeting(meeting)"
                title="Delete meeting"
              ><span class="material-icons">delete</span></button>
            </div>
          </div>
        </div>
        <div class="meetings-empty" *ngIf="upcomingMeetings.length === 0">
          <span class="material-icons">event_available</span>
          <p class="meetings-empty-title">No upcoming meetings</p>
          <p class="meetings-empty-sub">Jump into a live session now, or schedule one for later.</p>
          <div class="meetings-empty-actions">
            <button class="btn-primary" (click)="showLiveChooser = true"><span class="material-icons">rocket_launch</span> Start live session</button>
            <button class="btn-outline" (click)="openScheduleDialog()"><span class="material-icons">event</span> Schedule</button>
          </div>
        </div>
      </ng-template>

      <div class="snack" *ngIf="snack">{{ snack }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .room-detail { max-width: 1200px; margin: 0 auto; background-size: cover; background-position: center; background-repeat: no-repeat; position: relative; border-radius: 16px; overflow: hidden; }
    .room-detail::before { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.25); pointer-events: none; z-index: 0; }
    .room-detail > * { position: relative; z-index: 1; }
    .room-header.has-bg { background: rgba(255,255,255,0.08); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

    /* ── Header ─────────────────────────────────────────────── */
    .room-header { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }

    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); text-decoration: none; font-size: var(--font-13); margin-bottom: 12px; }
    .back-link:hover { color: var(--accent); }
    .back-link .material-icons { font-size: var(--font-18); }

    .room-info h1 { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }

    .room-badges { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .subject-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }
    .members-badge { background: rgba(34, 197, 94, 0.1); color: var(--success); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }
    .private-badge { background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }
    .focus-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(239, 68, 68, 0.1); color: var(--error);
      padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600;
      animation: focusPulse 2s ease-in-out infinite;
    }
    .focus-badge .material-icons { font-size: 14px; }
    @keyframes focusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .room-description { font-size: var(--font-13); color: var(--text-secondary); }

    .room-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .btn-primary { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-outline-danger { padding: 10px 20px; background: transparent; border: 1px solid var(--error); border-radius: 8px; color: var(--error); font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
    .btn-outline-danger:hover { background: rgba(239, 68, 68, 0.1); }

    .btn-call {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 20px; background: var(--success); border: none; border-radius: 8px;
      color: white; font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-call:hover { background: #16a34a; }
    .btn-call .material-icons { font-size: var(--font-18); }

    .room-content { margin-top: 16px; }

    /* ── Members ────────────────────────────────────────────── */
    .members-bar {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px;
    }

    .members-title { font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }

    .members-avatars { display: flex; gap: 8px; flex-wrap: wrap; }
    .members-avatars.scrollable { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
    .members-avatars.scrollable::-webkit-scrollbar { display: none; }

    .member-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 20px; background: var(--background); border: 1px solid var(--border); flex-shrink: 0; }

    .member-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: var(--font-11); flex-shrink: 0; }
    .member-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .member-name { font-size: var(--font-12); color: var(--text-primary); }

    .invite-chip {
      display: flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px;
      background: transparent; border: 1px dashed var(--primary); color: var(--primary);
      font-size: var(--font-12); font-weight: 600; cursor: pointer; flex-shrink: 0;
    }
    .invite-chip:hover { background: rgba(56, 189, 248, 0.1); }
    .invite-chip .material-icons { font-size: var(--font-16); }

    /* ── Leaderboard + collective progress ────────────────────── */
    .leaderboard-section {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px; margin-bottom: 16px;
    }
    .leaderboard-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
    }
    .leaderboard-header .material-icons { color: #f59e0b; font-size: 20px; }
    .leaderboard-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .leaderboard-sub { font-size: var(--font-11); color: var(--text-muted); margin-left: auto; }

    .collective-progress { margin-bottom: 14px; }
    .collective-label {
      display: flex; justify-content: space-between; font-size: var(--font-12);
      color: var(--text-secondary); margin-bottom: 4px;
    }
    .collective-amount { font-weight: 600; }
    .progress-bar {
      width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent));
      border-radius: 4px; transition: width 0.6s ease;
    }
    .collective-meta { font-size: var(--font-11); color: var(--text-muted); margin-top: 4px; }

    .leaderboard-list { display: flex; flex-direction: column; gap: 6px; }
    .leaderboard-row {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px;
      border-radius: 8px; background: var(--background); transition: background 0.15s;
    }
    .leaderboard-row:hover { background: rgba(56, 189, 248, 0.06); }

    .lb-rank { width: 28px; text-align: center; font-weight: 700; font-size: var(--font-13); flex-shrink: 0; }
    .lb-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: var(--primary); color: white; font-size: var(--font-11); font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .lb-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .lb-info { flex: 1; min-width: 0; }
    .lb-name { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lb-sessions { font-size: var(--font-11); color: var(--text-muted); }

    .lb-stats { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .lb-minutes { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .lb-streak {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: var(--font-11); font-weight: 600; color: #f59e0b;
    }
    .lb-streak .material-icons { font-size: 13px; }

    /* ── Next meeting hero ──────────────────────────────────── */
    .next-meeting {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(34, 197, 94, 0.12));
      border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px;
      padding: 12px 16px; margin-bottom: 12px; cursor: pointer;
      transition: border-color 0.15s, transform 0.15s;
    }
    .next-meeting:hover { border-color: var(--primary); transform: translateY(-1px); }

    .next-meeting-icon {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      background: rgba(56, 189, 248, 0.15); color: var(--accent);
      display: flex; align-items: center; justify-content: center;
    }
    .next-meeting-icon .material-icons { font-size: var(--font-22); }

    .next-meeting-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .next-meeting-label { font-size: var(--font-11); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--success); }
    .next-meeting-title { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .next-meeting-meta { font-size: var(--font-12); color: var(--text-secondary); }

    .next-meeting-cta {
      display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
      padding: 8px 16px; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-size: var(--font-13); font-weight: 600; cursor: pointer;
    }
    .next-meeting-cta:hover { background: var(--primary-hover); }
    .next-meeting-cta .material-icons { font-size: var(--font-18); }

    /* ── Tab bar (desktop) ──────────────────────────────────── */
    .tab-bar {
      display: flex; gap: 4px; margin-bottom: 12px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 6px; overflow-x: auto;
    }
    .tab-btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 12px; background: none; border: none; border-radius: 8px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      cursor: pointer; white-space: nowrap; position: relative; transition: background 0.15s, color 0.15s;
    }
    .tab-btn:hover { background: var(--background); color: var(--text-primary); }
    .tab-btn.active { background: var(--primary); color: white; }
    .tab-btn .material-icons { font-size: var(--font-18); padding-right: 6px; }
    .tab-badge {
      position: absolute; top: 2px; right: 8px; min-width: 18px; height: 18px;
      border-radius: 9px; background: var(--error); color: white;
      font-size: var(--font-10); font-weight: 700;
      display: flex; align-items: center; justify-content: center; padding: 0 4px;
    }
    .tab-btn.active .tab-badge { background: #dc2626; }

    /* ── Tab body ───────────────────────────────────────────── */
    .tab-body { min-height: 480px; }
    .tab-pane {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;
    }
    .tab-pane .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
    .tab-pane .panel-header h2 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }


    .chat-pane { height: 600px; }
    .chat-pane .chat-input { border-top: 1px solid var(--border); }
    .notes-pane { height: 600px; }
    .notes-pane ::ng-deep app-notes-editor { flex: 1; display: flex; flex-direction: column; }
    .ai-pane { height: 600px; }
    .ai-pane ::ng-deep app-ai-chat-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .tasks-pane { height: 600px; overflow-y: auto; padding: 16px; box-sizing: border-box; }
    .tasks-pane ::ng-deep app-room-tasks-panel { flex: 1; }
    .focus-pane { padding: 16px; }

    /* ── Stats Tab ──────────────────────────────────────────── */
    .stats-pane { padding: 20px; overflow-y: auto; }
    .room-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
    .rs-card {
      background: var(--background); border: 1px solid var(--border); border-radius: 10px;
      padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
    }
    .rs-icon { font-size: 22px; color: var(--primary); }
    .rs-value { font-size: var(--font-20); font-weight: 700; color: var(--text-primary); }
    .rs-label { font-size: var(--font-11); color: var(--text-muted); }

    .room-leaderboard { margin-bottom: 20px; }
    .room-leaderboard h3, .room-hourly h3 { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .lb-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; transition: background 0.15s; }
    .lb-row:hover { background: var(--background); }
    .lb-row.me { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .lb-rank { width: 24px; font-size: var(--font-13); font-weight: 700; color: var(--text-muted); text-align: center; }
    .lb-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--border); display: flex; align-items: center; justify-content: center; font-size: var(--font-13); font-weight: 700; color: var(--text-secondary); flex-shrink: 0; overflow: hidden; }
    .lb-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .lb-name { flex: 1; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .lb-time { font-size: var(--font-13); font-weight: 700; color: var(--primary); }

    .hourly-chart-sm { display: flex; align-items: flex-end; gap: 3px; height: 80px; }
    .hour-col-sm { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .hour-fill-sm { width: 100%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 2px; opacity: 0.7; transition: height 0.3s ease; }
    .hour-col-sm:hover .hour-fill-sm { opacity: 1; }
    .hour-label-sm { font-size: 9px; color: var(--text-muted); margin-top: 3px; }

    /* ── Verification review queue ────────────────────────────── */
    .review-queue { margin-top: 20px; }
    .review-queue h3 { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .review-queue-hint { font-size: var(--font-12); color: var(--text-muted); margin-bottom: 10px; }
    .review-queue-list { display: flex; flex-direction: column; gap: 8px; }
    .review-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 10px;
    }
    .review-info { display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
    .review-duration { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .review-reason { font-size: var(--font-12); color: var(--text-muted); text-transform: capitalize; }
    .review-date { font-size: var(--font-12); color: var(--text-muted); }
    .review-comment { font-size: var(--font-12); color: var(--text-secondary); font-style: italic; }
    .review-requested {
      display: inline-flex; align-items: center; gap: 4px; align-self: flex-start;
      font-size: var(--font-11); font-weight: 600; color: #f59e0b;
      background: color-mix(in srgb, #f59e0b 12%, transparent);
      border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
      border-radius: 12px; padding: 2px 8px;
    }
    .review-requested .material-icons { font-size: 13px; }
    .review-actions { display: flex; gap: 8px; }

    /* ── Chat ───────────────────────────────────────────────── */
    .messages { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 2px; }

    .day-divider { display: flex; align-items: center; justify-content: center; padding: 12px 0 8px; }
    .day-divider span { font-size: var(--font-11); color: var(--text-muted); background: var(--background); border: 1px solid var(--border); padding: 3px 10px; border-radius: 12px; }

    .message { display: flex; gap: 10px; padding: 2px 0; }

    .message.own { justify-content: flex-end; }
    .message.own .message-body { align-items: flex-end; }

    .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: var(--font-12); color: white; flex-shrink: 0; overflow: hidden; align-self: flex-end; margin-bottom: 2px; }
    .message-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .message-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .message-header { margin-bottom: 2px; padding-left: 2px; }
    .message-user { font-size: var(--font-12); font-weight: 600; color: var(--accent); }

    .bubble { max-width: 70%; padding: 8px 12px; border-radius: 14px; background: var(--background); border: 1px solid var(--border); display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; word-break: break-word; }
    .message.own .bubble { background: var(--primary); border-color: var(--primary); border-bottom-right-radius: 4px; }
    .message:not(.own):not(.avatar-gap) .bubble { border-bottom-left-radius: 4px; }

    .bubble-content { font-size: var(--font-13); color: var(--text-primary); line-height: 1.45; white-space: pre-wrap; }
    .message.own .bubble-content { color: white; }

    .message-time { font-size: var(--font-10); color: var(--text-muted); align-self: flex-end; }
    .message.own .message-time { color: rgba(255,255,255,0.7); }

    .chat-input { display: flex; align-items: center; padding: 12px; border-top: 1px solid var(--border); gap: 8px; }
    .chat-input input { flex: 1; padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .chat-input input:focus { border-color: var(--primary); }
    .chat-input input::placeholder { color: var(--text-muted); }

    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--primary); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    /* ── Meetings ───────────────────────────────────────────── */
    .meet-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .meet-action {
      display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border);
      background: var(--surface); color: var(--text-primary); cursor: pointer; text-align: left;
      transition: all 0.15s; -webkit-tap-highlight-color: transparent;
    }
    .meet-action:hover { border-color: var(--primary); transform: translateY(-1px); }
    .meet-primary {
      background: linear-gradient(135deg, var(--primary), var(--primary-hover));
      border-color: transparent; color: #fff;
    }
    .meet-primary:hover { border-color: transparent; opacity: 0.95; }
    .meet-action > .material-icons:first-child { font-size: var(--font-24); }
    .meet-action-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .meet-action-title { font-size: var(--font-14); font-weight: 700; }
    .meet-action-sub { font-size: var(--font-12); opacity: 0.85; }
    .meet-action-chev { font-size: var(--font-20); opacity: 0.8; }

    .meetings-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
    .upcoming-count { font-size: var(--font-12); color: var(--text-secondary); }
    .meeting-list { padding: 8px 0; }
    .meeting-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; }
    .meeting-item:hover { background: var(--background); }
    .meeting-avatar { width: 40px; height: 40px; border-radius: 10px; background: rgba(56, 189, 248, 0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .meeting-avatar .material-icons { font-size: var(--font-22); }
    .meeting-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .meeting-title { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .meeting-meta { display: flex; align-items: center; gap: 4px; font-size: var(--font-12); color: var(--text-secondary); }
    .meeting-meta .material-icons { font-size: var(--font-14); }
    .meeting-desc { font-size: var(--font-12); color: var(--text-muted); }
    .meeting-delete { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .meeting-delete:hover { color: var(--error); }

    .meeting-accept {
      display: inline-flex; align-items: center; gap: 2px;
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      padding: 4px 8px; border-radius: 6px; font-size: var(--font-12); font-weight: 600;
    }
    .meeting-accept:hover { color: var(--primary); }
    .meeting-accept.accepted { color: var(--success); }

    /* ── Smart schedule helper ─────────────────────────────── */
    .smart-schedule {
      background: var(--surface);
      border: 1px solid var(--border); border-left: 3px solid var(--accent);
      border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px;
    }
    .smart-schedule-head {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: var(--font-14); font-weight: 700; color: var(--text-primary);
    }
    .smart-schedule-head .material-icons { color: var(--accent); font-size: var(--font-18); }
    .smart-schedule-sub { font-size: var(--font-12); font-weight: 500; color: var(--text-muted); margin-left: 4px; }
    .smart-schedule-list { display: flex; flex-direction: column; gap: 8px; }
    .smart-schedule-item {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
    }
    .ssi-icon { color: var(--primary); font-size: var(--font-20); }
    .ssi-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ssi-title { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ssi-meta { font-size: var(--font-12); color: var(--text-muted); }
    .ssi-accept {
      display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
      border: 1px solid var(--primary); background: var(--primary); color: #fff;
      border-radius: 8px; padding: 6px 12px; font-size: var(--font-12); font-weight: 700; cursor: pointer;
    }
    .ssi-accept .material-icons { font-size: var(--font-16); }
    .ssi-accept.accepted { background: transparent; color: var(--success); border-color: var(--success); }


    .schedule-mini {
      display: flex; align-items: center; gap: 4px; padding: 6px 12px;
      background: transparent; border: 1px solid var(--primary); border-radius: 8px;
      color: var(--primary); font-size: var(--font-12); font-weight: 600; cursor: pointer;
    }
    .schedule-mini:hover { background: rgba(56, 189, 248, 0.1); }
    .schedule-mini .material-icons { font-size: var(--font-16); }

    .meetings-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; text-align: center; color: var(--text-muted); }
    .meetings-empty .material-icons { font-size: 40px; color: var(--text-muted); margin-bottom: 4px; }
    .meetings-empty-title { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .meetings-empty-sub { font-size: var(--font-13); color: var(--text-secondary); }
    .meetings-empty-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
    .meetings-empty-actions .btn-primary, .meetings-empty-actions .btn-outline { display: inline-flex; align-items: center; gap: 6px; }
    .meetings-empty-actions .material-icons { font-size: var(--font-18); margin: 0; }

    /* ── Dialogs ────────────────────────────────────────────── */
    .invite-dialog-backdrop, .schedule-dialog-backdrop {
      position: fixed !important; inset: 0 !important;
      background: rgba(0, 0, 0, 0.5);
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

    .btn-invite {
      padding: 6px 12px; background: var(--primary); border: none; border-radius: 8px;
      color: white; font-size: var(--font-12); font-weight: 600; cursor: pointer; flex-shrink: 0;
    }
    .btn-invite:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-invite:disabled { opacity: 0.5; cursor: not-allowed; }

    .dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); }
    .field input, .field select { padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; min-height: 44px; }
    .field input:focus, .field select:focus { border-color: var(--primary); }
    .form-error { color: var(--error); font-size: var(--font-13); margin: 0; }
    .dialog-submit { width: 100%; padding: 14px; justify-content: center; min-height: 48px; flex-shrink: 0; }

    /* ── Roles ──────────────────────────────────────────────── */
    .role-dot {
      position: absolute; right: -4px; bottom: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #f5b301; border: 2px solid var(--surface);
      display: flex; align-items: center; justify-content: center;
    }
    .role-dot .material-icons { font-size: 11px; color: #fff; }
    .role-dot.cohost { background: var(--accent); }
    .member-avatar { position: relative; }
    .btn-invite-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
    .btn-invite-ghost:hover:not(:disabled) { border-color: var(--error); color: var(--error); background: transparent; }
    .role-tag { font-size: var(--font-11); font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.4px; }

    /* ── Generic dialog (video share) ──────────────────────── */
    .dialog-backdrop {
      position: fixed !important; inset: 0 !important; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1300;
    }
    .dialog {
      width: 440px; max-width: 92vw; max-height: 85vh; background: var(--surface);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
    }

    /* ── Live session chooser ──────────────────────────────── */
    .live-chooser-backdrop {
      position: fixed !important; inset: 0 !important; background: rgba(0, 0, 0, 0.5);
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
    .live-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .live-option-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .live-option-sub { font-size: var(--font-12); color: var(--text-muted); }
    .live-option-chev { font-size: var(--font-20); color: var(--text-muted); }

    /* ── YouTube broadcast bar ─────────────────────────────── */
    .broadcast-bar {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; margin-bottom: 16px; overflow: hidden;
    }
    .broadcast-header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
    .broadcast-icon { color: var(--accent); font-size: var(--font-20); }
    .broadcast-title { font-size: var(--font-13); font-weight: 700; color: var(--text-primary); }
    .broadcast-by { font-size: var(--font-12); color: var(--text-muted); }
    .live-badge {
      display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 4px;
      background: var(--error); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
    }
    .bc-controls { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
    .bc-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 8px; background: var(--background);
      border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .bc-btn:hover { color: var(--text-primary); border-color: var(--primary); }
    .bc-stop { color: var(--error); border-color: var(--error); }
    .bc-stop:hover { background: rgba(239, 68, 68, 0.1); }
    .broadcast-stage { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; }
    .yt-player { position: absolute; inset: 0; width: 100%; height: 100%; }
    .broadcast-stage iframe, .yt-player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .broadcast-hint { padding: 8px 14px; margin: 0; font-size: var(--font-12); color: var(--text-muted); }

    .broadcast-play-overlay {
      position: absolute; inset: 0; z-index: 2;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.45); border: 0; cursor: pointer; color: #fff;
    }
    .broadcast-play-overlay .material-icons { font-size: 56px; }

    .btn-outline.share-video-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; background: transparent; border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-secondary); font-size: var(--font-14);
      font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s;
    }
    .btn-outline.share-video-btn:hover { border-color: var(--primary); color: var(--text-primary); }
    .btn-outline.share-video-btn .material-icons { font-size: var(--font-18); }

    /* ── Call overlay ───────────────────────────────────────── */
    .call-overlay {
      position: fixed; inset: 0; z-index: 1200; background: #0b0f14;
      display: flex; flex-direction: column;
    }
    .call-overlay-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); gap: 12px;
    }
    .call-overlay-header h2 { display: flex; align-items: center; gap: 8px; font-size: var(--font-15); font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .end-call-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--error); flex-shrink: 0; }
    .end-call-btn:hover:not(:disabled) { background: #dc2626; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: pulse 1.5s infinite; flex-shrink: 0; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .call-frame { flex: 1; width: 100%; border: 0; display: block; }

    /* ── Join prompt ────────────────────────────────────────── */
    .join-prompt {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      text-align: center; padding: 64px 16px; color: var(--text-muted);
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    }
    .join-prompt .material-icons { font-size: 48px; color: var(--text-muted); }
    .join-big { padding: 14px 32px; font-size: var(--font-15); }

    /* ── Share / invite-link button ──────────────────────────── */
    .btn-outline.share-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; background: transparent; border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-secondary); font-size: var(--font-14);
      font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s;
    }
    .btn-outline.share-btn:hover { border-color: var(--primary); color: var(--text-primary); }
    .btn-outline.share-btn .material-icons { font-size: var(--font-18); }

    /* ── Guest meeting join ──────────────────────────────────── */
    .guest-meeting { display: flex; justify-content: center; padding: 48px 16px; }
    .guest-card {
      display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 32px; max-width: 420px; width: 100%;
    }
    .guest-icon { font-size: 48px; color: var(--primary); }
    .guest-card h1 { font-size: var(--font-20); font-weight: 700; color: var(--text-primary); }
    .guest-sub { font-size: var(--font-13); color: var(--text-secondary); margin-top: -6px; }
    .guest-join { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; font-size: var(--font-15); }
    .guest-back { font-size: var(--font-13); color: var(--accent); text-decoration: none; }
    .guest-back:hover { text-decoration: underline; }

    /* ── Snack / copy feedback ───────────────────────────────── */
    .snack {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 1300;
      background: rgba(20, 20, 30, 0.95); border: 1px solid var(--border); color: #fff;
      padding: 10px 18px; border-radius: 10px; font-size: var(--font-13); font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); animation: snack-in 0.2s ease;
    }
    @keyframes snack-in { from { opacity: 0; transform: translateX(-50%) translateY(6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    /* ── Mobile ─────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .room-detail { max-width: 100%; overflow: visible; }

      .room-header { border-radius: 0; border-left: 0; border-right: 0; border-top: 0; padding: 16px; margin-bottom: 0; }
      .back-label { display: none; }
      .back-link { margin-bottom: 8px; }
      .room-info h1 { font-size: var(--font-18); }

      .room-content { margin-top: 12px; }

      .members-bar { border-radius: 0; border-left: 0; border-right: 0; padding: 10px 16px; margin-bottom: 12px; }
      .member-chip { padding: 3px; }
      .member-avatar { width: 34px; height: 34px; font-size: var(--font-13); }
      .invite-chip { padding: 8px 12px; }

      /* Keep broadcast controls (incl. unmute) reachable on small screens */
      .broadcast-header { padding: 8px 10px; gap: 6px; }
      .broadcast-title { white-space: nowrap; }
      .bc-controls { width: 100%; margin-left: 0; justify-content: flex-start; }
      .bc-btn { width: 40px; height: 40px; }

      .next-meeting { margin: 0 12px 12px; border-radius: 14px; }

      /* Mobile quick actions */
      .mobile-quick { display: flex; gap: 8px; margin: 0 12px 12px; }
      .quick-studio {
        flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px;
        padding: 12px 14px; border: none; border-radius: 14px; cursor: pointer;
        background: linear-gradient(135deg, var(--primary), #0ea5e9); color: white;
        box-shadow: 0 4px 16px rgba(56, 189, 248, 0.28);
        text-align: left; transition: transform 0.12s, box-shadow 0.12s;
      }
      .quick-studio:active { transform: scale(0.99); box-shadow: 0 2px 8px rgba(56, 189, 248, 0.24); }
      .quick-studio > .material-icons:first-child { font-size: var(--font-22); flex-shrink: 0; }
      .quick-studio-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .quick-studio-title { font-size: var(--font-14); font-weight: 700; }
      .quick-studio-sub { font-size: var(--font-12); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .quick-studio-chev { font-size: var(--font-20); opacity: 0.9; flex-shrink: 0; }
      .quick-icon {
        width: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);
        border-radius: 14px; cursor: pointer;
      }
      .quick-icon .material-icons { font-size: var(--font-20); }
      .quick-icon:active { background: var(--background); }


      .tab-body { min-height: 0; height: calc(100vh - 190px); height: calc(100dvh - 190px); margin: 0 12px 84px; border-radius: 14px; }
      .tab-body-bottom-pad { margin-bottom: 84px; }
      .tab-pane { border-radius: 14px; height: 100%; }


      .notes-pane ::ng-deep app-notes-editor { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .ai-pane ::ng-deep app-ai-chat-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .meetings-panel, .meetings-empty { margin-bottom: 0; border-radius: 14px; }

      .invite-dialog, .schedule-dialog { width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; max-height: 88vh; max-height: 88dvh; padding-bottom: env(safe-area-inset-bottom); }
      .invite-dialog-backdrop, .schedule-dialog-backdrop { align-items: flex-end; }

      /* Live session chooser — bottom sheet on mobile */
      .live-chooser { width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom); }
      .live-chooser-backdrop { align-items: flex-end; }

      /* Video/broadcast dialog — always a centered modal on mobile */
      .dialog-backdrop { align-items: center; padding: 20px; }
      .dialog {
        width: 100%; max-width: 420px;
        max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
      }

      .call-overlay-header { padding: 10px 12px; }
      .end-call-label { display: none; }
    }

    @media (max-width: 1200px) and (min-width: 901px) {
      .chat-pane, .notes-pane, .ai-pane, .tasks-pane { height: 520px; }
    }
  `]
})
export class RoomDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  get taskMembers(): TaskMember[] {
    return this.members.map(m => ({
      id: m.id,
      username: m.username,
      displayName: m.username,
      avatarUrl: m.avatarUrl
    }));
  }
  private roomService = inject(RoomService);
  private meetingService = inject(MeetingService);
  private signalR = inject(SignalRService);
  private chatService = inject(ChatService);
  private notesService = inject(NotesService);
  private auth = inject(AuthService);
  private invitationService = inject(InvitationService);
  private friendService = inject(FriendService);
  private ytPlayerSvc = inject(YouTubeBroadcastService);
  private statsService = inject(StatisticsService);
  private http = inject(HttpClient);
  private tabBar = inject(RoomTabBarService);

  @ViewChild('messageContainer', { static: false }) messageContainer?: ElementRef;

  roomId = '';
  room?: Room;
  messages: Message[] = [];
  members: UserDto[] = [];
  onlineUsers: string[] = [];
  focusCount = 0;
  leaderboard: LeaderboardEntry[] = [];
  collectiveStats: RoomCollectiveStats | null = null;
  newMessage = '';
  isMember = false;
  joining = false;
  loading = true;
  notesContext = '';
  showInviteDialog = false;
  friends: Friend[] = [];
  invitingId = '';
  inCall = false;
  guestMeeting = false;
  guestCode: string | null = null;
  inviteCode: string | null = null;
  snack = '';
  meetings: Meeting[] = [];
  otherMeetings: Meeting[] = [];
  showScheduleDialog = false;
  scheduleTitle = '';
  scheduleDescription = '';
  scheduleAt = '';
  scheduleDuration = 60;
  scheduling = false;
  scheduleError = '';
  showRolesDialog = false;
  roleChangingId = '';
  reviewQueue: (UnverifiedSession & { __busy?: boolean })[] = [];

  // ── YouTube broadcast (host-only start; synced playback) ──
  broadcastVideoId?: string;
  broadcastUrl?: string;
  broadcastStartedBy?: string;
  videoInput = '';
  showVideoDialog = false;
  ytElementId = 'room-broadcast-player';
  private ytPlayer?: any;
  broadcastMuted = true;
  showPlayOverlay = false;
  private applyingRemote = false;
  private ignoreState = false;
  private videoSubs: any[] = [];

  get isBroadcasting(): boolean {
    return !!this.broadcastVideoId;
  }

  isMobile = false;
  activeTab = 'chat';
  tabs: RoomTab[] = TABS;
  showLiveChooser = false;
  unreadCount = 0;
  now = Date.now();
  private nowTicker?: any;

  private notesSub?: Subscription;
  private tabBarSub?: Subscription;
  private focusSub?: Subscription;

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth <= 900;
  }

  get nextMeeting(): Meeting | undefined {
    return this.upcomingMeetings[0];
  }

  get nextMeetingIn(): string {
    const m = this.nextMeeting;
    if (!m) return '';
    const diff = new Date(m.scheduledAt).getTime() - this.now;
    if (diff <= 0) return 'Starting now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins} min`;
    const h = Math.floor(mins / 60);
    return `in ${h}h ${mins % 60}m`;
  }

  selectTab(id: string) {
    this.activeTab = id;
    if (id === 'chat') {
      this.unreadCount = 0;
      this.scrollToBottom();
    }
    if (id === 'stats' && this.roomId) {
      this.loadRoomStats();
      this.loadReviewQueue();
    }
    this.pushTabBarState();
  }

  private pushTabBarState() {
    this.tabBar.setState({
      isMobile: this.isMobile,
      isMember: this.isMember,
      tabs: this.tabs,
      activeTab: this.activeTab,
      unreadCount: this.unreadCount,
      upcomingMeetingsCount: this.upcomingMeetings.length
    });
  }

  roomStats: any = null;
  roomLeaderboard: any[] = [];
  roomHourly: any[] = [];
  private maxRoomHour = 1;

  getHourHeight(minutes: number): number {
    return this.maxRoomHour > 0 ? (minutes / this.maxRoomHour) * 100 : 0;
  }

  async loadRoomStats() {
    if (!this.roomId) return;
    try {
      const [leaderboard, collective] = await Promise.all([
        this.statsService.getRoomLeaderboard(this.roomId).toPromise(),
        this.statsService.getRoomCollectiveStats(this.roomId).toPromise()
      ]);
      this.roomLeaderboard = leaderboard || [];
      this.roomStats = collective;

      const hourlyData: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourlyData[h] = 0;
      (leaderboard || []).forEach((e: any) => {
        if (e.hourlyDistribution) {
          Object.entries(e.hourlyDistribution).forEach(([h, m]: [string, any]) => {
            hourlyData[parseInt(h)] = (hourlyData[parseInt(h)] || 0) + m;
          });
        }
      });
      this.roomHourly = Object.entries(hourlyData).map(([h, m]) => ({ hour: parseInt(h), minutes: m }));
      this.maxRoomHour = Math.max(1, ...this.roomHourly.map(h => h.minutes));
    } catch { }
  }

  get upcomingMeetings(): Meeting[] {
    const now = Date.now();
    return this.meetings
      .filter(m => new Date(m.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  get currentUserId(): string | undefined {
    return this.auth.currentUser()?.id;
  }

  get isHost(): boolean {
    if (!this.room) return false;
    const me = this.auth.currentUser();
    const myName = me?.username || me?.email || '';
    return !!myName && this.room.createdByUsername === myName;
  }

  get isModerator(): boolean {
    return this.myRole === 'host' || this.myRole === 'cohost';
  }

  get manageableMembers(): UserDto[] {
    return this.members.filter(m => m.id !== this.currentUserId && m.role !== 'host');
  }

  get myRole(): string {
    return this.members.find(m => m.id === this.currentUserId)?.role || 'member';
  }

  reasonLabel(reason?: string): string {
    switch (reason) {
      case 'excessive_duration': return 'Long session (> 4h)';
      case 'too_many_sessions': return 'Very large daily total';
      case 'excessive_tab_switches': return 'Many tab switches';
      case 'idle_timeout': return 'Auto-finalized while away';
      case 'too_short': return 'Very short session';
      default: return reason || 'Unverified';
    }
  }

  async loadReviewQueue(): Promise<void> {
    if (!this.roomId || !this.isModerator) return;
    try {
      this.reviewQueue = await this.statsService.getRoomVerificationQueue(this.roomId).toPromise() || [];
    } catch { this.reviewQueue = []; }
  }

  async reviewSession(r: UnverifiedSession & { __busy?: boolean }, approve: boolean): Promise<void> {
    if (r.__busy) return;
    (r as any).__busy = true;
    try {
      await this.statsService.reviewVerification(r.id, approve).toPromise();
      this.reviewQueue = this.reviewQueue.filter(x => x.id !== r.id);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to submit the review.');
    } finally {
      (r as any).__busy = false;
    }
  }

  async toggleCoHost(member: UserDto): Promise<void> {
    const next = member.role === 'cohost' ? 'member' : 'cohost';
    this.roleChangingId = member.id;
    try {
      await this.roomService.setMemberRole(this.roomId, member.id, next).toPromise();
      member.role = next;
    } catch (err: any) {
      alert(err.error?.error || 'Failed to update role.');
    } finally {
      this.roleChangingId = '';
    }
  }

  toggleCall() {
    this.inCall = !this.inCall;
  }

  // ── YouTube broadcast ────────────────────────────────────
  openVideoDialog() {
    this.videoInput = '';
    this.showVideoDialog = true;
  }

  async startBroadcast() {
    const url = this.videoInput.trim();
    if (!url) return;
    this.showVideoDialog = false;

    const id = this.parseYouTubeId(url);
    // Mount the host's own player right away so it never depends on the
    // round-trip echo (which can be dropped on mobile / flaky connections).
    if (id) {
      this.startPlayer({
        videoId: id,
        url,
        startedBy: this.auth.currentUser()?.username || 'Host',
        isPlaying: true,
        positionSeconds: 0
      });
    }

    try {
      await this.signalR.broadcastVideo(this.roomId, url);
    } catch { }
  }

  private parseYouTubeId(url: string): string | null {
    if (!url) return null;
    url = url.trim();
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null;
  }

  async stopBroadcast() {
    try {
      await this.signalR.stopVideo(this.roomId);
    } catch { }
    this.clearPlayer();
  }

  private clearPlayer() {
    this.broadcastVideoId = undefined;
    this.broadcastUrl = undefined;
    this.broadcastStartedBy = undefined;
    this.showPlayOverlay = false;
    try { this.ytPlayer?.destroy?.(); } catch { }
    this.ytPlayer = undefined;
  }

  private startPlayer(data: any) {
    this.clearPlayer();
    this.broadcastVideoId = data.videoId;
    this.broadcastUrl = data.url;
    this.broadcastStartedBy = data.startedBy;

    const create = (attempt = 0) => {
      const el = document.getElementById(this.ytElementId);
      if (!el) {
        if (attempt < 40) setTimeout(() => create(attempt + 1), 25);
        return;
      }
      this.ytPlayerSvc.createPlayer(this.ytElementId, data.videoId, {
        onReady: (event: any) => {
          this.ytPlayer = event.target;
          this.broadcastMuted = true;
          try { this.ytPlayer.mute(); } catch { }
          const start = data.positionSeconds || 0;
          if (data.isPlaying) {
            this.ignoreState = true;
            try { this.ytPlayer.seekTo(start, true); } catch { }
            try { this.ytPlayer.playVideo(); } catch { }
          }
          // iOS blocks muted autoplay unless it's inside a user gesture; the
          // async onReady call stack doesn't count, so surface a tap-to-play.
          setTimeout(() => {
            try {
              if ((this.ytPlayer?.getPlayerState?.() ?? -1) !== 1) this.showPlayOverlay = true;
            } catch { this.showPlayOverlay = true; }
          }, 700);
        },
        onStateChange: (state: number) => {
          if (state === 1) this.showPlayOverlay = false;
          if (this.applyingRemote) return;
          if (this.ignoreState) { this.ignoreState = false; return; }
          if (!this.isHost) return;
          const pos = this.ytPlayer?.getCurrentTime?.() ?? 0;
          if (state === 1) this.signalR.controlVideo(this.roomId, 'play', pos);
          else if (state === 2) this.signalR.controlVideo(this.roomId, 'pause', pos);
        }
      }).then(p => { this.ytPlayer = p; }).catch(() => { });
    };
    create();
  }

  userPlay() {
    this.showPlayOverlay = false;
    try { this.ytPlayer?.playVideo(); } catch { }
  }

  hostPlay() {
    if (!this.ytPlayer) return;
    this.ignoreState = true;
    setTimeout(() => { this.ignoreState = false; }, 1200);
    try { this.ytPlayer.playVideo(); } catch { }
    this.signalR.controlVideo(this.roomId, 'play', this.ytPlayer.getCurrentTime?.() ?? 0).catch(() => { });
  }

  hostPause() {
    if (!this.ytPlayer) return;
    this.ignoreState = true;
    setTimeout(() => { this.ignoreState = false; }, 1200);
    try { this.ytPlayer.pauseVideo(); } catch { }
    this.signalR.controlVideo(this.roomId, 'pause', this.ytPlayer.getCurrentTime?.() ?? 0).catch(() => { });
  }

  hostSeek(delta: number) {
    if (!this.ytPlayer) return;
    const pos = Math.max(0, (this.ytPlayer.getCurrentTime?.() ?? 0) + delta);
    this.ignoreState = true;
    setTimeout(() => { this.ignoreState = false; }, 1200);
    try { this.ytPlayer.seekTo(pos, true); } catch { }
    this.signalR.controlVideo(this.roomId, 'seek', pos).catch(() => { });
  }

  toggleMute() {
    if (!this.ytPlayer) return;
    if (this.broadcastMuted) {
      try { this.ytPlayer.unMute(); } catch { }
      this.broadcastMuted = false;
    } else {
      try { this.ytPlayer.mute(); } catch { }
      this.broadcastMuted = true;
    }
  }

  private applyControl(data: any) {
    if (!this.ytPlayer) return;
    this.applyingRemote = true;
    const pos = data.positionSeconds || 0;
    try {
      if (data.action === 'pause') {
        this.ytPlayer.pauseVideo();
      } else {
        this.ytPlayer.seekTo(pos, true);
        this.ytPlayer.playVideo();
      }
    } catch { } finally {
      setTimeout(() => { this.applyingRemote = false; }, 0);
    }
  }

  roomInviteLink(): string {
    return `${location.origin}/rooms/${this.roomId}?code=${this.room?.joinCode ?? ''}`;
  }

  meetingLink(): string {
    return `${location.origin}/rooms/${this.roomId}?meeting=1&code=${this.room?.joinCode ?? ''}`;
  }

  async copyRoomLink() {
    if (!this.room?.joinCode) { this.showSnack('Join code unavailable'); return; }
    await this.copyText(this.roomInviteLink(), 'Room invite link copied');
  }

  onBackgroundUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.roomId) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) { this.showSnack('Max 5MB'); return; }
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<{ url: string }>(`${environment.apiUrl}/rooms/${this.roomId}/background`, formData).subscribe({
      next: res => {
        if (this.room) this.room.backgroundUrl = res.url;
        this.showSnack('Background updated');
      },
      error: () => this.showSnack('Upload failed')
    });
    input.value = '';
  }

  formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  async copyMeetingLink() {
    if (!this.room?.joinCode) { this.showSnack('Join code unavailable'); return; }
    await this.copyText(this.meetingLink(), 'Meeting link copied');
  }

  async copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { }
      ta.remove();
    }
    this.showSnack(msg);
  }

  showSnack(msg: string) {
    this.snack = msg;
    setTimeout(() => { if (this.snack === msg) this.snack = ''; }, 2200);
  }

  startGuestCall() {
    this.activeTab = 'meet';
    this.inCall = true;
  }

  isFirstOfGroup(index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    const cur = this.messages[index];
    if (!prev || prev.userId !== cur.userId) return true;
    const prevTime = new Date(prev.createdAt).getTime();
    const curTime = new Date(cur.createdAt).getTime();
    return curTime - prevTime > 5 * 60 * 1000;
  }

  showDayDivider(index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    const cur = this.messages[index];
    if (!prev) return true;
    return new Date(prev.createdAt).toDateString() !== new Date(cur.createdAt).toDateString();
  }

  async ngOnInit() {
    this.isMobile = window.innerWidth <= 900;
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) return;

    this.tabBarSub = this.tabBar.select$.subscribe(id => this.selectTab(id));
    this.tabBar.setActiveRoom(this);

    this.nowTicker = setInterval(() => {
      this.now = Date.now();
    }, 30000);

    try {
      this.room = await this.roomService.getById(this.roomId).toPromise();
      if (!this.room) { this.router.navigate(['/rooms']); return; }

      const userId = this.auth.currentUser()?.id;
      const members = await this.roomService.getMembers(this.roomId).toPromise();
      this.members = members || [];
      this.isMember = members?.some(m => m.id === userId) || false;
      this.pushTabBarState();

      const qp = this.route.snapshot.queryParamMap;
      this.inviteCode = qp.get('code');
      if (qp.get('meeting') === '1' && this.inviteCode) {
        this.guestMeeting = true;
        this.guestCode = this.inviteCode;
      }

      if (this.isMember) {
        await this.loadChat();
        await this.loadNotes();
        await this.loadMeetings();
        await this.loadOtherMeetings();
        await this.loadLeaderboard();
        await this.setupSignalR();
        await this.loadReviewQueue();
      }
    } catch { } finally {
      this.loading = false;
    }
  }

  async loadMeetings() {
    try {
      this.meetings = await this.meetingService.getForRoom(this.roomId).toPromise() || [];
      this.pushTabBarState();
    } catch { }
  }

  async loadOtherMeetings() {
    try {
      this.otherMeetings = await this.meetingService.getOtherRoomMeetings(this.roomId).toPromise() || [];
    } catch { }
  }

  async loadLeaderboard() {
    try {
      const [lb, cs] = await Promise.all([
        this.statsService.getRoomLeaderboard(this.roomId).toPromise(),
        this.statsService.getRoomCollectiveStats(this.roomId).toPromise()
      ]);
      this.leaderboard = lb || [];
      this.collectiveStats = cs || null;
    } catch { }
  }

  async acceptMeeting(meeting: Meeting) {
    try {
      const updated = await this.meetingService
        .setAttendance(meeting, meeting.acceptedByMe ? 'Declined' : 'Accepted')
        .toPromise();
      Object.assign(meeting, updated);
    } catch { }
  }

  openScheduleDialog() {
    this.scheduleTitle = '';
    this.scheduleDescription = '';
    this.scheduleDuration = 60;
    this.scheduleError = '';
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getMinutes() % 5);
    this.scheduleAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.showScheduleDialog = true;
  }

  startCallChoice() {
    this.showLiveChooser = false;
    this.toggleCall();
  }

  broadcastChoice() {
    this.showLiveChooser = false;
    this.openVideoDialog();
  }

  scheduleChoice() {
    this.showLiveChooser = false;
    this.openScheduleDialog();
  }

  async scheduleMeeting() {
    if (!this.scheduleTitle?.trim() || !this.scheduleAt) {
      this.scheduleError = 'Please enter a title and time.';
      return;
    }
    const when = new Date(this.scheduleAt);
    if (isNaN(when.getTime())) {
      this.scheduleError = 'Please pick a valid date and time.';
      return;
    }
    this.scheduling = true;
    this.scheduleError = '';
    try {
      await this.meetingService.create(this.roomId, {
        title: this.scheduleTitle.trim(),
        description: this.scheduleDescription.trim() || undefined,
        scheduledAt: when.toISOString(),
        durationMinutes: this.scheduleDuration
      }).toPromise();
      this.showScheduleDialog = false;
      await this.loadMeetings();
    } catch (err: any) {
      this.scheduleError = err.error?.error || 'Failed to schedule meeting. Please try again.';
    } finally {
      this.scheduling = false;
    }
  }

  async deleteMeeting(meeting: Meeting) {
    if (!confirm(`Delete meeting "${meeting.title}"?`)) return;
    try {
      await this.meetingService.delete(this.roomId, meeting.id).toPromise();
      this.meetings = this.meetings.filter(m => m.id !== meeting.id);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to delete meeting.');
    }
  }

  canDeleteMeeting(meeting: Meeting): boolean {
    const me = this.auth.currentUser();
    const myName = me?.username || me?.email || '';
    if (meeting.createdByUsername === myName) return true;
    return this.myRole === 'host' || this.myRole === 'cohost';
  }

  async loadChat() {
    try {
      this.messages = await this.chatService.getMessages(this.roomId).toPromise() || [];
      this.scrollToBottom();
    } catch { }
  }

  private scrollToBottom() {
    setTimeout(() => {
      try {
        const el = this.messageContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch { }
    }, 0);
  }

  async loadNotes() {
    try {
      const notes = await this.notesService.getNotes(this.roomId).toPromise();
      if (notes) this.notesContext = notes.content;
    } catch { }
    this.notesSub = this.signalR.notesUpdated$.subscribe(data => {
      if (data.roomId === this.roomId) this.notesContext = data.content;
    });
  }

  async setupSignalR() {
    try {
      await this.signalR.startConnection();

      this.signalR.message$.subscribe(msg => {
        if (msg.roomId === this.roomId) {
          this.messages = [...this.messages, msg];
          if (this.activeTab === 'chat') {
            this.scrollToBottom();
          } else {
            this.unreadCount++;
            this.pushTabBarState();
          }
        }
      });

      this.signalR.onlineUsers$.subscribe(users => {
        this.onlineUsers = users;
      });

      this.focusSub = this.signalR.focusCountUpdated$.subscribe((data: any) => {
        if (data.roomId === this.roomId) {
          this.focusCount = data.focusCount;
        }
      });

      this.videoSubs.push(
        this.signalR.videoBroadcast$.subscribe(data => {
          if (data.roomId === this.roomId) this.startPlayer(data);
        }),
        this.signalR.videoControl$.subscribe(data => {
          if (data.roomId === this.roomId) this.applyControl(data);
        }),
        this.signalR.videoStopped$.subscribe(data => {
          if (data.roomId === this.roomId) this.clearPlayer();
        })
      );

      // Subscribe BEFORE joining: JoinRoom syncs the current broadcast to the
      // caller, and that message would be missed if we subscribed afterwards.
      await this.signalR.joinRoom(this.roomId);
    } catch { }
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;

    try {
      await this.signalR.sendMessage(this.roomId, this.newMessage);
      this.newMessage = '';
    } catch { }
  }

  async joinRoom() {
    this.joining = true;
    try {
      if (this.room?.isPrivate) {
        const code = this.inviteCode ?? prompt('Enter join code:');
        if (!code) { this.joining = false; return; }
        await this.roomService.join(this.roomId, code).toPromise();
      } else {
        await this.roomService.join(this.roomId).toPromise();
      }

      this.isMember = true;
      await this.loadChat();
      await this.setupSignalR();
      this.pushTabBarState();
    } catch (err: any) {
      alert(err.error?.error || 'Failed to join room.');
    } finally {
      this.joining = false;
    }
  }

  async leaveRoom() {
    if (!confirm('Leave this room?')) return;

    try {
      this.inCall = false;
      await this.signalR.leaveRoom(this.roomId);
      await this.roomService.leave(this.roomId).toPromise();
      this.isMember = false;
      this.messages = [];
      this.pushTabBarState();
      this.router.navigate(['/rooms']);
    } catch { }
  }

  get invitableFriends(): Friend[] {
    const memberIds = new Set(this.members.map(m => m.id));
    return this.friends.filter(f => !memberIds.has(f.userId));
  }

  async openInviteDialog(): Promise<void> {
    this.showInviteDialog = true;
    if (this.friends.length === 0) {
      try {
        this.friends = (await this.friendService.getFriends().toPromise()) || [];
      } catch { }
    }
  }

  async inviteFriend(friend: Friend): Promise<void> {
    this.invitingId = friend.userId;
    try {
      await this.invitationService.invite(this.roomId, friend.userId).toPromise();
      this.friends = this.friends.filter(f => f.userId !== friend.userId);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to invite friend.');
    } finally {
      this.invitingId = '';
    }
  }

  ngOnDestroy() {
    this.notesSub?.unsubscribe();
    this.focusSub?.unsubscribe();
    this.tabBarSub?.unsubscribe();
    this.videoSubs.forEach(s => s?.unsubscribe());
    if (this.nowTicker) clearInterval(this.nowTicker);
    this.inCall = false;
    this.tabBar.setState(null);
    this.tabBar.setActiveRoom(null);
    try { this.ytPlayer?.destroy?.(); } catch { }
    if (this.isMember) {
      this.signalR.leaveRoom(this.roomId);
    }
  }
}
