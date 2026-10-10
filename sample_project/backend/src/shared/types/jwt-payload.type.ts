export type TJwtPayload = {
  sub: number;
  username: string;
  name: string;
  role: string;
  iat?: number;
  exp?: number;
};
