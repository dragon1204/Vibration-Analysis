import Cookies from 'js-cookie';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const token = Cookies.get('accessToken');

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
