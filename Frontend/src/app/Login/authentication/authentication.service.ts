
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders} from '@angular/common/http';
import { Observable, of, catchError, tap, switchMap } from 'rxjs';

import {  AuthUser, LoginCredentials, LoginResponse, UserRole} from './authentication.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private currentUser = signal<AuthUser | null>(null);
  readonly user = this.currentUser.asReadonly();
  private readonly authInitialized = signal(false);
  readonly isAuthInitialized = this.authInitialized.asReadonly();
  constructor() {
    this.restoreUser();
  }
  

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.get<{ csrfToken: string }>(
      '/api/auth/csrf/',
      { withCredentials: true }
    ).pipe(
      switchMap(({ csrfToken }) => {
        return this.http.post<LoginResponse>(
          '/api/auth/login/',
          credentials,
          {
            withCredentials: true,
            headers: {
              'X-CSRFToken': csrfToken
            }
          }
        );
      }),
      tap(response => {
        const role = response.roles.find(
          (value): value is UserRole => this.isUserRole(value)
        );

        if (!role) {
          this.clearUser();
          throw new Error('User does not have a valid role.');
        }

        const user: AuthUser = {
          username: response.username,
          role
        };

        // Update Angular signal
        this.currentUser.set(user);

        // Persist display information across refreshes
        this.saveUser(user);
      })
    );
  }

  private getCookie(name: string): string | null {
    const prefix = `${name}=`;

    const cookie = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));

    return cookie
      ? decodeURIComponent(cookie.substring(prefix.length))
      : null;
  }


private readonly STORAGE_KEY = 'vican_auth_user';

// Save logged-in user information
private saveUser(user: AuthUser): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(
    this.STORAGE_KEY,
    JSON.stringify(user)
  );
}

// Restore user information after page refresh
private restoreUser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const storedUser = sessionStorage.getItem(this.STORAGE_KEY);

    if (storedUser) {
      const parsed: unknown = JSON.parse(storedUser);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'username' in parsed &&
        typeof parsed.username === 'string' &&
        'role' in parsed &&
        typeof parsed.role === 'string' &&
        this.isUserRole(parsed.role)
      ) {
        this.currentUser.set({
          username: parsed.username,
          role: parsed.role
        });
      } else {
        sessionStorage.removeItem(this.STORAGE_KEY);
      }
    }
  } catch {
    sessionStorage.removeItem(this.STORAGE_KEY);
  } finally {
    this.authInitialized.set(true);
  }
}

// Check that a stored role matches your UserRole type
private isUserRole(value: string): value is UserRole {
  return ['admin', 'hr', 'finance', 'operations'].includes(value);
}

// Clear saved user information
private clearUser(): void {
  this.currentUser.set(null);

  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}



  loadUser(): Observable<AuthUser | null> {
    const cachedUser = this.currentUser();

    if (cachedUser) {
      return of(cachedUser);
    }
    this.clearUser();

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
