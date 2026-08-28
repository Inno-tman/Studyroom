import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RoomTask {
  id: string;
  title: string;
  description?: string;
  assignedToId?: string;
  assignedToName?: string;
  isCompleted: boolean;
  completedBy?: string;
  dueDate?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  assignedToId?: string;
  dueDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RoomTaskService {
  constructor(private http: HttpClient) {}

  getTasks(roomId: string): Observable<RoomTask[]> {
    return this.http.get<RoomTask[]>(`${environment.apiUrl}/rooms/${roomId}/tasks`);
  }

  createTask(roomId: string, dto: CreateTaskDto): Observable<RoomTask> {
    return this.http.post<RoomTask>(`${environment.apiUrl}/rooms/${roomId}/tasks`, dto);
  }

  updateTask(roomId: string, taskId: string, dto: Partial<CreateTaskDto> & { isCompleted?: boolean }): Observable<RoomTask> {
    return this.http.patch<RoomTask>(`${environment.apiUrl}/rooms/${roomId}/tasks/${taskId}`, dto);
  }

  deleteTask(roomId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/rooms/${roomId}/tasks/${taskId}`);
  }
}