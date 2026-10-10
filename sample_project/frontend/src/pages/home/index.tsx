import { Box } from '@mui/material';
import {
  Building2,
  CircleCheckBig,
  CircleX,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import urbanService, { type Urban } from '@/services/urban/urban.service';

import type { BuildingCardData } from '../../services/app/home.model';
import BuildingCard from './components/BuildingCard';
import BuildingMap from './components/BuildingMap';
import OverviewChart from './components/OverviewChart';

const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [urbans, setUrbans] = useState<Urban[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await urbanService.getAllUrban();
        setUrbans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch urbans:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Tính toán thống kê từ dữ liệu thật
  const totalBuildings = urbans.reduce(
    (sum, u) => sum + (u._count?.buildings || u.buildings?.length || 0),
    0,
  );

  const buildingCards: BuildingCardData[] = [
    {
      title: 'Tổng Số Tòa Nhà',
      count: loading ? '...' : totalBuildings,
      status: 'Đang quản lý',
      icon: Building2,
      variant: 'info',
    },
    {
      title: 'Bình thường',
      count: loading ? '...' : totalBuildings,
      status: 'Đang hoạt động',
      icon: CircleCheckBig,
      variant: 'success',
    },
    {
      title: 'Cảnh báo',
      count: 0,
      status: 'Cần theo dõi',
      icon: TriangleAlert,
      variant: 'warning',
    },
    {
      title: 'Sự cố',
      count: 0,
      status: 'Cần xử lý ngay',
      icon: CircleX,
      variant: 'error',
    },
  ];

  const handleFullscreen = () => {
    navigate('overview');
  };

  const handleBuildingClick = (building: any) => {
    // Navigate using slugs from API data
    const urbanSlug = building.urbanSlug || 'urban';
    const buildingSlug = building.slug || building.code || building.id;
    navigate(`/${urbanSlug}/${buildingSlug}/overview`);
  };

  const handleMapClick = () => {
    navigate('overview');
  };

  // If on child route, render Outlet
  if (location.pathname !== '/') {
    return <Outlet />;
  }

  return (
    <Box
      sx={{
        mx: 3,
        px: 3,
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Building Cards Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 3,
        }}
      >
        {buildingCards.map((card, index) => (
          <BuildingCard
            key={index}
            title={card.title}
            count={card.count}
            status={card.status}
            icon={card.icon}
            variant={card.variant}
          />
        ))}
      </Box>

      {/* Building Map & Trend Chart Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'repeat(2, 1fr)',
          },
          gap: 3,
        }}
      >
        <BuildingMap
          urbans={urbans}
          onFullscreen={handleFullscreen}
          onBuildingClick={handleBuildingClick}
          onMapClick={handleMapClick}
        />
        <OverviewChart />
      </Box>
    </Box>
  );
};

export default HomePage;
