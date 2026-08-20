import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FriendService } from '../core/services/friend.service';
import { Friend, UserSearchResult } from '../shared/models/social.model';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule],
  template: `
    <div class="people-page">
      <div class="page-header">
        <h1>People</h1>
        <p class="page-subtitle">Discover classmates, send requests and build your network.</p>
      </div>

      <div class="view-toggle">
        <button class="view-btn" [class.active]="mode === 'discover'" (click)="showDiscover()">
          <span class="material-icons">explore</span> Discover
        </button>
        <button class="view-btn" [class.active]="mode === 'friends'" (click)="mode = 'friends'">
          <span class="material-icons">group</span> Friends
        </button>
      </div>

      <!-- Search -->
      <div *ngIf="mode === 'discover'" class="card">
        <div class="card-head">
          <div class="card-head-icon"><span class="material-icons">search</span></div>
          <div>
            <h2>Find People</h2>
            <p class="card-subtitle">Search by name, username or school.</p>
          </div>
        </div>
        <div class="search-box">
          <span class="material-icons search-icon">search</span>
          <input
            type="text"
            [(ngModel)]="query"
            placeholder="Search by name, username or school…"
            (input)="search()"
          />
        </div>

        <div *ngIf="results.length > 0" class="results-wrap">
          <div *ngFor="let user of results" class="person-row">
            <div class="avatar" [class.has-image]="user.avatarUrl">
              <img *ngIf="user.avatarUrl; else initial" [src]="user.avatarUrl" alt="" />
              <ng-template #initial>{{ (user.displayName || user.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ user.displayName || user.username }}</span>
              <span class="person-sub">{{ '@' + user.username }}{{ user.schoolName ? ' · ' + user.schoolName : '' }}</span>
            </div>
            <div class="row-actions">
              <button
                *ngIf="user.relationship === 'None'"
                class="btn-primary"
                (click)="sendRequest(user)"
              >
                Add Friend
              </button>
              <span *ngIf="user.relationship === 'RequestSent'" class="status-label">Request Sent</span>
              <button
                *ngIf="user.relationship === 'RequestReceived'"
                class="btn-accent"
                (click)="acceptFromSearch(user)"
              >
                Accept Request
              </button>
              <span *ngIf="user.relationship === 'Friends'" class="status-label friends">Friends</span>
            </div>
          </div>
        </div>
        <div *ngIf="query && !loading && results.length === 0" class="empty">No people found.</div>
      </div>

      <!-- Discover -->
      <div *ngIf="mode === 'discover' && suggestions.length > 0" class="card">
        <div class="card-head">
          <div class="card-head-icon"><span class="material-icons">explore</span></div>
          <div>
            <h2>Discover</h2>
            <p class="card-subtitle">People you may know first, then others worth connecting with.</p>
          </div>
          <span class="discover-count">{{ suggestions.length }} people</span>
        </div>
        <div *ngFor="let user of suggestions" class="person-row">
          <div class="avatar" [class.has-image]="user.avatarUrl">
            <img *ngIf="user.avatarUrl; else sugInitial" [src]="user.avatarUrl" alt="" />
            <ng-template #sugInitial>{{ (user.displayName || user.username).charAt(0).toUpperCase() }}</ng-template>
          </div>
          <div class="person-info">
            <span class="person-name">{{ user.displayName || user.username }}</span>
            <span class="person-sub">{{ '@' + user.username }}</span>
            <span *ngIf="user.reason" class="person-reason">{{ user.reason }}</span>
          </div>
          <button
            *ngIf="user.relationship === 'None'"
            class="btn-primary"
            (click)="sendRequest(user)"
          >
            Add Friend
          </button>
          <span *ngIf="user.relationship === 'RequestSent'" class="status-label">Request Sent</span>
        </div>
      </div>

      <div class="cards-row">
        <!-- Friend Requests -->
        <div *ngIf="mode === 'friends'" class="card">
          <div class="card-head">
            <div class="card-head-icon"><span class="material-icons">person_add</span></div>
            <div>
              <h2>Friend Requests</h2>
              <p class="card-subtitle">Pending requests you can accept or decline.</p>
            </div>
          </div>
          <div *ngIf="requests.length === 0" class="empty">No pending requests.</div>
          <div *ngFor="let req of requests" class="person-row">
            <div class="avatar" [class.has-image]="req.avatarUrl">
              <img *ngIf="req.avatarUrl; else reqInitial" [src]="req.avatarUrl" alt="" />
              <ng-template #reqInitial>{{ (req.displayName || req.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ req.displayName || req.username }}</span>
              <span class="person-sub">{{ '@' + req.username }}</span>
            </div>
            <div class="row-actions">
              <button class="btn-accent" (click)="accept(req)">Accept</button>
              <button class="btn-secondary" (click)="decline(req)">Decline</button>
            </div>
          </div>
        </div>

        <!-- Sent Requests -->
        <div *ngIf="mode === 'friends'" class="card">
          <div class="card-head">
            <div class="card-head-icon muted"><span class="material-icons">outgoing_mail</span></div>
            <div>
              <h2>Sent Requests</h2>
              <p class="card-subtitle">Requests you've sent that are still pending.</p>
            </div>
          </div>
          <div *ngIf="sentRequests.length === 0" class="empty">You have no outgoing requests.</div>
          <div *ngFor="let req of sentRequests" class="person-row">
            <div class="avatar" [class.has-image]="req.avatarUrl">
              <img *ngIf="req.avatarUrl; else sentInitial" [src]="req.avatarUrl" alt="" />
              <ng-template #sentInitial>{{ (req.displayName || req.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ req.displayName || req.username }}</span>
              <span class="person-sub">{{ '@' + req.username }}{{ req.createdAt ? ' · sent ' + (req.createdAt | date:'mediumDate') : '' }}</span>
            </div>
            <div class="row-actions">
              <button class="btn-secondary" (click)="cancelRequest(req)">Cancel</button>
            </div>
          </div>
        </div>

        <!-- My Friends -->
        <div *ngIf="mode === 'friends'" class="card">
          <div class="card-head">
            <div class="card-head-icon"><span class="material-icons">group</span></div>
            <div>
              <h2>My Friends</h2>
              <p class="card-subtitle">People you're connected with.</p>
            </div>
          </div>
          <div *ngIf="friends.length === 0" class="empty">No friends yet. Add some people above!</div>
          <div *ngFor="let friend of friends" class="person-row">
            <div class="avatar" [class.has-image]="friend.avatarUrl">
              <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
              <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ friend.displayName || friend.username }}</span>
              <span class="person-sub">{{ '@' + friend.username }}</span>
            </div>
            <button class="btn-secondary danger" (click)="unfriend(friend)">Remove</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .people-page { max-width: 900px; margin: 0 auto; }

    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: var(--font-24); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .page-subtitle { font-size: var(--font-14); color: var(--text-secondary); }

    .view-toggle {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 24px;
    }
    .view-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: none;
      color: var(--text-secondary);
      padding: 9px 18px;
      border-radius: 8px;
      font-size: var(--font-14);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .view-btn .material-icons { font-size: var(--font-18); }
    .view-btn:hover { color: var(--text-primary); }
    .view-btn.active { background: var(--primary); color: white; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .card-head-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card-head-icon .material-icons { font-size: var(--font-22); }
    .card-head-icon.sent { background: var(--text-secondary); }
    .card-head h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin: 0; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin: 2px 0 0; }
    .discover-count {
      margin-left: auto; flex-shrink: 0;
      font-size: var(--font-12); font-weight: 600; color: var(--text-secondary);
      background: var(--background); border: 1px solid var(--border);
      padding: 4px 10px; border-radius: 12px;
    }

    .search-box {
      display: flex; align-items: center; gap: 10px;
      background: var(--background); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 14px;
    }
    .search-box:focus-within { border-color: var(--primary); }
    .search-icon { color: var(--text-muted); }
    .search-box input {
      flex: 1; background: none; border: none; color: var(--text-primary);
      font-size: var(--font-14); outline: none;
    }

    .results-wrap { margin-top: 8px; }

    .person-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 2px; border-bottom: 1px solid var(--border);
    }
    .person-row:last-child { border-bottom: none; }

    .person-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .person-name { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .person-sub { font-size: var(--font-13); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person-reason { font-size: var(--font-12); color: var(--primary); font-weight: 500; margin-top: 2px; }

    .row-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }

    .status-label { font-size: var(--font-13); color: var(--text-muted); font-weight: 500; }
    .status-label.friends { color: var(--success); }

    .cards-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .cards-row .card { margin-bottom: 0; }

    @media (max-width: 900px) {
      .cards-row { grid-template-columns: 1fr; }
      .cards-row .card { margin-bottom: 24px; }
    }
  `]
})
export class PeopleComponent implements OnInit {
  private friendService = inject(FriendService);

  query = '';
  results: UserSearchResult[] = [];
  suggestions: UserSearchResult[] = [];
  requests: Friend[] = [];
  sentRequests: Friend[] = [];
  friends: Friend[] = [];
  loading = false;
  mode: 'discover' | 'friends' = 'discover';
  private refreshTimer?: any;

  async ngOnInit() {
    await this.loadAll();
    this.refreshTimer = setInterval(() => this.loadSuggestions(), 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadRequests(), this.loadSentRequests(), this.loadFriends(), this.loadSuggestions()]);
  }

  async loadSuggestions(): Promise<void> {
    this.suggestions = (await this.friendService.getSuggestions().toPromise()) || [];
  }

  async showDiscover(): Promise<void> {
    this.mode = 'discover';
    await this.loadSuggestions();
  }

  async loadRequests(): Promise<void> {
    this.requests = (await this.friendService.getIncomingRequests().toPromise()) || [];
  }

  async loadSentRequests(): Promise<void> {
    this.sentRequests = (await this.friendService.getOutgoingRequests().toPromise()) || [];
  }

  async loadFriends(): Promise<void> {
    this.friends = (await this.friendService.getFriends().toPromise()) || [];
  }

  async search(): Promise<void> {
    if (!this.query.trim()) {
      this.results = [];
      return;
    }
    this.loading = true;
    try {
      this.results = (await this.friendService.searchUsers(this.query.trim()).toPromise()) || [];
    } finally {
      this.loading = false;
    }
  }

  async sendRequest(user: UserSearchResult): Promise<void> {
    await this.friendService.sendRequest(user.id).toPromise();
    user.relationship = 'RequestSent';
  }

  async acceptFromSearch(user: UserSearchResult): Promise<void> {
    if (!user.relationshipId) return;
    await this.friendService.acceptRequest(user.relationshipId).toPromise();
    user.relationship = 'Friends';
  }

  async accept(req: Friend): Promise<void> {
    await this.friendService.acceptRequest(req.id).toPromise();
    await this.loadAll();
  }

  async decline(req: Friend): Promise<void> {
    await this.friendService.deleteRequest(req.id).toPromise();
    await this.loadAll();
  }

  async cancelRequest(req: Friend): Promise<void> {
    await this.friendService.deleteRequest(req.id).toPromise();
    await this.loadAll();
  }

  async unfriend(friend: Friend): Promise<void> {
    await this.friendService.removeFriend(friend.userId).toPromise();
    await this.loadAll();
  }
}
