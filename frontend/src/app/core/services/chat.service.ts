import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message } from '../../shared/models/message.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private http: HttpClient) {}

  getMessages(roomId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${environment.apiUrl}/rooms/${roomId}/messages`);
  }
}
