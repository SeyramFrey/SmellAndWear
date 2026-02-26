import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Component pages
import { ProductsComponent } from "./products/products.component";
import { ProductDetailComponent } from "./product-detail/product-detail.component";
import { AddProductComponent } from "./add-product/add-product.component";
import { OrdersComponent } from "./orders/orders.component";
import { OrderDetailsComponent } from "./order-details/order-details.component";
import { VariantListComponent } from "./variants-list/variant-list.component";
import { CustomersComponent } from "./customers/customers.component";
import { CartComponent } from "./cart/cart.component";
import { CategoriesComponent } from "./categories/categories.component";
import {ProductsList} from "./products-list/products-list";
import {SousCategoriesComponent} from "./sous-categories/sous-categories.component";
import {PromosComponent} from "./promos/promos.component";
import {DeliveryManagementComponent} from "./delivery-management/delivery-management.component";
import { AdminUsersComponent } from "../admin/admin-users/admin-users.component";

const routes: Routes = [
  {
    path: "produits",
    component: ProductsComponent
  },
  {
    path: "product-detail/:produitId",
    component: ProductDetailComponent
  },
  {
    path: "product-detail/:produitId/:variantId",
    component: ProductDetailComponent
  },
  {
    path: "add-product/:produitId",
    component: AddProductComponent
  },
  {
    path: "promos",
    component: PromosComponent
  },
  {
    path: "products/:SousCategoryId",
    component: ProductsList
  },

  {
    path: "orders",
    component: OrdersComponent
  },
  {
    path: "order-details/:orderId",
    component: OrderDetailsComponent
  },
  {
    path: "variants-list/:produitId",
    component: VariantListComponent
  },
  {
    path: "customers",
    component: CustomersComponent
  },
  {
    path: "cart",
    component: CartComponent
  },
  {
    path: "categories",
    component: CategoriesComponent
  },
  {
    path: "sous-categories/:categorieId",
    component: SousCategoriesComponent
  },
    {
        path: "delivery-prices",
        component: DeliveryManagementComponent
    },
    {
        path: "admin-users",
        component: AdminUsersComponent
    },

];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class EcommerceRoutingModule {}
