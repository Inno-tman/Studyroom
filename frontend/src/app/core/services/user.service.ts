import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicUserProfile } from '../../shared/models/stats.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}

  getById(id: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(`${environment.apiUrl}/users/${id}`);
  }
}
