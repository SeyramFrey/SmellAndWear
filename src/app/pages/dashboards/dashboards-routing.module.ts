import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardGeoComponent } from './dashboard-geo/dashboard-geo.component';

// Component Pages

const routes: Routes = [
  {
    path: 'geo',
    component: DashboardGeoComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class DashboardsRoutingModule { }
