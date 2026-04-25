import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Layout
import { LayoutComponent } from './layout/layout.component';

// Auth
import { LoginComponent } from './auth/login/login.component';

// Pages
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ScannerComponent } from './pages/scanner/scanner.component';
import { ProductsComponent } from './pages/products/products.component';
import { LowStockComponent } from './pages/low-stock/low-stock.component';
import { HighDemandComponent } from './pages/high-demand/high-demand.component';
import { SalesLogComponent } from './pages/sales-log/sales-log.component';

// Shared components
import { ReceiptPanelComponent } from './components/receipt-panel/receipt-panel.component';
import { NewProductModalComponent } from './components/new-product-modal/new-product-modal.component';
import { HttpClientModule, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/interceptors/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LayoutComponent,
    LoginComponent,
    DashboardComponent,
    ScannerComponent,
    ProductsComponent,
    LowStockComponent,
    HighDemandComponent,
    SalesLogComponent,
    ReceiptPanelComponent,
    NewProductModalComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
  ],
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
  bootstrap: [AppComponent]
})
export class AppModule {}
