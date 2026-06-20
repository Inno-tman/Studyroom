import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notes } from '../../shared/models/notes.model';

@Injectable({ providedIn: 'root' })
export class NotesService {
  constructor(private http: HttpClient) {}

  getNotes(roomId: string): Observable<Notes> {
    return this.http.get<Notes>(`${environment.apiUrl}/rooms/${roomId}/notes`);
  }

  updateNotes(roomId: string, content: string): Observable<Notes> {
    return this.http.put<Notes>(`${environment.apiUrl}/rooms/${roomId}/notes`, { content });
  }
}
