// import { CanActivate, ExecutionContext, UseGuards } from '@nestjs/common';

// import { ERole } from '@prisma/client';
// import { Observable } from 'rxjs';

// import { userFromContext } from '@shared/user-from-context';

// export const RolesAuth = (roles: ERole[]) => {
//   class RolesGuardMixin implements CanActivate {
//     canActivate(
//       context: ExecutionContext,
//     ): boolean | Promise<boolean> | Observable<boolean> {
//       const user = userFromContext(context);

//       return roles.some((role) => user.roles?.includes(role));
//     }
//   }

//   const guard = new RolesGuardMixin();
//   return UseGuards(guard);
// };
