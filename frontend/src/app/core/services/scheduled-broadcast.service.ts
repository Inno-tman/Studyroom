import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ScheduledBroadcast, CreateBroadcastDto, UpdateBroadcastDto } from '../../shared/models/scheduled-broadcast.model';

@Injectable({ providedIn: 'root' })
export class ScheduledBroadcastService {
  constructor(private http: HttpClient) {}

  getForRoom(roomId: string): Observable<ScheduledBroadcast[]> {
    return this.http.get<ScheduledBroadcast[]>(`${environment.apiUrl}/rooms/${roomId}/broadcasts`);
  }

  create(roomId: string, dto: CreateBroadcastDto): Observable<ScheduledBroadcast> {
    return this.http.post<ScheduledBroadcast>(`${environment.apiUrl}/rooms/${roomId}/broadcasts`, dto);
  }

  update(roomId: string, broadcastId: string, dto: UpdateBroadcastDto): Observable<ScheduledBroadcast> {
    return this.http.put<ScheduledBroadcast>(`${environment.apiUrl}/rooms/${roomId}/broadcasts/${broadcastId}`, dto);
  }

  delete(roomId: string, broadcastId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/rooms/${roomId}/broadcasts/${broadcastId}`);
  }

  /** Accept/decline a scheduled broadcast (RSVP). */
  setAttendance(broadcast: ScheduledBroadcast, status: 'Accepted' | 'Declined'): Observable<ScheduledBroadcast> {
    return this.http.post<ScheduledBroadcast>(
      `${environment.apiUrl}/rooms/${broadcast.roomId}/broadcasts/${broadcast.id}/attend`,
      { status }
    );
  }
}
