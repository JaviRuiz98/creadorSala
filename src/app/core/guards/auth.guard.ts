import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
export const authGuard: CanActivateFn = async () => { const auth=inject(AuthService); const router=inject(Router); await auth.whenReady(); return auth.session() ? true : router.createUrlTree(['/login']); };
