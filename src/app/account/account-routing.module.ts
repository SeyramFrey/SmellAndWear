import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Component Pages
import { LoginComponent } from "./login/login.component";
import { AuthCallbackComponent } from "./auth-callback/auth-callback.component";
import { AdminInviteComponent } from "./admin-invite/admin-invite.component";
import { ResetPasswordComponent } from "./reset-password/reset-password.component";
import { ForgotPasswordComponent } from "./forgot-password/forgot-password.component";

/**
 * Account (Admin Auth) Routes
 * 
 * Authentication architecture for SmellAndWear admin:
 * 
 * /auth/login            - Admin login page
 * /auth/forgot-password  - Request password reset email
 * /auth/reset-password   - Password reset (after email link click)
 * /auth/callback         - OAuth, signup confirmation, magic links
 * /auth/invite           - Admin invitation acceptance (dedicated)
 * 
 * Each flow has its own dedicated route to ensure:
 * - Clean separation of concerns
 * - Proper handling of different auth types
 * - Clear redirect URL configuration in Supabase
 */
const routes: Routes = [
  {
    path: "login",
    component: LoginComponent
  },
  {
    path: "forgot-password",
    component: ForgotPasswordComponent
  },
  {
    path: "reset-password",
    component: ResetPasswordComponent
  },
  {
    path: "callback",
    component: AuthCallbackComponent
  },
  {
    path: "invite",
    component: AdminInviteComponent
  },
  {
    path: "",
    redirectTo: "login",
    pathMatch: "full"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountRoutingModule { }
