import { createBrowserRouter } from 'react-router-dom';

import AuthLayout from '@/layouts/AuthLayout';
import LoginPage from '@/pages/auth/login.page';
import NotFoundPage from '@/pages/not-found.page';
import BuildingLayout from '@/pages/smart-building/layout';
// import SmartBuilding from '@/pages/smart-building';
import { BUILDING_ROUTES } from '@/pages/smart-building/routes';

import ContentLayout from '../layouts/ContentLayout';
import HomePage from '../pages/home';
import { homeRoutes } from '../pages/home/routes';

import ProtectedRoute from '@/components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '',
    element: <ProtectedRoute />,
    children: [
      {
        path: '',
        element: <ContentLayout />,
        children: [
          {
            path: '/',
            element: <HomePage />,
            children: homeRoutes,
          },
        ],
      },
      {
        path: '/:urbanSlug/:buildingSlug',
        element: <BuildingLayout />,
        children: BUILDING_ROUTES,
      },
    ],
  },
  {
    path: 'auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '404',
    element: <NotFoundPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
