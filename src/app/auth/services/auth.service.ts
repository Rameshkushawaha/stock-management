import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, UserRole } from '../../models/models';
import mockData from '../../data/mock-data.json';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/app/environment/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private users: User[] = mockData.users as User[];
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null { return this.currentUserSubject.value; }
  get isLoggedIn(): boolean { return !!this.currentUserSubject.value; }
  get role(): UserRole | null { return this.currentUserSubject.value?.role ?? null; }
  private http = inject(HttpClient); // Modern way to inject HttpClient
  private readonly API_URL = environment.apiUrl ;


  login(name: string, pin: string): User | null {
    const user = this.users.find(u =>
      u.name.toLowerCase() === name.toLowerCase() && u.pin === pin
    );
    if (user) {
      this.currentUserSubject.next(user);
      sessionStorage.setItem('stocksys_user', JSON.stringify(user));
    }
    return user ?? null;
  }

 
  loginByRole(role: UserRole, pin: string, shopId: number = 1): Observable<User> {
    const payload = { role, pin, shopId };

    return this.http.post<any>(this.API_URL + 'auth/login', payload).pipe(
    tap((response) => {
      // Check if response and response.data.user exist
      if (response && response.success && response.data && response.data.user) {
        const actualUser = response.data.user; // Extract the inner user object
        const authToken = response.data.token as unknown as string; // Extract the token from the response
        this.currentUserSubject.next(actualUser);
        sessionStorage.setItem('stocksys_user', JSON.stringify(actualUser));
        sessionStorage.setItem('stocksys_token', authToken);
      }
    })
    );
  }

  logout(): void {
    this.currentUserSubject.next(null);
    sessionStorage.removeItem('stocksys_user');
    sessionStorage.removeItem('stocksys_token');
  }

 restoreSession(): void {
  const stored = sessionStorage.getItem('stocksys_user');
  if (stored) {
    try { 
      const userData = JSON.parse(stored);
      this.currentUserSubject.next(userData); 
    } catch (e) {
      console.error("Session restore failed", e);
    }
  }
}

  can(permission: 'add-stock' | 'sell' | 'manage' | 'view-reports'): boolean {
    const role = this.role;
    const map: Record<string, string[]> = {
      'admin':       ['add-stock', 'sell', 'manage', 'view-reports'],
      'stock-adder': ['add-stock'],
      'seller':      ['sell', 'view-reports']
    };
    return role ? (map[role] ?? []).includes(permission) : false;
  }
}
