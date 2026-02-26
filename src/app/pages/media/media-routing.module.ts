import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {ProductsComponent} from "../ecommerce/products/products.component";
import {MediasComponent} from "./medias/medias.component";

const routes: Routes = [
    {
        path: "",
        component: MediasComponent
    },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MediaRoutingModule { }
