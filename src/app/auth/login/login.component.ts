import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../../models/models';

interface RoleCard {
  role: UserRole;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultPin: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  selectedRole: UserRole | null = null;
  pin = '';
  error = '';
  loading = false;

  roles: RoleCard[] = [
    { role: 'admin',       label: 'Admin',        description: 'Full system access, reports & management', icon: '🛡️', color: 'role--admin',  defaultPin: '1234' },
    { role: 'stock-adder', label: 'Stock Adder',   description: 'Scan items to add stock to inventory',     icon: '📦', color: 'role--adder',  defaultPin: '2222' },
    { role: 'seller',      label: 'Cashier',       description: 'Scan & sell products, print receipts',     icon: '🏪', color: 'role--seller', defaultPin: '3333' }
  ];

  get selectedCard(): RoleCard | undefined { return this.roles.find(r => r.role === this.selectedRole); }
  get pinDots(): number[] { return [0, 1, 2, 3]; }

  constructor(private auth: AuthService, private router: Router) {}

  selectRole(role: UserRole): void { this.selectedRole = role; this.pin = ''; this.error = ''; }

  onPinKey(digit: string): void {
    if (this.pin.length < 4) this.pin += digit;
    if (this.pin.length === 4) setTimeout(() => this.submit(), 250);
  }

  onPinBackspace(): void { this.pin = this.pin.slice(0, -1); this.error = ''; }

  submit(): void {
    if (!this.selectedRole || this.pin.length !== 4) return;
    this.loading = true;
    this.auth.loginByRole(this.selectedRole, this.pin).subscribe(
      (user) => {
        this.loading = false;
        if (user) {
          if (user.role === 'stock-adder') this.router.navigate(['/scanner/add']);
          else if (user.role === 'seller') this.router.navigate(['/scanner/sell']);
          else this.router.navigate(['/dashboard']);
        } else {
          this.error = 'Incorrect PIN. Please try again.';
          this.pin = '';
        }
      },
      () => {
        this.loading = false;
        this.error = 'Incorrect PIN. Please try again.';
        this.pin = '';
      }
    );
  }

  back(): void { this.selectedRole = null; this.pin = ''; this.error = ''; }
}
