import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';

import { LoginLandingComponent } from './login/login-landing.component';
import { SignupLandingComponent } from './signup/signup-landing.component';

const routes: Routes = [
  { path: 'login', component: LoginLandingComponent },
  { path: 'signup', component: SignupLandingComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    LoginLandingComponent,
    SignupLandingComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbToastModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AuthLandingModule { }

