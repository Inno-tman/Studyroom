import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PreviousMessage {
  role: string;
  content: string;
}

export interface AcademicQuery {
  question: string;
  subject?: string;
  context?: string;
  researchMode?: boolean;
  researchPhase?: string;
  previousMessages?: PreviousMessage[];
  conversationId?: string;
}

export interface PaperReference {
  title: string;
  authors: string;
  year: number;
  venue?: string;
  url?: string;
  abstract?: string;
  citationCount?: string;
}

export interface ResearchPhase {
  phase: string;
  description: string;
  completed: boolean;
}

export interface AcademicResponse {
  answer: string;
  subject?: string;
  createdAt: string;
  isResearchMode?: boolean;
  currentPhase?: string;
  nextPhase?: string;
  references?: PaperReference[];
  researchOutline?: ResearchPhase[];
  conversationId?: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ConversationSummary {
  id: string;
  subject: string;
  isResearchMode: boolean;
  currentPhase: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationDetail {
  id: string;
  subject: string;
  isResearchMode: boolean;
  currentPhase: string;
  createdAt: string;
  messages: { id: string; role: string; content: string; createdAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class AIService {
  constructor(private http: HttpClient) {}

  ask(query: AcademicQuery): Observable<AcademicResponse> {
    return this.http.post<AcademicResponse>(`${environment.apiUrl}/ai/ask`, query);
  }

  createConversation(subject?: string, researchMode = false, phase?: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${environment.apiUrl}/ai/conversations`, { subject, researchMode, phase });
  }

  getConversations(limit = 20): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${environment.apiUrl}/ai/conversations?limit=${limit}`);
  }

  getConversation(id: string): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${environment.apiUrl}/ai/conversations/${id}`);
  }

  deleteConversation(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/ai/conversations/${id}`);
  }

  clearMessages(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/ai/conversations/${conversationId}/messages`);
  }
}
