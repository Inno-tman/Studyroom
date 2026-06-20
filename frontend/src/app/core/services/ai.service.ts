import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AcademicQuery {
  question: string;
  subject?: string;
  context?: string;
}

export interface AcademicResponse {
  answer: string;
  subject?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AIService {
  constructor(private http: HttpClient) {}

  ask(query: AcademicQuery): Observable<AcademicResponse> {
    return this.http.post<AcademicResponse>(`${environment.apiUrl}/ai/ask`, query);
  }
}
