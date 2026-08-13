import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Meeting, CreateMeetingDto, UpdateMeetingDto } from '../../shared/models/meeting.model';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  constructor(private http: HttpClient) {}

  getForRoom(roomId: string): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${environment.apiUrl}/rooms/${roomId}/meetings`);
  }

  create(roomId: string, dto: CreateMeetingDto): Observable<Meeting> {
    return this.http.post<Meeting>(`${environment.apiUrl}/rooms/${roomId}/meetings`, dto);
  }

  update(roomId: string, meetingId: string, dto: UpdateMeetingDto): Observable<Meeting> {
    return this.http.put<Meeting>(`${environment.apiUrl}/rooms/${roomId}/meetings/${meetingId}`, dto);
  }

  delete(roomId: string, meetingId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/rooms/${roomId}/meetings/${meetingId}`);
  }
}