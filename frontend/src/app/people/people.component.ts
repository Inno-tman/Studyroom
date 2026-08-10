import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FriendService } from '../core/services/friend.service';
import { Friend, UserSearchResult } from '../shared/models/social.model';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <div class="people-page">
      <div class="page-header">
        <h1>People</h1>
      </div>

      <div class="search-section">
        <div class="search-box">
          <span class="material-icons">search</span>
          <input
            type="text"
            [(ngModel)]="query"
            placeholder="Search by name, username or schoolâ€¦"
            (input)="search()"
          />
        </div>

        <div *ngIf="results.length > 0" class="search-results">
          <div *ngFor="let user of results" class="person-row">
            <div class="person-avatar" [class.has-image]="user.avatarUrl">
              <img *ngIf="user.avatarUrl; else initial" [src]="user.avatarUrl" alt="" />
              <ng-template #initial>{{ (user.displayName || user.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ user.displayName || user.username }}</span>
              <span class="person-sub">{{ '@' + user.username }}{{ user.schoolName ? ' Â· ' + user.schoolName : '' }}</span>
            </div>
            <button
              *ngIf="user.relationship === 'None'"
              class="btn-primary small"
              (click)="sendRequest(user)"
            >
              Add Friend
            </button>
            <span *ngIf="user.relationship === 'RequestSent'" class="status-label">Request Sent</span>
            <button
              *ngIf="user.relationship === 'RequestReceived'"
              class="btn-success small"
              (click)="acceptFromSearch(user)"
            >
              Accept Request
            </button>
            <span *ngIf="user.relationship === 'Friends'" class="status-label friends">Friends</span>
          </div>
        </div>
        <div *ngIf="query && !loading && results.length === 0" class="no-results">
          No people found.
        </div>
      </div>

      <div class="sections">
        <div class="section">
          <h2>Friend Requests</h2>
          <div *ngIf="requests.length === 0" class="empty">No pending requests.</div>
          <div *ngFor="let req of requests" class="person-row">
            <div class="person-avatar" [class.has-image]="req.avatarUrl">
              <img *ngIf="req.avatarUrl; else reqInitial" [src]="req.avatarUrl" alt="" />
              <ng-template #reqInitial>{{ (req.displayName || req.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ req.displayName || req.username }}</span>
              <span class="person-sub">{{ '@' + req.username }}</span>
            </div>
            <div class="row-actions">
              <button class="btn-success small" (click)="accept(req)">Accept</button>
              <button class="btn-secondary small" (click)="decline(req)">Decline</button>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>My Friends</h2>
          <div *ngIf="friends.length === 0" class="empty">No friends yet. Add some people above!</div>
          <div *ngFor="let friend of friends" class="person-row">
            <div class="person-avatar" [class.has-image]="friend.avatarUrl">
              <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
              <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="person-info">
              <span class="person-name">{{ friend.displayName || friend.username }}</span>
              <span class="person-sub">{{ '@' + friend.username }}</span>
            </div>
            <button class="btn-secondary small" (click)="unfriend(friend)">Remove</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .people-page { max-width: 800px; margin: 0 auto; }

    .search-section { margin-bottom: 32px; }

    .search-box {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 14px;
    }
    .search-box .material-icons { color: var(--text-muted); }
    .search-box input {
      flex: 1; background: none; border: none; color: var(--text-primary);
      font-size: var(--font-14); outline: none;
    }

    .search-results {
      margin-top: 12px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }

    .no-results { text-align: center; color: var(--text-muted); padding: 20px; }

    .person-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
    }
    .person-row:last-child { border-bottom: none; }

    .person-avatar {
      width: 44px; height: 44px; border-radius: 50%; background: var(--primary);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: white; overflow: hidden; flex-shrink: 0;
    }
    .person-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .person-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .person-name { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .person-sub { font-size: var(--font-13); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .row-actions { display: flex; gap: 8px; }

    .btn-primary, .btn-success, .btn-secondary {
      border: none; padding: 7px 14px; border-radius: 8px; font-size: var(--font-13); font-weight: 600; cursor: pointer;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-success { background: var(--success); color: white; }
    .btn-secondary { background: var(--surface-hover); color: var(--text-primary); border: 1px solid var(--border); }
    .btn-primary:hover, .btn-success:hover, .btn-secondary:hover { opacity: 0.85; }
    .btn-primary.small, .btn-success.small, .btn-secondary.small { padding: 5px 12px; }

    .status-label { font-size: var(--font-13); color: var(--text-muted); font-weight: 500; }
    .status-label.friends { color: var(--success); }

    .sections { display: flex; flex-direction: column; gap: 32px; }

    .section h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }

    .empty { color: var(--text-muted); font-size: var(--font-14); padding: 12px 0; }
  `]
})
export class PeopleComponent implements OnInit {
  private friendService = inject(FriendService);

  query = '';
  results: UserSearchResult[] = [];
  requests: Friend[] = [];
  friends: Friend[] = [];
  loading = false;

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadRequests(), this.loadFriends()]);
  }

  async loadRequests(): Promise<void> {
    this.requests = (await this.friendService.getIncomingRequests().toPromise()) || [];
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

  async unfriend(friend: Friend): Promise<void> {
    await this.friendService.removeFriend(friend.userId).toPromise();
    await this.loadAll();
  }
}
