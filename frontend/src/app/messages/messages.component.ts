import { Component, inject, OnDestroy, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { SignalRService } from '../core/services/signalr.service';
import { DirectMessageService } from '../core/services/direct-message.service';
import { NotificationService } from '../core/services/notification.service';
import { Conversation, DirectMessage } from '../shared/models/social.model';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <h1>Messages</h1>
      </div>

      <div class="messages-layout">
        <div class="conversations" [class.mobile-hidden]="isMobile && activeUser">
          <div *ngIf="conversations.length === 0" class="empty">No conversations yet. Message your friends!</div>
          <button
            *ngFor="let convo of conversations"
            class="convo-item"
            [class.active]="convo.userId === activeUserId"
            (click)="openConversation(convo.userId)"
          >
            <div class="avatar" [class.has-image]="convo.avatarUrl">
              <img *ngIf="convo.avatarUrl; else convoInitial" [src]="convo.avatarUrl" alt="" />
              <ng-template #convoInitial>{{ (convo.displayName || convo.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="convo-info">
              <div class="convo-top">
                <span class="convo-name">{{ convo.displayName || convo.username }}</span>
                <span *ngIf="(convo.unreadCount ?? 0) > 0" class="convo-unread">{{ convo.unreadCount }}</span>
              </div>
              <span class="convo-last">{{ convo.lastMessage ? convo.lastMessage : 'No messages yet' }}</span>
            </div>
          </button>
        </div>

        <div class="chat-area" [class.mobile-open]="isMobile && activeUser">
          <div *ngIf="!activeUser" class="chat-placeholder">
            Select a conversation to start chatting.
          </div>

          <ng-container *ngIf="activeUser">
            <div class="chat-header">
              <button class="back-btn" (click)="closeConversation()" aria-label="Back to conversations">
                <span class="material-icons">arrow_back</span>
              </button>
              <div class="chat-avatar" [class.has-image]="activeUser.avatarUrl">
                <img *ngIf="activeUser.avatarUrl; else activeInitial" [src]="activeUser.avatarUrl" alt="" />
                <ng-template #activeInitial>{{ (activeUser.displayName || activeUser.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <div class="chat-title-wrap">
                <span class="chat-title">{{ activeUser.displayName || activeUser.username }}</span>
              </div>
            </div>

<div class="messages" #messageContainer>
              <div *ngFor="let msg of messages" class="bubble-wrap" [class.mine]="msg.senderId === myId">
                <div class="bubble">
                  <p>{{ msg.content }}</p>
                  <span class="bubble-time">{{ msg.createdAt | date: 'shortTime' }}</span>
                </div>
                <button class="delete-msg" *ngIf="msg.senderId === myId" (click)="deleteMessage(msg)" title="Delete message" aria-label="Delete message">
                  <span class="material-icons">close</span>
                </button>
              </div>
              <div *ngIf="messages.length === 0" class="empty">Say hello!</div>
            </div>

            <div class="chat-input">
              <input
                type="text"
                [(ngModel)]="newMessage"
                (keyup.enter)="send()"
                placeholder="Type a message…"
                [disabled]="sending"
              />
              <button class="send-btn" (click)="send()" [disabled]="!newMessage.trim() || sending">
                <span class="material-icons">send</span>
              </button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .messages-page { max-width: 1100px; }

    .messages-layout {
      display: flex;
      height: calc(100vh - 140px);
      min-height: 400px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }

    .conversations {
      width: 280px; border-right: 1px solid var(--border); overflow-y: auto; flex-shrink: 0;
    }

    .convo-item {
      display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 12px 16px; background: none; border: none; border-bottom: 1px solid var(--border);
      cursor: pointer; text-align: left; transition: background 0.15s;
    }
    .convo-item:hover { background: var(--surface-hover); }
    .convo-item.active { background: var(--surface-hover); border-left: 3px solid var(--primary); }
    .convo-item .avatar { width: 42px; height: 42px; }

    .convo-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .convo-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .convo-name { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .convo-unread {
      margin-left: auto; background: var(--primary); color: white; font-size: var(--font-11); font-weight: 700;
      min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .convo-last { font-size: var(--font-12); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .chat-area {
      flex: 1; display: flex; flex-direction: column; min-width: 0;
      position: relative; height: 100%; overflow: hidden;
    }

    .back-btn {
      display: none; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      border: none; background: none; color: var(--text-primary); cursor: pointer;
    }
    .back-btn:hover { background: var(--surface-hover); }
    .back-btn .material-icons { font-size: var(--font-22); }

    .chat-placeholder {
      flex: 1; display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); font-size: var(--font-14);
    }

    .chat-header {
      display: flex; align-items: center; gap: 12px; padding: 10px 16px;
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .chat-avatar { width: 38px; height: 38px; flex-shrink: 0; }
    .chat-title-wrap { display: flex; align-items: center; min-width: 0; flex: 1; }
    .chat-title { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .messages {
      flex: 1 1 auto; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 8px; min-height: 0;
    }

    .bubble-wrap { display: flex; align-items: flex-end; gap: 6px; max-width: 70%; align-self: flex-start; }
    .bubble-wrap.mine { align-self: flex-end; flex-direction: row-reverse; }
    .bubble { padding: 8px 14px; border-radius: 14px; background: var(--background); border: 1px solid var(--border); }
    .bubble p { font-size: var(--font-14); color: var(--text-primary); word-wrap: break-word; white-space: pre-wrap; margin: 0; }
    .bubble-time { display: block; font-size: var(--font-11); color: var(--text-muted); margin-top: 4px; }
    .bubble-wrap.mine .bubble { background: var(--primary); border-color: var(--primary); }
    .bubble-wrap.mine .bubble p { color: white; }
    .bubble-wrap.mine .bubble-time { color: rgba(255,255,255,0.8); }

    .delete-msg {
      width: 24px; height: 24px; border-radius: 50%; border: none; background: none;
      color: var(--text-muted); cursor: pointer; font-size: var(--font-14);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      opacity: 0; transition: opacity 0.15s ease, color 0.15s ease;
    }
    .delete-msg .material-icons { font-size: var(--font-16); }
    .bubble-wrap:hover .delete-msg { opacity: 1; }
    .delete-msg:hover { background: rgba(255,0,0,0.1); color: var(--error); }

    .empty { color: var(--text-muted); font-size: var(--font-13); padding: 12px; text-align: center; }

    .chat-input {
      display: flex; align-items: center; gap: 8px; padding: 12px;
      border-top: 1px solid var(--border); flex-shrink: 0;
    }
    .chat-input input {
      flex: 1; padding: 10px 14px; background: var(--background); border: 1px solid var(--border);
      border-radius: 20px; color: var(--text-primary); font-size: var(--font-14); outline: none;
    }
    .chat-input input:focus { border-color: var(--primary); }

    .send-btn {
      width: 40px; height: 40px; border-radius: 50%; background: var(--primary); border: none;
      color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;
      flex-shrink: 0; transition: opacity 0.15s;
    }
    .send-btn:hover { opacity: 0.85; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    @media (max-width: 768px) {
      .messages-page { max-width: none; }
      .page-header { display: none; }
      .messages-layout {
        flex-direction: column;
        height: calc(100vh - 32px);
        border: none; border-radius: 0; min-height: 0;
      }
      .conversations { width: 100%; border-right: none; flex: 1 1 auto; height: 100%; overflow-y: auto; }
      .conversations.mobile-hidden { display: none; }
      .chat-area { display: none; border: none; }
      .chat-area.mobile-open { display: flex; flex: 1 1 auto; height: 100%; }
      .back-btn { display: inline-flex; }
      .messages { padding-top: 12px; }
    }
  `]
})
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  private auth = inject(AuthService);
  private signalR = inject(SignalRService);
  private dmService = inject(DirectMessageService);
  private notificationService = inject(NotificationService);
  @ViewChild('messageContainer') private messagesEl?: ElementRef;

  myId = this.auth.currentUser()?.id ?? '';
  conversations: Conversation[] = [];
  messages: DirectMessage[] = [];
  activeUserId = '';
  activeUser?: Conversation;
  newMessage = '';
  sending = false;
  isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  private dmSub?: Subscription;
  private deletedSub?: Subscription;
  private shouldScroll = false;

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        const el = this.messagesEl?.nativeElement as HTMLElement | undefined;
        if (el) el.scrollTop = el.scrollHeight;
      } catch { }
    }, 0);
  }

  async ngOnInit() {
    await this.signalR.startConnection();
    this.dmSub = this.signalR.directMessage$.subscribe(msg => {
      if (msg.senderId === this.activeUserId || msg.receiverId === this.activeUserId) {
        if (!this.messages.some(m => m.id && m.id === msg.id)) {
          this.messages = [...this.messages, msg];
          this.shouldScroll = true;
        }
      }
      this.loadConversations();
      this.notificationService.refreshMessagesUnread();
    });
    this.deletedSub = this.signalR.messageDeleted$.subscribe(id => {
      this.messages = this.messages.filter(m => m.id !== id);
      this.loadConversations();
    });
    await this.loadConversations();
  }

  async loadConversations(): Promise<void> {
    this.conversations = (await this.dmService.getConversations().toPromise()) || [];
  }

  async openConversation(userId: string): Promise<void> {
    this.activeUserId = userId;
    this.activeUser = this.conversations.find(c => c.userId === userId);
    this.messages = (await this.dmService.getConversation(userId).toPromise()) || [];
    this.conversations = this.conversations.map(c => c.userId === userId ? { ...c, unreadCount: 0 } : c);
    this.notificationService.refreshMessagesUnread();
    this.shouldScroll = true;
  }

  closeConversation(): void {
    this.activeUserId = '';
    this.activeUser = undefined;
    this.messages = [];
  }

  async send(): Promise<void> {
    const content = this.newMessage.trim();
    if (!content || !this.activeUserId) return;
    this.sending = true;
    try {
      await this.signalR.sendDirectMessage(this.activeUserId, content);
      this.newMessage = '';
      await this.loadConversations();
    } catch {
    } finally {
      this.sending = false;
    }
    this.shouldScroll = true;
  }

  async deleteMessage(msg: DirectMessage): Promise<void> {
    if (!msg.id) return;
    if (!confirm('Delete this message?')) return;
    await this.signalR.deleteDirectMessage(msg.id).catch(() => {});
    this.messages = this.messages.filter(m => m.id !== msg.id);
    await this.loadConversations();
  }

  ngOnDestroy(): void {
    this.dmSub?.unsubscribe();
    this.deletedSub?.unsubscribe();
  }
}
