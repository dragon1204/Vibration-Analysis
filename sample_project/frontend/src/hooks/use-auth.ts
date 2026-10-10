import { useQuery } from '@tanstack/react-query';
import { useContext, useEffect } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import authService from '@/services/auth/auth.service';

const useAuth = () => {
  const [authState, authDispatch] = useContext(AuthContext);

  const authQuery = useQuery({
    enabled: !authState.isAuth,
    queryKey: ['auth/getUserInfo'],
    queryFn: () => authService.getUserInfo(),
    retry: false,
  });

  useEffect(() => {
    if (authQuery.isSuccess) {
      authDispatch({ type: 'setIsAuth', payload: true });
      authDispatch({ type: 'setCurrentUser', payload: authQuery.data });
    }

    if (authQuery.isError) {
      authDispatch({ type: 'setIsAuth', payload: false });
      authDispatch({ type: 'setCurrentUser', payload: undefined });
    }
  }, [authQuery.isSuccess, authQuery.isError]);

  return authQuery;
};

export default useAuth;
