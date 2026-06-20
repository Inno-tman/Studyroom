import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room, CreateRoomDto } from '../../shared/models/room.model';

@Injectable({ providedIn: 'root' })
export class RoomService {
  constructor(private http: HttpClient) {}

  getAll(search?: string, subject?: string): Observable<Room[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (subject) params = params.set('subject', subject);
    return this.http.get<Room[]>(`${environment.apiUrl}/rooms`, { params });
  }

  getById(id: string): Observable<Room> {
    return this.http.get<Room>(`${environment.apiUrl}/rooms/${id}`);
  }

  create(dto: CreateRoomDto): Observable<Room> {
    return this.http.post<Room>(`${environment.apiUrl}/rooms`, dto);
  }

  update(id: string, dto: CreateRoomDto): Observable<Room> {
    return this.http.put<Room>(`${environment.apiUrl}/rooms/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/rooms/${id}`);
  }

  join(id: string, joinCode?: string): Observable<Room> {
    return this.http.post<Room>(`${environment.apiUrl}/rooms/${id}/join`, { joinCode });
  }

  leave(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/rooms/${id}/leave`, {});
  }

  getMembers(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/rooms/${id}/members`);
  }

  getMyRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${environment.apiUrl}/rooms/my`);
  }
}
