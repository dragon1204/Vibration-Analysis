import React, { createContext, useReducer } from 'react';
import type { Dispatch } from 'react';

import type { IAuthState, TAuthActionType } from '../services/auth/auth.model';
import authReducer from '../services/auth/auth.reducer';
import type { IContextAction } from '../services/common/common.model';

const initialState: IAuthState = {
  isAuth: false,
  currentUser: undefined,
};

export const AuthContext = createContext<
  [state: IAuthState, dispatch: Dispatch<IContextAction<TAuthActionType>>]
>([initialState, () => null]);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  return (
    <AuthContext.Provider value={[state, dispatch]}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
