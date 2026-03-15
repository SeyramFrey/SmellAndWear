import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Guards
import { ClientGuard } from '../core/guards/client.guard';

// Component Pages
import { IndexComponent } from "./index/index.component";
import { WearChoiceComponent } from "./wear-choice/wear-choice.component";
import { WearMenComponent } from "./wear-men/wear-men.component";
import { ProductDetailComponent } from "./product-detail/product-detail.component";
import { CheckoutComponent } from "./checkout/checkout.component";
import { LSousCategoriesComponent } from "./l-sous-categories/l-sous-categories.component";
import { SCProductsComponent } from "./s-c-products/s-c-products.component";
import { AllCategorieComponent } from "./all-categorie/all-categorie.component";
import { NewsComponent } from "./news/news.component";
import { BestsellersComponent } from "./bestsellers/bestsellers.component";
import { AllProductsComponent } from "./all-products/all-products.component";
import { OrderSuccessComponent } from "./order-success/order-success.component";

const routes: Routes = [
  // Public routes
  {
    path: "",
    component: IndexComponent
  },
  {
    path: "wear",
    component: WearChoiceComponent
  },
  {
    path: "wear-men",
    component: WearMenComponent
  },
  {
    path: "sous-categories-men/:categoryId",
    component: LSousCategoriesComponent
  },
  {
    path: "sous-categories-men",
    redirectTo: "/wear-men",
    pathMatch: "full"
  },
  {
    path: "product-detail/:id",
    component: ProductDetailComponent
  },
  {
    path: "checkout",
    component: CheckoutComponent
  },
  {
    path: "checkout/success",
    component: OrderSuccessComponent
  },
  {
    path: "subcategory-products/:id",
    component: SCProductsComponent
  },
  {
    path: "all-categorie/:categoryId",
    component: AllCategorieComponent
  },
  {
    path: "shop-all",
    component: AllProductsComponent
  },
  {
    path: "news",
    component: NewsComponent,
  },
  {
    path: "best-sellers",
    component: BestsellersComponent,
  },

  // Customer auth routes (public)
  {
    path: 'customer',
    loadChildren: () => import('./auth/auth-landing.module').then(m => m.AuthLandingModule)
  },

  // Customer account routes (protected - clients only, not admins)
  {
    path: 'account',
    loadChildren: () => import('./account/account-landing.module').then(m => m.AccountLandingModule),
    canActivate: [ClientGuard]
  },

  // Legacy user routes - redirect to new account routes
  {
    path: "user/:id",
    redirectTo: "/account",
    pathMatch: "full"
  },
  {
    path: "user/settings/:id",
    redirectTo: "/account/settings",
    pathMatch: "full"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LandingRoutingModule { }
