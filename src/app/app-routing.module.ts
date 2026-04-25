import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './auth/login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './auth/guards/auth.guard';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ScannerComponent } from './pages/scanner/scanner.component';
import { ProductsComponent } from './pages/products/products.component';
import { LowStockComponent } from './pages/low-stock/low-stock.component';
import { HighDemandComponent } from './pages/high-demand/high-demand.component';
import { SalesLogComponent } from './pages/sales-log/sales-log.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   component: DashboardComponent,  canActivate: [AuthGuard] },
      { path: 'scanner',     redirectTo: 'scanner/sell',    pathMatch: 'full' },
      { path: 'scanner/:mode', component: ScannerComponent, canActivate: [AuthGuard] },
      { path: 'products',    component: ProductsComponent,   canActivate: [AuthGuard], data: { roles: ['admin'] } },
      { path: 'low-stock',   component: LowStockComponent,   canActivate: [AuthGuard], data: { roles: ['admin'] } },
      { path: 'high-demand', component: HighDemandComponent, canActivate: [AuthGuard] },
      { path: 'sales-log',   component: SalesLogComponent,   canActivate: [AuthGuard] },
    ]
  },
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
