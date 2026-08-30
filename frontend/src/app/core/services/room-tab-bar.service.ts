import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface RoomTab {
  id: string;
  label: string;
  icon: string;
}

export const ROOM_TABS: RoomTab[] = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'focus', label: 'Focus', icon: 'timer' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'tasks', label: 'Tasks', icon: 'checklist' },
  { id: 'meet', label: 'Meet', icon: 'videocam' },
  { id: 'stats', label: 'Stats', icon: 'bar_chart' }
];

export interface RoomTabBarState {
  isMobile: boolean;
  isMember: boolean;
  tabs: RoomTab[];
  activeTab: string;
  unreadCount: number;
  upcomingMeetingsCount: number;
}

@Injectable({ providedIn: 'root' })
export class RoomTabBarService {
  private state = new BehaviorSubject<RoomTabBarState | null>(null);
  private select = new Subject<string>();
  private activeRoom = new BehaviorSubject<any>(null);

  state$ = this.state.asObservable();
  select$ = this.select.asObservable();
  activeRoom$ = this.activeRoom.asObservable();

  setState(state: RoomTabBarState | null): void {
    this.state.next(state);
  }

  setActiveRoom(room: any): void {
    this.activeRoom.next(room);
  }

  selectTab(id: string): void {
    this.select.next(id);
  }
}
