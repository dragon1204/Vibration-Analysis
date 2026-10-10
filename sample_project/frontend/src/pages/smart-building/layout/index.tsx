import { Box } from '@mui/material';
import Cookies from 'js-cookie';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import CctvBackground from '@/assets/images/bms-background.png';
import ErrorBoundary from '@/components/ErrorBoundary';
import { BuildingProvider } from '@/contexts/BuildingContext';
import { DeviceSocketProvider } from '@/contexts/DeviceSocketContext';
import { ViewProvider } from '@/contexts/ViewContext';
import useAuth from '@/hooks/use-auth';

import Header from '../components/Header';
import Navbar from '../components/Navbar';
import BuildingSidebar from '../components/BuildingSidebar';

const BuildingLayout = () => {
  const token = Cookies.get('accessToken');
  const authQuery = useAuth();
  const location = useLocation();

  // Only show the shared BMS sidebar on the /bms route
  const showBmsSidebar = location.pathname.endsWith('/bms');

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  if (authQuery.isLoading) {
    return null;
  }

  return (
    <ViewProvider>
      <BuildingProvider>
      <DeviceSocketProvider>
      <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          backgroundImage: `url(${CctvBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 80,
            zIndex: 10,
          }}
        >
          <Header />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            left: 300,
            right: 20,
            bottom: 20,
            zIndex: 10,
          }}
        >
          <Navbar />
        </Box>
        {showBmsSidebar && (
          <Box
            sx={{
              position: 'absolute',
              top: 90,
              left: 20,
              bottom: 20,
              width: 280,
              overflowY: 'auto',
              zIndex: 9,
            }}
          >
            <BuildingSidebar systemFilter="bms" />
          </Box>
        )}
        <Outlet />
      </Box>
      </ErrorBoundary>
      </DeviceSocketProvider>
      </BuildingProvider>
    </ViewProvider>
  );
};

export default BuildingLayout;
