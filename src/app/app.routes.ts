import { Routes } from '@angular/router'; import { authGuard } from './core/guards/auth.guard'; import { LoginComponent } from './features/auth/login.component'; import { WorkspaceComponent } from './features/workspace.component';
export const routes: Routes=[{path:'login',component:LoginComponent},{path:'',canActivate:[authGuard],component:WorkspaceComponent},{path:'**',redirectTo:''}];
