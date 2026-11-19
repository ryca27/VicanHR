
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { map } from 'rxjs';
import { AuthService } from './authentication.service';
import { UserRole } from './authentication.model';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles =
    route.data['roles'] as UserRole[] | undefined;

  return authService.loadUser().pipe(
    map(user => {

      // Not logged in
      if (!user) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      // Logged in but no permission
      if (
        allowedRoles &&
        !allowedRoles.includes(user.role)
      ) {
        return router.createUrlTree(['/unauthorized']);
      }

      // Allowed to access page
      return true;
    })
  );
};
