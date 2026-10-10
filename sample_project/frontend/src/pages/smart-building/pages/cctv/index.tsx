import { Box, Typography, Chip } from '@mui/material';
import { useState, useMemo } from 'react';
import { Camera, Video, VideoOff, Maximize2 } from 'lucide-react';

import BuildingSidebar from '../../components/BuildingSidebar';
import { useBuilding } from '@/contexts/BuildingContext';
import { CCTV_DEVICE_TYPES } from '@/constants/device-systems';
import CameraGrid from './components/CameraGrid';
import ViewModeHeader from './components/ViewModeHeader';

const SecurityCamera = () => {
  const [viewMode, setViewMode] = useState<'1x1' | '2x2' | '3x3'>('2x2');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const { currentFloor, floorDevices } = useBuilding();

  // Filter CCTV devices from DB
  const cctvDevices = useMemo(() => {
    return floorDevices.filter((d) => CCTV_DEVICE_TYPES.includes(d.type as any));
  }, [floorDevices]);

  // Map DB devices to camera format for CameraGrid
  const cameras = useMemo(() => {
    return cctvDevices.map((d) => ({
      id: d.id,
      name: d.name,
      location: `${d.deviceId || ''} • ${currentFloor?.name || ''}`,
      streamUrl: (d.attributes as any)?.streamUrl || (d.configuration as any)?.streamUrl || '',
      status: (d.isOnline !== false ? 'online' : 'offline') as 'online' | 'offline',
    }));
  }, [cctvDevices, currentFloor]);

  const handleCameraSelect = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    setViewMode('1x1');
  };

  const handleViewModeChange = (mode: '1x1' | '2x2' | '3x3') => {
    setViewMode(mode);
    if (mode !== '1x1') {
      setSelectedCameraId(null);
    }
  };

  const onlineCount = cameras.filter((c) => c.status === 'online').length;

  return (
    <>
      {/* Sidebar */}
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 20,
          bottom: 90,
          width: 280,
          zIndex: 9,
        }}
      >
        <BuildingSidebar systemFilter="cctv" />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 320,
          right: 20,
          bottom: 90,
          overflow: 'hidden',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Camera size={18} color="#ef4444" />
            <Typography sx={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
              Camera giám sát
            </Typography>
            <Chip
              label={`${onlineCount}/${cameras.length} online`}
              size="small"
              sx={{ height: 22, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
            />
          </Box>
          <ViewModeHeader viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        </Box>

        {/* Camera Grid / Empty state */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(2,6,23,0.85)',
          }}
        >
          {cameras.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <VideoOff size={48} color="#475569" />
              <Typography sx={{ color: '#64748b', fontSize: 14 }}>
                Chưa có camera nào trên tầng này
              </Typography>
              <Typography sx={{ color: '#475569', fontSize: 12 }}>
                Chọn tầng từ sidebar bên trái để xem camera
              </Typography>
            </Box>
          ) : (
            <CameraGrid
              cameras={cameras}
              viewMode={viewMode}
              selectedCameraId={selectedCameraId}
            />
          )}
        </Box>
      </Box>
    </>
  );
};

export default SecurityCamera;
