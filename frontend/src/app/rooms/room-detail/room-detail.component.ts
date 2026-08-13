import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass, NgTemplateOutlet, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RoomService } from '../../core/services/room.service';
import { MeetingService } from '../../core/services/meeting.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { NotesService } from '../../core/services/notes.service';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';
import { FriendService } from '../../core/services/friend.service';
import { Room } from '../../shared/models/room.model';
import { Meeting } from '../../shared/models/meeting.model';
import { Message } from '../../shared/models/message.model';
import { UserDto } from '../../shared/models/room.model';
import { Friend } from '../../shared/models/social.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { NotesEditorComponent } from '../../notes/notes-editor/notes-editor.component';
import { PomodoroTimerComponent } from '../../timer/pomodoro-timer/pomodoro-timer.component';
import { AiChatPanelComponent } from '../../ai/ai-chat-panel/ai-chat-panel.component';

interface RoomTab { id: string; label: string; icon: string; }

const TABS: RoomTab[] = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'focus', label: 'Focus', icon: 'timer' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'meet', label: 'Meet', icon: 'videocam' }
];

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, NgTemplateOutlet, DatePipe, FormsModule, RouterLink, LoadingComponent, NotesEditorComponent, PomodoroTimerComponent, AiChatPanelComponent],
  template: `
    <div class="room-detail">
      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="room-header">
        <div class="room-info">
          <a routerLink="/rooms" class="back-link">
            <span class="material-icons">arrow_back</span>
            <span class="back-label">Rooms</span>
          </a>
          <h1>{{ room?.name }}</h1>
          <div class="room-badges">
            <span class="subject-badge">{{ room?.subject || 'General' }}</span>
            <span class="members-badge">{{ room?.memberCount }} members</span>
            <span *ngIf="room?.isPrivate" class="private-badge">Private</span>
          </div>
          <p class="room-description" *ngIf="room?.description">{{ room?.description }}</p>
        </div>
        <div class="room-actions" *ngIf="!isMobile">
          <button *ngIf="!isMember" class="btn-primary" (click)="joinRoom()" [disabled]="joining">
            {{ joining ? 'Joining...' : 'Join Room' }}
          </button>
          <button *ngIf="isMember" class="btn-call" (click)="toggleCall()">
            <span class="material-icons">{{ inCall ? 'call_end' : 'videocam' }}</span>
            {{ inCall ? 'End Call' : 'Start Call' }}
          </button>
          <button *ngIf="isMember" class="btn-primary schedule-btn" (click)="openScheduleDialog()">
            <span class="material-icons">event_available</span>
            Schedule
          </button>
          <button *ngIf="isMember" class="btn-outline-danger" (click)="leaveRoom()">Leave</button>
        </div>
      </div>

      <div class="room-content" *ngIf="isMember">
        <!-- ── Members ───────────────────────────────────────── -->
        <div class="members-bar">
          <span class="members-title" *ngIf="!isMobile">Members ({{ members.length }})</span>
          <div class="members-avatars" [class.scrollable]="isMobile">
            <div *ngFor="let member of members" class="member-chip" [title]="member.username">
              <div class="member-avatar" [class.has-image]="member.avatarUrl">
                <img *ngIf="member.avatarUrl; else memberInitial" [src]="member.avatarUrl" alt="" />
                <ng-template #memberInitial>{{ member.username.charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="member-name" *ngIf="!isMobile">{{ member.username }}</span>
            </div>
            <button class="invite-chip" (click)="openInviteDialog()">
              <span class="material-icons">person_add</span>
              <span class="invite-chip-label">{{ isMobile ? 'Invite' : '' }}</span>
            </button>
          </div>
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

        <!-- ── Unified tab body (all devices) ────────────────── -->
        <div class="tab-body" [class.tab-body-bottom-pad]="isMobile">
          <div *ngIf="activeTab === 'chat'" class="tab-pane chat-pane">
            <div class="panel-header">
              <h2>Chat</h2>
              <span class="online-count">{{ onlineUsers.length }} online</span>
            </div>
            <ng-container *ngTemplateOutlet="chatBody" />
          </div>

          <div *ngIf="activeTab === 'focus'" class="tab-pane focus-pane">
            <div class="mobile-panel-title">
              <span class="material-icons">timer</span> Focus Timer
            </div>
            <app-pomodoro-timer [roomId]="roomId" />
          </div>

          <div *ngIf="activeTab === 'notes'" class="tab-pane notes-pane">
            <div class="mobile-panel-title">
              <span class="material-icons">edit_note</span> Notes
            </div>
            <app-notes-editor [roomId]="roomId" />
          </div>

          <div *ngIf="activeTab === 'ai'" class="tab-pane ai-pane">
            <div class="mobile-panel-title">
              <span class="material-icons">auto_awesome</span> AI Assistant
            </div>
            <app-ai-chat-panel [subject]="room?.subject || ''" [notesContext]="notesContext" />
          </div>

          <div *ngIf="activeTab === 'meet'" class="tab-pane meet-pane">
            <div class="mobile-panel-title">
              <span class="material-icons">videocam</span> Meetings
            </div>
            <ng-container *ngTemplateOutlet="meetingsBody" />
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

      <!-- ── Shared templates ────────────────────────────────── -->
      <ng-template #chatBody>
        <div class="messages" #messageContainer>
          <ng-container *ngFor="let msg of messages; let i = index">
            <div class="day-divider" *ngIf="showDayDivider(i)">
              <span>{{ messages[i].createdAt | date:'mediumDate' }}</span>
            </div>
            <div class="message" [class.own]="msg.userId === currentUserId" [class.avatar-gap]="msg.userId === currentUserId || isFirstOfGroup(i)">
              <div class="message-avatar" *ngIf="msg.userId !== currentUserId && isFirstOfGroup(i)" [class.has-image]="msg.avatarUrl">
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
        <div class="meetings-panel" *ngIf="upcomingMeetings.length > 0">
          <div class="panel-header">
            <h2><span class="material-icons">event</span> Upcoming Meetings</h2>
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
          <p>No upcoming meetings yet.</p>
          <button class="btn-primary" (click)="openScheduleDialog()">Schedule a meeting</button>
        </div>
      </ng-template>

      <!-- ── Invite dialog ───────────────────────────────────── -->
      <div class="invite-dialog-backdrop" *ngIf="showInviteDialog" (click)="showInviteDialog = false">
        <div class="invite-dialog" (click)="$event.stopPropagation()">
          <div class="invite-dialog-header">
            <h3>Invite friends to {{ room?.name }}</h3>
            <button class="dialog-close" (click)="showInviteDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="invite-dialog-body">
            <p class="invite-hint" *ngIf="invitableFriends.length === 0">No friends to invite — everyone you know is already here!</p>
            <div *ngFor="let friend of invitableFriends" class="invite-row">
              <div class="member-avatar" [class.has-image]="friend.avatarUrl">
                <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
                <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="invite-name">{{ friend.displayName || friend.username }}</span>
              <button
                class="btn-invite"
                (click)="inviteFriend(friend)"
                [disabled]="friend.userId === invitingId"
              >{{ friend.userId === invitingId ? 'Inviting...' : 'Invite' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Schedule dialog ─────────────────────────────────── -->
      <div class="schedule-dialog-backdrop" *ngIf="showScheduleDialog" (click)="showScheduleDialog = false">
        <div class="schedule-dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>Schedule a meeting</h3>
            <button class="dialog-close" (click)="showScheduleDialog = false"><span class="material-icons">close</span></button>
          </div>
          <div class="dialog-body">
            <label class="field">Title <input type="text" [(ngModel)]="scheduleTitle" placeholder="e.g. Final review" /></label>
            <label class="field">Description <input type="text" [(ngModel)]="scheduleDescription" placeholder="Optional" /></label>
            <label class="field">When <input type="datetime-local" [(ngModel)]="scheduleAt" /></label>
            <label class="field">Duration
              <select [(ngModel)]="scheduleDuration">
                <option [ngValue]="15">15 minutes</option>
                <option [ngValue]="30">30 minutes</option>
                <option [ngValue]="45">45 minutes</option>
                <option [ngValue]="60">60 minutes</option>
                <option [ngValue]="90">90 minutes</option>
                <option [ngValue]="120">120 minutes</option>
              </select>
            </label>
            <button class="btn-primary dialog-submit" (click)="scheduleMeeting()" [disabled]="scheduling">
              {{ scheduling ? 'Scheduling...' : 'Schedule Meeting' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Call overlay ────────────────────────────────────── -->
      <div class="call-overlay" *ngIf="isMember && inCall">
        <div class="call-overlay-header">
          <h2><span class="live-dot"></span> {{ room?.name }}</h2>
          <button class="btn-primary end-call-btn" (click)="toggleCall()" title="End call"><span class="material-icons">call_end</span> <span class="end-call-label">End Call</span></button>
        </div>
        <iframe
          class="call-frame"
          [src]="callUrl"
          allow="camera; microphone; speaker-selection; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>

      <!-- ── Mobile FAB + tab bar ────────────────────────────── -->
      <div class="call-fab" *ngIf="isMobile && isMember && !inCall" (click)="toggleCall()">
        <span class="material-icons">videocam</span>
        <span class="fab-label">Call</span>
      </div>

      <nav class="mobile-tabbar" *ngIf="isMobile && isMember">
        <button
          *ngFor="let tab of tabs"
          class="tab-item"
          [class.active]="activeTab === tab.id"
          (click)="selectTab(tab.id)"
        >
          <span class="material-icons">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <span *ngIf="tab.id === 'chat' && unreadCount > 0" class="tab-item-badge">{{ unreadCount }}</span>
          <span *ngIf="tab.id === 'meet' && upcomingMeetings.length > 0" class="tab-item-badge">{{ upcomingMeetings.length }}</span>
        </button>
      </nav>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .room-detail { max-width: 1200px; margin: 0 auto; }

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

    .member-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: var(--font-11); overflow: hidden; flex-shrink: 0; }
    .member-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .member-name { font-size: var(--font-12); color: var(--text-primary); }

    .invite-chip {
      display: flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px;
      background: transparent; border: 1px dashed var(--primary); color: var(--primary);
      font-size: var(--font-12); font-weight: 600; cursor: pointer; flex-shrink: 0;
    }
    .invite-chip:hover { background: rgba(56, 189, 248, 0.1); }
    .invite-chip .material-icons { font-size: var(--font-16); }

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

    .online-count { font-size: var(--font-12); color: var(--success); }

    .chat-pane { height: 600px; }
    .chat-pane .chat-input { border-top: 1px solid var(--border); }
    .notes-pane { height: 600px; }
    .notes-pane ::ng-deep app-notes-editor { flex: 1; display: flex; flex-direction: column; }
    .ai-pane { height: 600px; }
    .ai-pane ::ng-deep app-ai-chat-panel { flex: 1; display: flex; flex-direction: column; height: 100%; }
    .focus-pane { padding: 16px; }

    /* ── Chat ───────────────────────────────────────────────── */
    .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 2px; }

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

    .schedule-mini {
      display: flex; align-items: center; gap: 4px; padding: 6px 12px;
      background: transparent; border: 1px solid var(--primary); border-radius: 8px;
      color: var(--primary); font-size: var(--font-12); font-weight: 600; cursor: pointer;
    }
    .schedule-mini:hover { background: rgba(56, 189, 248, 0.1); }
    .schedule-mini .material-icons { font-size: var(--font-16); }

    .meetings-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 16px; text-align: center; color: var(--text-muted); }
    .meetings-empty .material-icons { font-size: 40px; color: var(--text-muted); }
    .meetings-empty p { font-size: var(--font-13); }

    /* ── Dialogs ────────────────────────────────────────────── */
    .invite-dialog-backdrop, .schedule-dialog-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
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

    .dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); }
    .field input, .field select { padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .field input:focus, .field select:focus { border-color: var(--primary); }
    .dialog-submit { width: 100%; padding: 12px; justify-content: center; }

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

    /* ── Mobile ─────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .room-detail { max-width: 100%; }

      .room-header { border-radius: 0; border-left: 0; border-right: 0; border-top: 0; padding: 16px; margin-bottom: 0; }
      .back-label { display: none; }
      .back-link { margin-bottom: 8px; }
      .room-info h1 { font-size: var(--font-18); }

      .room-content { margin-top: 12px; }

      .members-bar { border-radius: 0; border-left: 0; border-right: 0; padding: 10px 16px; margin-bottom: 12px; }
      .member-chip { padding: 3px; }
      .member-avatar { width: 34px; height: 34px; font-size: var(--font-13); }
      .invite-chip { padding: 8px 12px; }

      .next-meeting { margin: 0 12px 12px; border-radius: 14px; }

      .tab-body { min-height: 0; height: calc(100vh - 190px); margin: 0 12px 84px; border-radius: 14px; }
      .tab-body-bottom-pad { margin-bottom: 84px; }
      .tab-pane { border-radius: 14px; height: 100%; }

      .mobile-panel-title { display: flex; align-items: center; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
      .mobile-panel-title .material-icons { font-size: var(--font-18); color: var(--accent); }

      .notes-pane ::ng-deep app-notes-editor { flex: 1; display: flex; flex-direction: column; height: auto; }
      .ai-pane ::ng-deep app-ai-chat-panel { flex: 1; display: flex; flex-direction: column; height: auto; }
      .meetings-panel, .meetings-empty { margin-bottom: 0; border-radius: 14px; }

      /* Floating call button */
      .call-fab {
        position: fixed; right: 16px; bottom: 92px; z-index: 1100;
        display: flex; align-items: center; gap: 6px;
        padding: 14px 18px; background: var(--success); color: white;
        border: none; border-radius: 28px; box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
        font-size: var(--font-13); font-weight: 700; cursor: pointer;
      }
      .call-fab:active { transform: scale(0.96); }
      .call-fab .material-icons { font-size: var(--font-20); }

      /* Bottom tab bar */
      .mobile-tabbar {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 1150;
        display: flex; background: var(--surface);
        border-top: 1px solid var(--border);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .tab-item {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: 8px 0 10px; background: none; border: none; cursor: pointer;
        color: var(--text-muted); transition: color 0.15s; position: relative;
      }
      .tab-item .material-icons { font-size: var(--font-22); margin-bottom: 2px; }
      .tab-label { font-size: var(--font-10); font-weight: 600; }
      .tab-item.active { color: var(--accent); }
      .tab-item-badge {
        position: absolute; top: 4px; left: 50%; transform: translateX(6px);
        min-width: 16px; height: 16px; border-radius: 8px;
        background: var(--error); color: white;
        font-size: var(--font-9); font-weight: 700;
        display: flex; align-items: center; justify-content: center; padding: 0 3px;
      }

      .invite-dialog, .schedule-dialog { width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; max-height: 90vh; }
      .invite-dialog-backdrop, .schedule-dialog-backdrop { align-items: flex-end; }

      .call-overlay-header { padding: 10px 12px; }
      .end-call-label { display: none; }
    }

    @media (max-width: 1200px) and (min-width: 901px) {
      .chat-pane, .notes-pane, .ai-pane { height: 520px; }
    }
  `]
})
export class RoomDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private meetingService = inject(MeetingService);
  private signalR = inject(SignalRService);
  private chatService = inject(ChatService);
  private notesService = inject(NotesService);
  private auth = inject(AuthService);
  private invitationService = inject(InvitationService);
  private friendService = inject(FriendService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('messageContainer', { static: false }) messageContainer?: ElementRef;

  roomId = '';
  room?: Room;
  messages: Message[] = [];
  members: UserDto[] = [];
  onlineUsers: string[] = [];
  newMessage = '';
  isMember = false;
  joining = false;
  loading = true;
  notesContext = '';
  showInviteDialog = false;
  friends: Friend[] = [];
  invitingId = '';
  inCall = false;
  meetings: Meeting[] = [];
  showScheduleDialog = false;
  scheduleTitle = '';
  scheduleDescription = '';
  scheduleAt = '';
  scheduleDuration = 60;
  scheduling = false;

  isMobile = false;
  activeTab = 'chat';
  tabs: RoomTab[] = TABS;
  unreadCount = 0;
  now = Date.now();
  private nowTicker?: any;

  private notesSub?: Subscription;

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

  private cachedCallUrl?: SafeResourceUrl;

  get callUrl(): SafeResourceUrl {
    if (!this.cachedCallUrl) {
      const user = this.auth.currentUser();
      const name = encodeURIComponent(user?.username || user?.email || 'Student');
      const room = encodeURIComponent(`studyroom-${this.roomId}`);
      this.cachedCallUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://sfu.mirotalk.com/join?room=${room}&name=${name}&audio=1&video=1&screen=1&duration=unlimited`
      );
    }
    return this.cachedCallUrl;
  }

  toggleCall() {
    this.inCall = !this.inCall;
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

      if (this.isMember) {
        await this.loadChat();
        await this.loadNotes();
        await this.loadMeetings();
        await this.setupSignalR();
      }
    } catch { } finally {
      this.loading = false;
    }
  }

  async loadMeetings() {
    try {
      this.meetings = await this.meetingService.getForRoom(this.roomId).toPromise() || [];
    } catch { }
  }

  openScheduleDialog() {
    this.scheduleTitle = '';
    this.scheduleDescription = '';
    this.scheduleDuration = 60;
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getMinutes() % 5);
    this.scheduleAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.showScheduleDialog = true;
  }

  async scheduleMeeting() {
    if (!this.scheduleTitle.trim() || !this.scheduleAt) {
      alert('Please enter a title and time.');
      return;
    }
    this.scheduling = true;
    try {
      const utc = new Date(this.scheduleAt).toISOString();
      await this.meetingService.create(this.roomId, {
        title: this.scheduleTitle.trim(),
        description: this.scheduleDescription.trim() || undefined,
        scheduledAt: utc,
        durationMinutes: this.scheduleDuration
      }).toPromise();
      this.showScheduleDialog = false;
      await this.loadMeetings();
    } catch (err: any) {
      alert(err.error?.error || 'Failed to schedule meeting.');
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
    return meeting.createdByUsername === (this.auth.currentUser()?.username || this.auth.currentUser()?.email);
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
      await this.signalR.joinRoom(this.roomId);

      this.signalR.message$.subscribe(msg => {
        if (msg.roomId === this.roomId) {
          this.messages = [...this.messages, msg];
          if (this.activeTab === 'chat') {
            this.scrollToBottom();
          } else {
            this.unreadCount++;
          }
        }
      });

      this.signalR.onlineUsers$.subscribe(users => {
        this.onlineUsers = users;
      });
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
        const code = prompt('Enter join code:');
        if (!code) { this.joining = false; return; }
        await this.roomService.join(this.roomId, code).toPromise();
      } else {
        await this.roomService.join(this.roomId).toPromise();
      }

      this.isMember = true;
      await this.loadChat();
      await this.setupSignalR();
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
    if (this.nowTicker) clearInterval(this.nowTicker);
    this.inCall = false;
    if (this.isMember) {
      this.signalR.leaveRoom(this.roomId);
    }
  }
}
