import { Box } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';

import Sidebar from '../../components/SideBar';
import AssetCategoryPanel from './components/assets/categories/AssetCategoryPanel';
import { AssetManagementPanel } from './components/assets/management/AssetManagementPanel';
import BuildingManagementPanel from './components/building-management/BuildingManagementPanel';
import DeviceManagementPanel from './components/building-management/DeviceManagementPanel';
import FloorManagementPanel from './components/building-management/FloorManagementPanel';
import UrbanManagementPanel from './components/building-management/UrbanManagementPanel';
import DocumentTypePanel from './components/document-management/document-types';
import DocumentPanel from './components/document-management/documents-management';
import MeterTypePanel from './components/meter-management/meter-types';
import MeterPanel from './components/meter-management/meters';
import UtilityMeterReadingPanel from './components/meter-management/utility-meter-readings';
import { WarehousePanel } from './components/assets/warehouse/WarehousePanel';
import HrManagementPanel from './system/HrManagementPanel';
import ManagementDepartmentPanel from './system/ManagementDepartmentPanel';
import { IOCMENU } from './utils/menuConfig';

// const IOC_BACKGROUND =
//   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=100&w=2048';

const IocPage = () => {
  const [open, setOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string>('');

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 20,
          bottom: 20,
          width: 260,
          overflowY: 'auto',
          zIndex: 9,
        }}
      >
        <Sidebar
          openPanel={open}
          setOpenPanel={setOpen}
          onSubClick={(id) => setActiveMenu(id)}
          title="VIETTEL IOC"
          state="Online"
          data={IOCMENU}
          bottom_title="IOC SYSTEM STATUS"
          bgcolor="rgba(0,184,219,0.18)"
          borderColor="rgba(0,184,219,0.4)"
          iconColor="#00B8DB"
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 300,
          right: 20,
          bottom: 90,
          overflow: 'hidden',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <AnimatePresence>
          {/* Building Management */}
          {activeMenu === 'urban-mgmt' && <UrbanManagementPanel />}
          {activeMenu === 'building-mgmt' && <BuildingManagementPanel />}
          {activeMenu === 'floor-mgmt' && <FloorManagementPanel />}
          {activeMenu === 'device-mgmt' && <DeviceManagementPanel />}
          {/* Asset Management */}
          {activeMenu === 'asset-category' && <AssetCategoryPanel />}
          {activeMenu === 'org-structure' && <ManagementDepartmentPanel />}
          {activeMenu === 'hr-management' && <HrManagementPanel />}
          {activeMenu === 'assets' && <AssetManagementPanel />}
          {activeMenu === 'import-export' && <WarehousePanel />}
          {activeMenu === 'meter-types' && <MeterTypePanel />}
          {activeMenu === 'meter-list' && <MeterPanel />}
          {activeMenu === 'meter-readings' && <UtilityMeterReadingPanel />}
          {activeMenu === 'doc-types' && <DocumentTypePanel />}
          {activeMenu === 'doc-list' && <DocumentPanel />}
        </AnimatePresence>
      </Box>
    </>
  );
};

export default IocPage;
