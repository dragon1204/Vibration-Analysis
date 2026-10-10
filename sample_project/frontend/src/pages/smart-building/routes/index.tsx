import { Navigate } from 'react-router-dom';

import AccessControl from '../pages/acs';
import BuildingManagement from '../pages/bms';
import SecurityCamera from '../pages/cctv';
import EnergyManagement from '../pages/ems';
import IocPage from '../pages/ioc';
import Overview from '../pages/overview';
import Parking from '../pages/parking';
import RoleManagement from '../pages/roles';
import DeviceRulesPage from '../pages/rules';
import UserManagement from '../pages/users';

export const BUILDING_ROUTES = [
  {
    index: true,
    element: <Navigate to="overview" replace />,
  },
  {
    path: 'overview',
    element: <Overview />,
  },
  {
    path: 'bms',
    element: <BuildingManagement />,
  },
  {
    path: 'cctv',
    element: <SecurityCamera />,
  },
  {
    path: 'ems',
    element: <EnergyManagement />,
  },
  {
    path: 'acs',
    element: <AccessControl />,
  },
  {
    path: 'parking',
    element: <Parking />,
  },
  {
    path: 'users',
    element: <UserManagement />,
  },
  {
    path: 'roles',
    element: <RoleManagement />,
  },
  {
    path: 'ioc',
    element: <IocPage />,
  },
  {
    path: 'device-rules',
    element: <DeviceRulesPage />,
  },
];

