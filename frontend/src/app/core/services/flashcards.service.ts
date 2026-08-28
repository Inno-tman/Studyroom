import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardDeckDetail {
  id: string;
  title: string;
  description?: string;
  cards: FlashcardItem[];
}

@Injectable({ providedIn: 'root' })
export class FlashcardsService {
  constructor(private http: HttpClient) {}

  getDecks(): Observable<FlashcardDeck[]> {
    return this.http.get<FlashcardDeck[]>(`${environment.apiUrl}/flashcards`);
  }

  getDeck(id: string): Observable<FlashcardDeckDetail> {
    return this.http.get<FlashcardDeckDetail>(`${environment.apiUrl}/flashcards/${id}`);
  }

  createDeck(title: string, description?: string): Observable<FlashcardDeck> {
    return this.http.post<FlashcardDeck>(`${environment.apiUrl}/flashcards`, { title, description });
  }

  updateDeck(id: string, title: string, description?: string): Observable<FlashcardDeck> {
    return this.http.put<FlashcardDeck>(`${environment.apiUrl}/flashcards/${id}`, { title, description });
  }

  replaceCards(id: string, cards: { front: string; back: string }[], title?: string): Observable<FlashcardDeckDetail> {
    return this.http.put<FlashcardDeckDetail>(`${environment.apiUrl}/flashcards/${id}/cards`, { cards, title });
  }

  deleteDeck(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/flashcards/${id}`);
  }
}