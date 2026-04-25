import { Component, OnInit } from '@angular/core';
import { AuthService } from './auth/services/auth.service';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
  styles: [':host { display:block; min-height:100vh; }']
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}
  ngOnInit(): void { this.auth.restoreSession(); }
}
