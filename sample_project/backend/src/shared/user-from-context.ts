// import { UserDto } from '@modules/users/dto/user.dto';
// import { ExecutionContext } from '@nestjs/common';


// export const userFromContext = (context: ExecutionContext) => {
//   const contextType = context.getType();

//   switch (contextType) {
//     case 'http':
//       return context.switchToHttp().getRequest().user as UserDto;
//     case 'ws':
//       return +context.switchToWs().getClient().user?.sub;
//     case 'rpc':
//     default:
//       return context.switchToRpc().getContext().user as UserDto;
//   }
// };
