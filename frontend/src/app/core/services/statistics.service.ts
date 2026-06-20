import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserStats } from '../../shared/models/stats.model';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${environment.apiUrl}/users/stats`);
  }
}
