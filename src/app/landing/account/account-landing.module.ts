import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbNavModule, NgbModalModule, NgbPaginationModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';

import { AccountDashboardComponent } from './dashboard/account-dashboard.component';
import { AccountOrdersComponent } from './orders/account-orders.component';
import { AccountFavoritesComponent } from './favorites/account-favorites.component';
import { AccountAddressesComponent } from './addresses/account-addresses.component';
import { AccountSettingsComponent } from './settings/account-settings.component';

const routes: Routes = [
  {
    path: '',
    component: AccountDashboardComponent
  },
  {
    path: 'orders',
    component: AccountOrdersComponent
  },
  {
    path: 'orders/:orderId',
    component: AccountOrdersComponent // TODO: Create dedicated order details component for client
  },
  {
    path: 'favorites',
    component: AccountFavoritesComponent
  },
  {
    path: 'addresses',
    component: AccountAddressesComponent
  },
  {
    path: 'settings',
    component: AccountSettingsComponent
  }
];

@NgModule({
  declarations: [
    AccountDashboardComponent,
    AccountOrdersComponent,
    AccountFavoritesComponent,
    AccountAddressesComponent,
    AccountSettingsComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbNavModule,
    NgbModalModule,
    NgbPaginationModule,
    NgbTooltipModule,
    RouterModule.forChild(routes),
    ProductCardComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AccountLandingModule { }

