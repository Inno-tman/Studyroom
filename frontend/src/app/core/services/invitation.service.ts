import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RoomInvitation } from '../../shared/models/social.model';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  constructor(private http: HttpClient) {}

  getIncoming(): Observable<RoomInvitation[]> {
    return this.http.get<RoomInvitation[]>(`${environment.apiUrl}/invitations`);
  }

  invite(roomId: string, inviteeId: string): Observable<RoomInvitation> {
    return this.http.post<RoomInvitation>(`${environment.apiUrl}/invitations/rooms/${roomId}`, { inviteeId });
  }

  accept(id: string): Observable<RoomInvitation> {
    return this.http.post<RoomInvitation>(`${environment.apiUrl}/invitations/${id}/accept`, {});
  }

  decline(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/invitations/${id}/decline`, {});
  }
}
