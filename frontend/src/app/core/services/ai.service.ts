import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AcademicQuery {
  question: string;
  subject?: string;
  context?: string;
  researchMode?: boolean;
  researchPhase?: string;
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
}

export interface PaperSearchDto {
  query: string;
  limit?: number;
}

export interface PaperSearchResult {
  papers: PaperReference[];
  totalResults: number;
}

export interface ResearchProposalRequest {
  topic: string;
  subject?: string;
}

export interface ResearchProposal {
  topic: string;
  subject: string;
  phases: ResearchPhase[];
  currentPhase: string;
  currentPhaseContent: string;
  references?: PaperReference[];
  fullProposal?: string;
}

@Injectable({ providedIn: 'root' })
export class AIService {
  constructor(private http: HttpClient) {}

  ask(query: AcademicQuery): Observable<AcademicResponse> {
    return this.http.post<AcademicResponse>(`${environment.apiUrl}/ai/ask`, query);
  }

  searchPapers(query: string, limit = 10): Observable<PaperSearchResult> {
    return this.http.post<PaperSearchResult>(`${environment.apiUrl}/research/search`, { query, limit });
  }

  generateProposal(topic: string, subject?: string): Observable<ResearchProposal> {
    return this.http.post<ResearchProposal>(`${environment.apiUrl}/research/proposal`, { topic, subject });
  }
}
