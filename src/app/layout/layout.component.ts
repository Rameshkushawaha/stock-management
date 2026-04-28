import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { InventoryService } from '../services/inventory.service';
import { User } from '../models/models';

interface NavSection {
  label: string;
  items: NavItem[];
}
interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
  roles?: string[];
}

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
  user: User | null = null;
  sidebarOpen = true;
  lowStockCount = 0;

  navSections: NavSection[] = [];
  userSub: any;

  constructor(
    public auth: AuthService,
    private inventory: InventoryService,
    public router: Router
  ) { }

  ngOnInit() {
    this.setSidebarState();

    // Subscribe to the observable in the service
    this.userSub = this.auth.currentUser$.subscribe((userData: User | null) => {
      console.log('User data updated:', userData);
      this.user = userData;
      this.buildNav();
    });
    this.auth.restoreSession();

    this.lowStockCount = this.inventory.getLowStock().length;
  }

  @HostListener('window:resize')
  onResize() {
    this.setSidebarState();
  }

  private setSidebarState(): void {
    if (window.innerWidth >= 768) {
      this.sidebarOpen = true;   // always open on desktop
    }
  }

  buildNav(): void {
    const role = this.auth.role;
    this.navSections = [
      {
        label: 'OVERVIEW',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', roles: ['admin', 'seller'] },
          { label: 'Scanner', path: role === 'stock-adder' ? '/scanner/add' : '/scanner/sell', icon: 'scan' }
        ]
      },
      {
        label: 'INVENTORY',
        items: [
          { label: 'Products', path: '/products', icon: 'products', roles: ['admin'] },
          { label: 'Low Stock', path: '/low-stock', icon: 'alert', badge: this.lowStockCount, roles: ['admin'] }
        ]
      },
      {
        label: 'ANALYTICS',
        items: [
          { label: 'High Demand', path: '/high-demand', icon: 'fire', roles: ['admin', 'seller'] },
          { label: 'Sales Log', path: '/sales-log', icon: 'money', roles: ['admin', 'seller'] }
        ]
      }
    ];

    // Filter by role
    this.navSections = this.navSections
      .map(s => ({ ...s, items: s.items.filter(i => !i.roles || i.roles.includes(role!)) }))
      .filter(s => s.items.length > 0);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getRoleBadgeClass(): string {
    const map: Record<string, string> = { admin: 'badge--admin', 'stock-adder': 'badge--adder', seller: 'badge--seller' };
    return map[this.auth.role ?? ''] ?? '';
  }

  getRoleLabel(): string {
    const map: Record<string, string> = { admin: 'Admin', 'stock-adder': 'Stock Adder', seller: 'Cashier' };
    return map[this.auth.role ?? ''] ?? '';
  }

  openSidebar(): void {
     if (window.innerWidth < 768) {
    this.sidebarOpen = !this.sidebarOpen;
  }
  }

 onNavClick(): void {
  if (window.innerWidth < 768) {
    this.sidebarOpen = false;
  }
}

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }
}
