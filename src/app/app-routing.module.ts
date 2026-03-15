import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutComponent } from './layouts/layout.component';

// Auth Guards
import { AdminGuard } from './core/guards/admin.guard';

const routes: Routes = [
  { 
    path: 'admin', 
    component: LayoutComponent, 
    loadChildren: () => import('./pages/pages.module').then(m => m.PagesModule),
    canActivate: [AdminGuard],
    canActivateChild: [AdminGuard]
  },
  { path: 'auth', loadChildren: () => import('./account/account.module').then(m => m.AccountModule)  },
  { path: 'pages', loadChildren: () => import('./extraspages/extraspages.module').then(m => m.ExtraspagesModule)},
  { path: '', loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule)},
];

@NgModule({
  imports: [ RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled',
    enableTracing: false
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
