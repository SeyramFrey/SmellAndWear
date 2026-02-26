import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Component pages
import { WidgetsComponent } from "./widgets/widgets.component";

const routes: Routes = [

  {
    path: "widgets",
    component: WidgetsComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppsRoutingModule { }
