import { Box } from '@mui/material';
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildingService } from '@/services/urban/building.service';
import urbanService, { type Urban } from '@/services/urban/urban.service';
import { theme } from '@/theme';

import CardInfo from './components/CardInfo';
import Popup from './components/Popup';

const MapOverview = () => {
  const navigate = useNavigate();
  const [urbans, setUrbans] = useState<Urban[]>([]);
  const [popup, setPopup] = useState<{
    open: boolean;
    buildings: Array<any>;
    urbanSlug: string;
  }>({ open: false, buildings: [], urbanSlug: '' });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<vietmapgl.Map | null>(null);
  const markersRef = useRef<vietmapgl.Marker[]>([]);
  const buildingMarkersRef = useRef<vietmapgl.Marker[]>([]);

  // Fetch urbans from API
  useEffect(() => {
    const fetchUrbans = async () => {
      try {
        const data = await urbanService.getAllUrban();
        setUrbans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch urbans:', err);
      }
    };
    fetchUrbans();
  }, []);

  const handleLocationClick = useCallback(
    async (urban: Urban, _event: React.MouseEvent) => {
      if (!mapRef.current) return;

      // Zoom to urban location
      if (urban.latitude && urban.longitude) {
        mapRef.current.flyTo({
          center: [urban.longitude, urban.latitude],
          zoom: 15,
          speed: 1.3,
          essential: true,
        });
      }

      // Fetch buildings for this urban
      try {
        const buildings = await buildingService.getBuildings(urban.id);
        const buildingList = Array.isArray(buildings) ? buildings : [];
        setPopup({
          open: true,
          buildings: buildingList.map((b) => ({
            id: b.id,
            slug: b.code || b.id.toString(),
            projectName: urban.name,
            buildingName: b.name,
            status: 'Tốt',
            alertStatus: 'Đã thiết lập',
            lat: urban.latitude || 0,
            lon: urban.longitude || 0,
          })),
          urbanSlug: urban.code || urban.id.toString(),
        });
      } catch (err) {
        console.error('Failed to fetch buildings:', err);
      }
    },
    [],
  );

  const handleBuildingClick = (urbanSlug: string, buildingSlug: string) => {
    setPopup((prev) => ({ ...prev, open: false }));
    navigate(`/${urbanSlug}/${buildingSlug}`);
  };

  // Initialize map and add markers whenever urbans data changes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Only create map once
    if (!mapRef.current) {
      const map = new vietmapgl.Map({
        container: mapContainerRef.current,
        style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${import.meta.env.VITE_VIETMAP_API_KEY}`,
        center: [106.0, 16.0],
        zoom: 5.2,
        minZoom: 4.5,
        maxZoom: 19,
        attributionControl: false,
      });

      map.addControl(
        new vietmapgl.AttributionControl({
          compact: true,
        }),
      );

      mapRef.current = map;
    }

    const map = mapRef.current;

    // Wait for map to be loaded before adding markers
    const addMarkers = () => {
      // Clean up old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Tooltip element
      let tooltip = map.getContainer().querySelector('.custom-tooltip') as HTMLDivElement;
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#000000';
        tooltip.style.color = 'white';
        tooltip.style.padding = '6px 8px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '13px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '1500';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.display = 'none';
        tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
        map.getContainer().appendChild(tooltip);
      }

      // Add markers for each urban that has coordinates
      urbans.forEach((urban) => {
        if (!urban.latitude || !urban.longitude) return;

        const buildingCount = urban._count?.buildings || urban.buildings?.length || 0;
        const statusColor = theme.palette.semantic.success.light;

        const el = document.createElement('div');
        el.style.transform = 'translate(-50%, -100%)';
        el.style.cursor = 'pointer';

        el.innerHTML = `
          <svg width="22" height="31" viewBox="0 0 22 31" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 0C5.5 0 1 4.5 1 10C1 17 11 30 11 30C11 30 21 17 21 10C21 4.5 16.5 0 11 0Z" fill="${statusColor}"/>
            <circle cx="11" cy="10" r="4" fill="white"/>
          </svg>
        `;

        const marker = new vietmapgl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([urban.longitude, urban.latitude])
          .addTo(map);

        // Hover tooltip
        el.addEventListener('mouseenter', () => {
          tooltip.textContent = `${urban.name} (${buildingCount} tòa nhà)`;
          const elRect = el.getBoundingClientRect();
          const containerRect = map.getContainer().getBoundingClientRect();
          tooltip.style.left = `${elRect.left - containerRect.left + elRect.width / 2}px`;
          tooltip.style.top = `${elRect.top - containerRect.top - 36}px`;
          tooltip.style.transform = 'translateX(-50%)';
          tooltip.style.display = 'block';
        });

        el.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none';
        });

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          handleLocationClick(urban, e as any);
        });

        markersRef.current.push(marker);
      });
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.on('load', addMarkers);
    }

    return () => {
      // Don't destroy the map on re-render, just clean markers on unmount
    };
  }, [urbans, handleLocationClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
      buildingMarkersRef.current.forEach((marker) => marker.remove());
      buildingMarkersRef.current = [];
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
        top: '60px',
      }}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      <CardInfo
        sx={{
          position: 'absolute',
          top: '20px',
          left: '80px',
          pointerEvents: 'auto',
        }}
      />

      <Popup
        open={popup.open}
        onClose={() => setPopup({ ...popup, open: false })}
        buildings={popup.buildings}
        onBuildingClick={(buildingSlug) =>
          handleBuildingClick(popup.urbanSlug, buildingSlug)
        }
      />
    </Box>
  );
};

export default MapOverview;
