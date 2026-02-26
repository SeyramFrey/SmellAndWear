import { Component, OnInit } from '@angular/core';
import { ScrollService } from './core/services/scroll.service';
import { SupabaseAuthService } from './core/services/supabase-auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Smell & Wear';

  constructor(
    private scrollService: ScrollService,
    private authService: SupabaseAuthService
  ) {
    // Services are automatically initialized when injected
  }

  ngOnInit(): void {
    // Auth service initializes automatically on construction
    // This ensures session is restored from storage on app startup
    console.log('[AppComponent] App initialized, auth service ready');
  }
}
