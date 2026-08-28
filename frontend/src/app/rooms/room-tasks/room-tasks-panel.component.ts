import { Component, Input, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomTaskService, RoomTask } from '../../core/services/room-task.service';

export interface TaskMember {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-room-tasks-panel',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, NgClass, FormsModule],
  template: `
    <div class="tasks-panel">
      <div class="tasks-head">
        <span class="tp-title">To-do</span>
        <span class="tp-count" *ngIf="tasks.length">{{ completedCount }} / {{ tasks.length }} done</span>
      </div>

      <div class="tp-progress" *ngIf="tasks.length">
        <div class="progress-bar"><div class="progress-fill" [style.width.%]="progressPct"></div></div>
      </div>

      <div class="tp-add">
        <input class="tp-input" [(ngModel)]="newTitle" placeholder="Add a task…"
          (keyup.enter)="addTask()" />
        <button class="tp-btn primary" (click)="addTask()" [disabled]="!newTitle.trim()">
          <span class="material-icons">add</span>
        </button>
      </div>

      <div *ngIf="tasks.length === 0" class="tp-empty">
        No tasks yet — add one to keep the room on track.
      </div>

      <div class="tp-list">
        <div class="tp-item" *ngFor="let t of tasks" [class.done]="t.isCompleted">
          <button class="tp-check" [class.checked]="t.isCompleted" (click)="toggle(t)" title="Toggle done">
            <span class="material-icons">{{ t.isCompleted ? 'check_circle' : 'radio_button_unchecked' }}</span>
          </button>
          <div class="tp-body">
            <span class="tp-title-text">{{ t.title }}</span>
            <span class="tp-desc" *ngIf="t.description">{{ t.description }}</span>
            <span class="tp-meta">
              <span *ngIf="t.assignedToName" class="tp-assignee"><span class="material-icons">person</span> {{ t.assignedToName }}</span>
              <span *ngIf="t.dueDate" class="tp-due" [class.overdue]="isOverdue(t)"><span class="material-icons">event</span> {{ t.dueDate | date:'MMM d' }}</span>
            </span>
          </div>
          <button class="tp-edit" (click)="editTask(t)" title="Edit">
            <span class="material-icons">more_vert</span>
          </button>
        </div>
      </div>

      <div class="tp-modal" *ngIf="editing">
        <div class="tp-modal-card">
          <h3>{{ editing.id ? 'Edit task' : 'New task' }}</h3>
          <input class="tp-input" [(ngModel)]="editTitle" placeholder="Title" />
          <input class="tp-input" [(ngModel)]="editDesc" placeholder="Description (optional)" />
          <select class="tp-input" [(ngModel)]="editAssignee">
            <option value="">Unassigned</option>
            <option *ngFor="let m of members" [value]="m.id">{{ m.displayName || m.username }}</option>
          </select>
          <input class="tp-input" type="date" [(ngModel)]="editDue" />
          <div class="tp-modal-actions">
            <button class="tp-btn secondary" (click)="editing = null">Cancel</button>
            <button class="tp-btn danger" *ngIf="editing.id" (click)="deleteTask()">
              <span class="material-icons">delete</span>
            </button>
            <button class="tp-btn primary" (click)="saveEdit()" [disabled]="!editTitle.trim()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tasks-panel { display: flex; flex-direction: column; gap: 12px; }
    .tasks-head { display: flex; align-items: center; justify-content: space-between; }
    .tp-title { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); }
    .tp-count { font-size: var(--font-12); color: var(--text-muted); }

    .progress-bar { width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 4px; transition: width 0.4s ease; }

    .tp-add { display: flex; gap: 8px; }
    .tp-input {
      flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; color: var(--text-primary); font-size: var(--font-14); outline: none;
      box-sizing: border-box;
    }
    .tp-input:focus { border-color: var(--primary); }

    .tp-empty { color: var(--text-muted); font-size: var(--font-13); text-align: center; padding: 24px 0; }

    .tp-list { display: flex; flex-direction: column; }

    .tp-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 8px; border-bottom: 1px solid var(--border);
    }
    .tp-item:last-child { border-bottom: none; }
    .tp-item.done .tp-title-text { text-decoration: line-through; color: var(--text-muted); }

    .tp-check { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px; }
    .tp-check .material-icons { font-size: 22px; }
    .tp-check.checked { color: var(--success); }

    .tp-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .tp-title-text { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); word-break: break-word; }
    .tp-desc { font-size: var(--font-12); color: var(--text-secondary); }
    .tp-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--font-11); color: var(--text-muted); }
    .tp-assignee, .tp-due { display: inline-flex; align-items: center; gap: 3px; }
    .tp-assignee .material-icons, .tp-due .material-icons { font-size: 13px; }
    .tp-due.overdue { color: var(--error); }

    .tp-edit { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; }
    .tp-edit .material-icons { font-size: 20px; }

    .tp-btn { display: inline-flex; align-items: center; gap: 4px; border: none; border-radius: 10px; padding: 10px 14px; font-size: var(--font-13); font-weight: 600; cursor: pointer; }
    .tp-btn.primary { background: var(--primary); color: white; }
    .tp-btn.secondary { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
    .tp-btn.danger { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }
    .tp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .tp-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .tp-modal-card {
      background: var(--secondary); border: 1px solid var(--border); border-radius: 14px;
      padding: 20px; width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 10px;
    }
    .tp-modal-card h3 { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); }
    .tp-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
  `]
})
export class RoomTasksPanelComponent implements OnInit {
  @Input() roomId = '';
  @Input() members: TaskMember[] = [];

  private taskService = inject(RoomTaskService);

  tasks: RoomTask[] = [];
  newTitle = '';
  editing: RoomTask | null = null;
  editTitle = '';
  editDesc = '';
  editAssignee = '';
  editDue = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get completedCount(): number {
    return this.tasks.filter(t => t.isCompleted).length;
  }

  get progressPct(): number {
    if (this.tasks.length === 0) return 0;
    return Math.round((this.completedCount / this.tasks.length) * 100);
  }

  async load(): Promise<void> {
    try {
      this.tasks = (await this.taskService.getTasks(this.roomId).toPromise()) || [];
    } catch {
      this.tasks = [];
    }
  }

  isOverdue(t: RoomTask): boolean {
    if (!t.dueDate || t.isCompleted) return false;
    return new Date(t.dueDate).getTime() < Date.now();
  }

  async addTask(): Promise<void> {
    const title = this.newTitle.trim();
    if (!title) return;
    try {
      await this.taskService.createTask(this.roomId, { title }).toPromise();
      this.newTitle = '';
      await this.load();
    } catch { }
  }

  async toggle(t: RoomTask): Promise<void> {
    try {
      await this.taskService.updateTask(this.roomId, t.id, { isCompleted: !t.isCompleted }).toPromise();
      await this.load();
    } catch { }
  }

  editTask(t: RoomTask): void {
    this.editing = t;
    this.editTitle = t.title;
    this.editDesc = t.description || '';
    this.editAssignee = t.assignedToId || '';
    this.editDue = t.dueDate ? t.dueDate.slice(0, 10) : '';
  }

  async saveEdit(): Promise<void> {
    if (!this.editing || !this.editTitle.trim()) return;
    try {
      await this.taskService.updateTask(this.roomId, this.editing.id, {
        title: this.editTitle.trim(),
        description: this.editDesc.trim() || undefined,
        assignedToId: this.editAssignee || undefined,
        dueDate: this.editDue || null
      }).toPromise();
      this.editing = null;
      await this.load();
    } catch { }
  }

  async deleteTask(): Promise<void> {
    if (!this.editing) return;
    try {
      await this.taskService.deleteTask(this.roomId, this.editing.id).toPromise();
      this.editing = null;
      await this.load();
    } catch { }
  }
}