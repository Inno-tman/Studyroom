import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { Room } from '../../shared/models/room.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';

@Component({
  selector: 'app-room-list',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, DatePipe, FormsModule, LoadingComponent],
  template: `
    <div class="browse-rooms">
      <div class="page-header">
        <h1>Study Rooms</h1>
        <div class="header-actions">
          <a routerLink="/rooms/create" class="btn-primary">+ Create Room</a>
        </div>
      </div>

      <div class="filters">
        <div class="search-box">
          <span class="material-icons">search</span>
          <input type="text" [(ngModel)]="search" (input)="loadRooms()" placeholder="Search rooms..." />
        </div>
        <select [(ngModel)]="subject" (change)="loadRooms()" class="subject-filter">
          <option value="">All Subjects</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Literature">Literature</option>
          <option value="History">History</option>
          <option value="Languages">Languages</option>
        </select>
      </div>

      <app-loading [loading]="loading" />

      <div class="room-grid" *ngIf="!loading">
        <div class="room-card" *ngFor="let room of rooms" (click)="navigateToRoom(room.id)">
          <div class="room-card-header">
            <h3>{{ room.name }}</h3>
            <span class="subject-badge">{{ room.subject || 'General' }}</span>
          </div>
          <p class="room-desc">{{ room.description || 'No description' }}</p>
          <div class="room-meta">
            <span>{{ room.memberCount }} members</span>
            <span>{{ room.createdAt | date:'mediumDate' }}</span>
          </div>
        </div>

        <div class="room-card empty" *ngIf="rooms.length === 0">
          <p>No rooms found. Create one!</p>
          <a routerLink="/rooms/create" class="btn-outline">Create Room</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .browse-rooms { max-width: 1200px; }

    .header-actions { display: flex; gap: 8px; }

    .filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }

    .search-box { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; flex: 1; min-width: 200px; }
    .search-box .material-icons { color: var(--text-muted); font-size: 20px; }
    .search-box input { flex: 1; padding: 10px 0; background: none; border: none; color: var(--text-primary); font-size: 14px; outline: none; }
    .search-box input::placeholder { color: var(--text-muted); }

    .subject-filter { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none; cursor: pointer; }

    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }

    .room-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.15s; }
    .room-card:hover { border-color: var(--primary); }
    .room-card.empty { cursor: default; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .room-card.empty:hover { border-color: var(--border); }

    .room-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .room-card-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }
    .subject-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .room-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .room-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }

    .btn-primary { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: background 0.15s; }
    .btn-primary:hover { background: var(--primary-hover); }

    .btn-outline { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all 0.15s; }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
  `]
})
export class RoomListComponent implements OnInit {
  private roomService = inject(RoomService);

  rooms: Room[] = [];
  search = '';
  subject = '';
  loading = true;

  async ngOnInit() {
    await this.loadRooms();
  }

  async loadRooms() {
    this.loading = true;
    try {
      this.rooms = await this.roomService.getAll(this.search || undefined, this.subject || undefined).toPromise() || [];
    } catch { } finally {
      this.loading = false;
    }
  }

  navigateToRoom(id: string) {
    window.location.href = `/rooms/${id}`;
  }
}
