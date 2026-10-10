export interface ILoginInput {
  email: string;
  password: string;
}

export interface ILoginResult {
  accessToken: string;
  expireInSeconds: number;
  refreshToken?: string;
  userId?: string;
}

export interface IUserInfo {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IRefreshTokenResult {
  accessToken: string;
  expireInSeconds: number;
}

export interface IAuthState {
  currentUser?: IUserInfo;
  isAuth: boolean;
}

export type TAuthActionType = 'logout' | 'setIsAuth' | 'setCurrentUser';
