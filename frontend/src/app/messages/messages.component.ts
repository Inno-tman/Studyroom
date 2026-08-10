import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { SignalRService } from '../core/services/signalr.service';
import { DirectMessageService } from '../core/services/direct-message.service';
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
        <div class="conversations">
          <div *ngIf="conversations.length === 0" class="empty">No conversations yet. Message your friends!</div>
          <button
            *ngFor="let convo of conversations"
            class="convo-item"
            [class.active]="convo.userId === activeUserId"
            (click)="openConversation(convo.userId)"
          >
            <div class="convo-avatar" [class.has-image]="convo.avatarUrl">
              <img *ngIf="convo.avatarUrl; else convoInitial" [src]="convo.avatarUrl" alt="" />
              <ng-template #convoInitial>{{ (convo.displayName || convo.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="convo-info">
              <span class="convo-name">{{ convo.displayName || convo.username }}</span>
              <span class="convo-last">{{ convo.lastMessage ? convo.lastMessage : 'No messages yet' }}</span>
            </div>
          </button>
        </div>

        <div class="chat-area">
          <div *ngIf="!activeUser" class="chat-placeholder">
            Select a conversation to start chatting.
          </div>

          <ng-container *ngIf="activeUser">
            <div class="chat-header">
              <div class="convo-avatar" [class.has-image]="activeUser.avatarUrl">
                <img *ngIf="activeUser.avatarUrl; else activeInitial" [src]="activeUser.avatarUrl" alt="" />
                <ng-template #activeInitial>{{ (activeUser.displayName || activeUser.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="chat-title">{{ activeUser.displayName || activeUser.username }}</span>
            </div>

            <div class="messages" #messageContainer>
              <div
                *ngFor="let msg of messages"
                class="bubble"
                [class.mine]="msg.senderId === myId"
              >
                <p>{{ msg.content }}</p>
                <span class="bubble-time">{{ msg.createdAt | date: 'shortTime' }}</span>
              </div>
              <div *ngIf="messages.length === 0" class="empty">Say hello!</div>
            </div>

            <div class="chat-input">
              <input
                type="text"
                [(ngModel)]="newMessage"
                (keyup.enter)="send()"
                placeholder="Type a messageâ€¦"
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
      display: flex; height: calc(100vh - 140px); min-height: 480px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
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

    .convo-avatar {
      width: 42px; height: 42px; border-radius: 50%; background: var(--primary);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: white; overflow: hidden; flex-shrink: 0;
    }
    .convo-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .convo-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .convo-name { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .convo-last { font-size: var(--font-12); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .chat-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }

    .chat-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }

    .chat-header {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .chat-header .convo-avatar { width: 36px; height: 36px; }
    .chat-title { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }

    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }

    .bubble { max-width: 70%; padding: 10px 14px; border-radius: 12px; align-self: flex-start; background: var(--background); border: 1px solid var(--border); }
    .bubble p { font-size: var(--font-14); color: var(--text-primary); word-wrap: break-word; white-space: pre-wrap; }
    .bubble-time { display: block; font-size: var(--font-11); color: var(--text-muted); margin-top: 4px; }
    .bubble.mine { align-self: flex-end; background: var(--primary); border-color: var(--primary); }
    .bubble.mine p { color: white; }
    .bubble.mine .bubble-time { color: rgba(255,255,255,0.8); }

    .empty { color: var(--text-muted); font-size: var(--font-13); padding: 12px; text-align: center; }

    .chat-input { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }
    .chat-input input {
      flex: 1; padding: 10px 12px; background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: var(--font-14); outline: none;
    }
    .chat-input input:focus { border-color: var(--primary); }

    .send-btn {
      width: 38px; height: 38px; border-radius: 8px; background: var(--primary); border: none;
      color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .send-btn:hover { opacity: 0.85; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    @media (max-width: 768px) {
      .messages-layout { flex-direction: column; height: auto; }
      .conversations { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 200px; }
      .chat-area { height: 400px; }
    }
  `]
})
export class MessagesComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private signalR = inject(SignalRService);
  private dmService = inject(DirectMessageService);

  myId = this.auth.currentUser()?.id ?? '';
  conversations: Conversation[] = [];
  messages: DirectMessage[] = [];
  activeUserId = '';
  activeUser?: Conversation;
  newMessage = '';
  sending = false;
  private dmSub?: Subscription;

  async ngOnInit() {
    await this.signalR.startConnection();
    this.dmSub = this.signalR.directMessage$.subscribe(msg => {
      if (msg.senderId === this.activeUserId || msg.receiverId === this.activeUserId) {
        if (!this.messages.some(m => m.id && m.id === msg.id)) {
          this.messages = [...this.messages, msg];
        }
      }
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
  }

  ngOnDestroy(): void {
    this.dmSub?.unsubscribe();
  }
}
