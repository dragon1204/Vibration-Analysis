import { Box, IconButton, Typography } from '@mui/material';
import { MapPin, Maximize2 } from 'lucide-react';

import VnMap from '@/assets/images/vietnam-map.png';
import type { Urban } from '@/services/urban/urban.service';
import { theme } from '@/theme';

interface BuildingMapProps {
  urbans?: Urban[];
  onFullscreen?: () => void;
  onBuildingClick?: (building: any) => void;
  onMapClick?: () => void;
}

const BuildingMap = ({
  urbans = [],
  onFullscreen,
  onBuildingClick,
  onMapClick,
}: BuildingMapProps) => {
  // Hàm tính toán tọa độ phần trăm trên ảnh dựa trên Bounding Box đã được căn chỉnh
  const getMapCoordinates = (lat?: number | null, lon?: number | null) => {
    if (!lat || !lon) {
      return {
        left: `${30 + Math.random() * 40}%`,
        top: `${20 + Math.random() * 60}%`,
      };
    }
    // Các giới hạn tọa độ để khớp với tỷ lệ ảnh tĩnh vietnam-map.png
    const minLon = 99.0;
    const maxLon = 114.5;
    const minLat = 7.5;
    const maxLat = 24.5;

    const left = ((lon - minLon) / (maxLon - minLon)) * 100;
    const top = ((maxLat - lat) / (maxLat - minLat)) * 100;

    return {
      left: `${Math.max(5, Math.min(95, left))}%`,
      top: `${Math.max(5, Math.min(95, top))}%`,
    };
  };

  // Flatten all buildings from all urbans, with map coordinates
  const buildings = urbans.flatMap((urban) =>
    (urban.buildings || []).map((b: any) => {
      const coords = getMapCoordinates(urban.latitude, urban.longitude);
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        slug: b.slug,
        urbanSlug: urban.slug,
        urbanCode: urban.code,
        left: coords.left,
        top: coords.top,
        status: 'normal' as const,
      };
    }),
  );

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'rgba(30, 41, 59, 0.9)',
        backdropFilter: 'blur(4px)',
        border: `1px solid ${theme.palette.base.cyanAlpha[200]}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: theme.palette.semantic.info.light,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <MapPin size={20} />
          Bản Đồ Tòa Nhà ({buildings.length})
        </Typography>

        <IconButton
          title="Xem toàn màn hình"
          onClick={onFullscreen}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: 'rgba(51, 65, 85, 0.5)',
            border: '1px solid #475569',
            color: theme.palette.semantic.info.light,
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: 'rgba(71, 85, 105, 0.5)',
              borderColor: theme.palette.semantic.info.main,
            },
          }}
        >
          <Maximize2 size={16} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
            Toàn màn hình
          </Typography>
        </IconButton>
      </Box>

      {/* Map Container */}
      <Box
        onClick={onMapClick}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          bgcolor: theme.palette.base.slateDarkAlpha[500],
          borderRadius: 2,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {/* Map Image */}
        <Box
          component="img"
          src={VnMap}
          alt="Vietnam Map"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.6,
          }}
        />

        {/* Building Pins from real data */}
        {buildings.map((building) => (
          <Box
            key={building.id}
            onClick={(e) => {
              e.stopPropagation();
              onBuildingClick?.(building);
            }}
            title={building.name}
            sx={{
              position: 'absolute',
              left: building.left,
              top: building.top,
              cursor: 'pointer',
              transform: 'translate(-50%, -50%)',
              '&:hover': {
                zIndex: 10,
                transform: 'translate(-50%, -50%) scale(1.3)',
              },
              transition: 'transform 0.2s ease',
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: theme.palette.semantic.success.light,
                boxShadow: `0 10px 15px -3px rgba(52, 211, 153, 0.5)`,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  bgcolor: theme.palette.semantic.success.light,
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                  '@keyframes ping': {
                    '75%, 100%': {
                      transform: 'scale(2)',
                      opacity: 0,
                    },
                  },
                }}
              />
            </Box>
          </Box>
        ))}

        {/* No data message */}
        {buildings.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Chưa có tòa nhà nào. Hãy tạo Urban và Building trong hệ thống.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BuildingMap;
