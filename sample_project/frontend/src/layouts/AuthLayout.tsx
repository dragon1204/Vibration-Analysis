import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '@/hooks/use-auth';
import appService from '@/services/app/app.service';

const AuthLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const authQuery = useAuth();
  const isRedirecting =
    authQuery.data && location.pathname.startsWith('/auth');

  useEffect(() => {
    if (authQuery.isLoading) {
      appService.showLoadingModal();
      return;
    }
    if (authQuery.data || authQuery.isError) {
      setTimeout(() => {
        appService.hideLoadingModal();
      }, 500);
    }
    if (authQuery.data) {
      if (location.pathname.startsWith('/auth')) {
        navigate(location.state?.from || '/', { replace: true });
      }
    }
  }, [authQuery, location.pathname, location.state?.from, navigate]);

  if (isRedirecting) return null;

  return <Outlet />;
};

export default AuthLayout;
