import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Conversation, DirectMessage } from '../../shared/models/social.model';

@Injectable({ providedIn: 'root' })
export class DirectMessageService {
  constructor(private http: HttpClient) {}

  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${environment.apiUrl}/messages/direct/conversations`);
  }

  getConversation(otherUserId: string): Observable<DirectMessage[]> {
    return this.http.get<DirectMessage[]>(`${environment.apiUrl}/messages/direct/${otherUserId}`);
  }

  send(receiverId: string, content: string): Observable<DirectMessage> {
    return this.http.post<DirectMessage>(`${environment.apiUrl}/messages/direct`, { receiverId, content });
  }
}
