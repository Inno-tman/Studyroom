import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Friend, UserSearchResult, FriendPresence } from '../../shared/models/social.model';

@Injectable({ providedIn: 'root' })
export class FriendService {
  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${environment.apiUrl}/users/search`, { params: { q: query } });
  }

  getSuggestions(): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${environment.apiUrl}/users/suggestions`);
  }

  getFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${environment.apiUrl}/friends`);
  }

  getFriendPresence(): Observable<FriendPresence[]> {
    return this.http.get<FriendPresence[]>(`${environment.apiUrl}/friends/presence`);
  }

  getUsersPresence(userIds: string[]): Observable<FriendPresence[]> {
    return this.http.post<FriendPresence[]>(`${environment.apiUrl}/users/presence`, { userIds });
  }

  getIncomingRequests(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${environment.apiUrl}/friends/requests`);
  }

  getOutgoingRequests(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${environment.apiUrl}/friends/requests/outgoing`);
  }

  sendRequest(userId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/friends/request`, { userId });
  }

  acceptRequest(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/friends/${id}/accept`, {});
  }

  deleteRequest(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/friends/${id}`);
  }

  removeFriend(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/friends/${userId}/friend`);
  }
}
