import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

let refreshing: Promise<void> | null = null;
let refreshFailed = false;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token && auth.isAuthenticated()) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
        return throwError(() => err);
      }

      if (refreshFailed || !auth.getRefreshToken()) {
        auth.logout();
        return throwError(() => err);
      }

      return refreshToken(auth).pipe(
        switchMap(success => {
          if (!success) {
            auth.logout();
            return throwError(() => err);
          }
          const fresh = auth.getToken();
          const retried = req.clone({ setHeaders: { Authorization: `Bearer ${fresh}` } });
          return next(retried);
        })
      );
    })
  );
};

function refreshToken(auth: AuthService): Observable<boolean> {
  if (!refreshing) {
    refreshing = auth.refreshToken().toPromise()
      .then(() => { refreshFailed = false; })
      .catch(() => { refreshFailed = true; })
      .finally(() => { refreshing = null; });
  }
  return of(true).pipe(
    switchMap(() => refreshing as Promise<void>),
    switchMap(() => of(!refreshFailed))
  );
}