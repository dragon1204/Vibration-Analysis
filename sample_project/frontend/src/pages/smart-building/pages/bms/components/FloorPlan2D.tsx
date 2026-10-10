import { Box, Typography } from '@mui/material';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

import type { IDevice } from '@/services/building-device/device.model';
import deviceService from '@/services/building-device/device.service';
import { getDeviceCustomIcon } from './DeviceIcons';

/* ─── Device Marker (2D top-down overlay) ─── */
const DeviceMarker2D = ({
  device,
  isSelected,
  onClick,
  onDragStart,
  isDragging,
}: {
  device: IDevice & { _worldX: number; _worldZ: number; _worldY: number };
  isSelected: boolean;
  onClick: () => void;
  onDragStart?: (device: IDevice) => void;
  isDragging?: boolean;
}) => {
  const isOnline = device.isOnline !== false;
  const attrs = device.attributes as Record<string, any> | null;
  const isRunning = attrs?.running === 1 || attrs?.running === true || attrs?.state === 1;
  const statusColor = isOnline ? (isRunning ? '#22c55e' : '#f59e0b') : '#ef4444';

  let quickValue = '';
  if (attrs) {
    if (attrs.temperature != null) quickValue = `${Number(attrs.temperature).toFixed(1)}°C`;
    else if (attrs.speed != null) quickValue = `Spd: ${attrs.speed}`;
    else if (attrs.fanSpeed != null) quickValue = `Fan: ${attrs.fanSpeed}`;
    else if (attrs.pressure != null) quickValue = `${attrs.pressure}bar`;
  }

  return (
    <group position={[device._worldX, device._worldY + 0.05, device._worldZ]}>
      <Html zIndexRange={[100, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            onDragStart?.(device);
          }}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'all 0.2s ease',
            filter: isSelected ? 'drop-shadow(0 0 10px rgba(0,229,255,0.6))'
              : isDragging ? 'drop-shadow(0 0 6px rgba(255,200,0,0.5))' : 'none',
            padding: 4,
          }}
        >
          <div style={{
            width: isSelected ? 36 : 28,
            height: isSelected ? 36 : 28,
            borderRadius: '50%',
            background: isSelected
              ? 'linear-gradient(135deg, rgba(0,229,255,0.35), rgba(0,180,219,0.2))'
              : 'rgba(15,23,42,0.9)',
            border: `2px solid ${isSelected ? '#00e5ff' : statusColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isSelected
              ? '0 0 14px rgba(0,229,255,0.5), inset 0 0 4px rgba(0,229,255,0.2)'
              : `0 2px 6px rgba(0,0,0,0.5), 0 0 4px ${statusColor}40`,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                const Icon = getDeviceCustomIcon(device.type);
                const size = isSelected ? 22 : 16;
                return <Icon width={size} height={size} color={isSelected ? '#00e5ff' : '#e2e8f0'} />;
              })()}
            </div>
            <div style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: statusColor,
              border: '2px solid #0f172a',
              animation: isOnline && isRunning ? 'statusBlink 2s ease-in-out infinite' : 'none',
            }} />
          </div>
          <div style={{
            marginTop: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background: isSelected ? 'rgba(0,229,255,0.2)' : 'rgba(15,23,42,0.85)',
            border: `1px solid ${isSelected ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
            backdropFilter: 'blur(4px)',
            maxWidth: 80,
            textAlign: 'center' as const,
          }}>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              color: isSelected ? '#00e5ff' : '#e2e8f0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {device.name}
            </div>
            {quickValue && (
              <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>
                {quickValue}
              </div>
            )}
          </div>
        </div>
        <style>{`
          @keyframes statusBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </Html>
    </group>
  );
};

/* ─── Top-Down Floor Scene ─── */
const TopDownFloorScene = ({
  modelUrl,
  floorName,
  floorNumber,
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onDevicePositionChange,
  floorsData,
  controlsRef,
}: {
  modelUrl: string;
  floorName: string;
  floorNumber: number;
  devices: IDevice[];
  selectedDeviceId?: string;
  onDeviceSelect?: (device: IDevice) => void;
  onDevicePositionChange?: (deviceId: string, x: number, y: number) => void;
  floorsData?: { name: string; floorNumber: number }[];
  controlsRef: React.RefObject<any>;
}) => {
  const { scene } = useGLTF(modelUrl);
  const { camera, gl } = useThree();
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const [floorObject, setFloorObject] = useState<THREE.Object3D | null>(null);
  const [floorBounds, setFloorBounds] = useState<{
    minX: number; maxX: number; minZ: number; maxZ: number;
    surfaceY: number; width: number; depth: number;
  } | null>(null);

  // Drag state
  const dragRef = useRef<{
    deviceId: string;
    device: IDevice;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
    floorY: number;
  } | null>(null);
  const [dragDeviceId, setDragDeviceId] = useState<string | null>(null);

  // Build single floor
  useEffect(() => {
    if (!clonedScene) return;

    // Auto-center
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    clonedScene.position.sub(center);
    const newBox = new THREE.Box3().setFromObject(clonedScene);
    clonedScene.position.y -= newBox.min.y;

    // Find existing floor groups
    const existingFloors: { name: string; object: THREE.Object3D; y: number }[] = [];
    clonedScene.traverse((child) => {
      if (child === clonedScene) return;
      const nm = child.name.toLowerCase();
      const isFloorGroup =
        nm.startsWith('floor_') || nm.startsWith('level_') || nm.startsWith('tang_') ||
        /^b\d+/.test(nm) || /^f\d+/.test(nm);
      if (isFloorGroup && child.children.length > 0) {
        const floorBox = new THREE.Box3().setFromObject(child);
        const cy = floorBox.getCenter(new THREE.Vector3()).y;
        existingFloors.push({ name: child.name, object: child, y: cy });
      }
    });
    existingFloors.sort((a, b) => a.y - b.y);

    // Template floor
    let templateFloor: THREE.Object3D;
    const nonBasement = existingFloors.filter(f => !f.name.toLowerCase().startsWith('b'));
    if (nonBasement.length > 0) templateFloor = nonBasement[0].object;
    else if (existingFloors.length > 0) templateFloor = existingFloors[existingFloors.length - 1].object;
    else templateFloor = clonedScene;

    // Match selected floor
    const matchExisting = (dbName: string) => {
      const norm = dbName.toLowerCase().trim();
      for (const ef of existingFloors) {
        const efn = ef.name.toLowerCase();
        if (efn === norm) return ef;
        const dbNum = norm.match(/\d+/)?.[0];
        const efNum = efn.match(/\d+/)?.[0];
        if (dbNum && efNum && dbNum === efNum) {
          const dbIsB = norm.includes('b');
          const efIsB = efn.includes('b');
          if (dbIsB === efIsB) return ef;
        }
      }
      return null;
    };

    const matched = matchExisting(floorName);
    const baseObject = matched ? matched.object : templateFloor;
    const singleFloor = baseObject.clone(true);
    singleFloor.name = floorName;

    // Position at Y=0 for clean top-down view
    const sourceCy = matched ? matched.y : 0;
    singleFloor.position.set(0, -sourceCy, 0);

    // Set materials
    singleFloor.traverse((mesh) => {
      if ((mesh as THREE.Mesh).isMesh) {
        const m = mesh as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = true;
      }
    });

    // Compute bounds
    const floorBox = new THREE.Box3().setFromObject(singleFloor);
    const fMinX = floorBox.min.x + 0.5;
    const fMaxX = floorBox.max.x - 0.5;
    const fMinZ = floorBox.min.z + 0.5;
    const fMaxZ = floorBox.max.z - 0.5;

    setFloorBounds({
      minX: fMinX, maxX: fMaxX,
      minZ: fMinZ, maxZ: fMaxZ,
      surfaceY: floorBox.max.y,
      width: fMaxX - fMinX,
      depth: fMaxZ - fMinZ,
    });

    setFloorObject(singleFloor);

    // Setup orthographic camera to fit the floor
    const oc = camera as THREE.OrthographicCamera;
    const cx = (floorBox.min.x + floorBox.max.x) / 2;
    const cz = (floorBox.min.z + floorBox.max.z) / 2;
    const floorW = floorBox.max.x - floorBox.min.x;
    const floorD = floorBox.max.z - floorBox.min.z;
    const viewSize = Math.max(floorW, floorD) * 0.6;

    oc.left = -viewSize;
    oc.right = viewSize;
    oc.top = viewSize;
    oc.bottom = -viewSize;
    oc.near = -100;
    oc.far = 200;
    oc.position.set(cx, 50, cz);
    oc.lookAt(cx, 0, cz);
    oc.updateProjectionMatrix();

    // Set OrbitControls target
    if (controlsRef.current) {
      controlsRef.current.target.set(cx, 0, cz);
      controlsRef.current.update();
    }

    return () => {
      singleFloor.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
          else m.material.dispose();
          m.geometry.dispose();
        }
      });
    };
  }, [clonedScene, floorName, camera, controlsRef]);

  // Drag handlers
  const handleDeviceDragStart = useCallback((device: IDevice) => {
    if (!onDevicePositionChange || !floorBounds) return;
    dragRef.current = {
      deviceId: device.id,
      device,
      startClientX: 0,
      startClientY: 0,
      hasMoved: false,
      floorY: floorBounds.surfaceY,
    };
    setDragDeviceId(device.id);
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [onDevicePositionChange, floorBounds, controlsRef]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !floorBounds) return;

      if (drag.startClientX === 0 && drag.startClientY === 0) {
        drag.startClientX = e.clientX;
        drag.startClientY = e.clientY;
      }

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (!drag.hasMoved && Math.sqrt(dx * dx + dy * dy) > 5) {
        drag.hasMoved = true;
      }
      if (!drag.hasMoved) return;

      // Raycast to horizontal plane at floor level
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.floorY);
      const intersection = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, intersection);

      if (hit) {
        const clampedX = Math.max(floorBounds.minX, Math.min(floorBounds.maxX, intersection.x));
        const clampedZ = Math.max(floorBounds.minZ, Math.min(floorBounds.maxZ, intersection.z));

        // Convert 3D world → normalized coordinates (-10 to 10)
        const nx = (clampedX - floorBounds.minX) / floorBounds.width;
        const nz = (clampedZ - floorBounds.minZ) / floorBounds.depth;
        const normalizedX = nx * 20 - 10;
        const normalizedZ = nz * 20 - 10;

        onDevicePositionChange?.(drag.deviceId, normalizedX, normalizedZ);
      }
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.hasMoved) {
        onDeviceSelect?.(drag.device);
      }

      if (controlsRef.current) controlsRef.current.enabled = true;
      dragRef.current = null;
      setDragDeviceId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, gl, onDevicePositionChange, onDeviceSelect, controlsRef, floorBounds]);

  // Compute device world positions
  const deviceMarkers = useMemo(() => {
    if (!floorBounds || !devices.length) return [];

    // Filter devices for this floor
    const selectedFloorData = floorsData?.find(
      fd => fd.name.toLowerCase() === floorName.toLowerCase()
    );
    const floorDevices = selectedFloorData
      ? devices.filter(d => (d as any)._floorNumber === selectedFloorData.floorNumber)
      : [];

    return floorDevices.map(device => {
      const nx = ((device.xCoordinate ?? 0) + 10) / 20; // normalize 0..1
      const nz = ((device.yCoordinate ?? 0) + 10) / 20;
      const worldX = floorBounds.minX + nx * floorBounds.width;
      const worldZ = floorBounds.minZ + nz * floorBounds.depth;

      return {
        ...device,
        _worldX: worldX,
        _worldZ: worldZ,
        _worldY: floorBounds.surfaceY,
      };
    });
  }, [devices, floorBounds, floorName, floorsData]);

  return (
    <>
      {/* Blueprint-style grid background */}
      {floorBounds && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            (floorBounds.minX + floorBounds.maxX) / 2,
            -0.02,
            (floorBounds.minZ + floorBounds.maxZ) / 2,
          ]}
        >
          <planeGeometry args={[floorBounds.width + 4, floorBounds.depth + 4]} />
          <meshBasicMaterial color="#0a1628" />
        </mesh>
      )}

      {/* Grid lines for blueprint feel */}
      <gridHelper
        args={[40, 40, '#1a3a5c', '#0f2440']}
        position={[0, -0.01, 0]}
      />

      {/* Floor mesh — brighten materials for top-down clarity */}
      {floorObject && <primitive object={floorObject} />}

      {/* Enhanced lighting for clear top-down view */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, 50, 0]} intensity={0.8} castShadow={false} />
      <directionalLight position={[10, 30, 10]} intensity={0.3} castShadow={false} />

      {/* Device markers */}
      {deviceMarkers.map(device => (
        <DeviceMarker2D
          key={device.id}
          device={device}
          isSelected={selectedDeviceId === device.id}
          onClick={() => onDeviceSelect?.(device)}
          onDragStart={handleDeviceDragStart}
          isDragging={dragDeviceId === device.id}
        />
      ))}
    </>
  );
};

/* ═══════════════════════════════════════════════════ */
interface FloorPlan2DProps {
  devices: IDevice[];
  floorLevel?: number;
  floorName?: string;
  selectedDeviceId?: string;
  onDeviceSelect?: (device: IDevice) => void;
  onDevicePositionChange?: (deviceId: string, x: number, y: number) => void;
  modelUrl?: string;
  floorsData?: { name: string; floorNumber: number }[];
}

const FloorPlan2D = ({
  devices,
  floorLevel = 0,
  floorName,
  selectedDeviceId,
  onDeviceSelect,
  onDevicePositionChange,
  modelUrl = '/models/model3D.glb',
  floorsData,
}: FloorPlan2DProps) => {
  const controlsRef = useRef<any>(null);

  // Extract just the floor name (before " — ")
  const cleanFloorName = floorName?.split(' — ')[0] || 'Ground';

  // Count devices for this specific floor
  const floorDeviceCount = useMemo(() => {
    const fd = floorsData?.find(f => f.name.toLowerCase() === cleanFloorName.toLowerCase());
    if (!fd) return 0;
    return devices.filter(d => (d as any)._floorNumber === fd.floorNumber).length;
  }, [devices, floorsData, cleanFloorName]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 100%)',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(0,200,255,0.1)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#00e5ff',
              boxShadow: '0 0 8px #00e5ff',
            }}
          />
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {floorName || 'Mặt bằng tầng'}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 12 }}>
            — {floorDeviceCount} thiết bị
          </Typography>
        </Box>
        <Typography sx={{ color: '#475569', fontSize: 10, fontStyle: 'italic' }}>
          Kéo thả thiết bị để thay đổi vị trí • Scroll để zoom
        </Typography>
      </Box>

      {/* Three.js Canvas — top-down orthographic view */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Canvas
          orthographic
          camera={{
            position: [0, 50, 0],
            zoom: 1,
            near: -100,
            far: 200,
          }}
          style={{ background: '#0B1220' }}
          gl={{ antialias: true, alpha: false }}
        >
          <Suspense fallback={null}>
            <TopDownFloorScene
              modelUrl={modelUrl}
              floorName={cleanFloorName}
              floorNumber={floorLevel}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={onDeviceSelect}
              onDevicePositionChange={onDevicePositionChange}
              floorsData={floorsData}
              controlsRef={controlsRef}
            />
          </Suspense>

          <OrbitControls
            ref={controlsRef}
            enableRotate={false}
            enablePan={true}
            enableZoom={true}
            minZoom={0.3}
            maxZoom={5}
            mouseButtons={{
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
        </Canvas>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(2,6,23,0.5)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />
          <Typography sx={{ color: '#64748b', fontSize: 9 }}>Online / Running</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
          <Typography sx={{ color: '#64748b', fontSize: 9 }}>Online / Stopped</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
          <Typography sx={{ color: '#64748b', fontSize: 9 }}>Offline</Typography>
        </Box>
        <Typography sx={{ color: '#475569', fontSize: 9, ml: 'auto', fontStyle: 'italic' }}>
          Mặt cắt ngang từ model 3D
        </Typography>
      </Box>
    </Box>
  );
};

export default FloorPlan2D;
