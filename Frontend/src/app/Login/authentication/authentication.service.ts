
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap } from 'rxjs';

import {  AuthUser, LoginCredentials, LoginResponse, UserRole} from './authentication.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  private currentUser = signal<AuthUser | null>(null);

  readonly user = this.currentUser.asReadonly();

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      '/api/auth/login/',
      credentials,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.currentUser.set(response.user);
      })
    );
  }

  loadUser(): Observable<AuthUser | null> {
    const cachedUser = this.currentUser();

    if (cachedUser) {
      return of(cachedUser);
    }

    return this.http.get<AuthUser>(
      '/api/auth/me/',
      { withCredentials: true }
    ).pipe(
      tap(user => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      })
    );
  }

  hasRole(roles: UserRole[]): boolean {
    const currentRole = this.currentUser()?.role;

    return currentRole !== undefined &&
      roles.includes(currentRole);
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      '/api/auth/logout/',
      {},
      { withCredentials: true }
    ).pipe(
      tap(() => this.currentUser.set(null))
    );
  }
}
