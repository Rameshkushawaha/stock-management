import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../../models/models';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return false;
    }
    const allowedRoles: UserRole[] = route.data['roles'];
    if (allowedRoles && !allowedRoles.includes(this.auth.role!)) {
      this.router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }
}
