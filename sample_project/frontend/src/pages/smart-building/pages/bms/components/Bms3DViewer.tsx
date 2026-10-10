import { Box, Typography, Chip, IconButton } from '@mui/material';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';

import type { IDevice } from '@/services/building-device/device.model';
import { getDeviceCustomIcon } from './DeviceIcons';

/* ─── Constants ─── */
const FLOOR_HEIGHT_3D = 0.5;
const EXPLODE_GAP = 10.0; // Large gap to push other floors far away
const TRANSITION_SPEED = 0.06;

/**
 * Độ cao tương đối của từng loại thiết bị so với mặt sàn (mét)
 * Dựa theo tiêu chuẩn lắp đặt cơ điện thực tế (MEP Engineering)
 */
const DEVICE_HEIGHT_OFFSETS: Record<string, number> = {
  // ── Thiết bị gắn trần (ceiling-mounted) ──
  FAN:                   2.70, // Quạt hút/cấp — trần hoặc sát tường cao
  VAV:                   2.60, // VAV box — trên duct dưới trần
  FIRE_ALARM:            2.75, // Đầu báo khói/nhiệt — gắn trần
  LIGHT:                 2.80, // Đèn trần
  DIM_LIGHT:             2.80, // Đèn trần có điều chỉnh
  CAMERA:                2.65, // Camera góc tường sát trần
  AHU:                   2.50, // AHU treo trần hoặc cao sát tường
  AHU_FILTER:            2.50,
  AHU_VALVE:             2.40,
  AHU_SENSOR_TEMPERATURE:2.20,
  PAU:                   2.50, // PAU treo trần
  PAU_FILTER:            2.50,
  PAU_VALVE:             2.40,
  PAU_SENSOR_TEMPERATURE:2.20,
  // ── Thiết bị gắn tường (wall-mounted, mid-high) ──
  FCU:                   2.10, // FCU gắn tường cao, trong căn hộ
  CO2_METER:             1.40, // Cảm biến CO2 — tầm mắt người (~1.5m)
  ELECTRIC:              1.30, // Tủ điện bảng — tầm tay (~1.2–1.5m)
  ELECTRIC_METER:        1.20, // Đồng hồ điện — tầm mắt („1.2m)
  POWER_BREAKER:         1.40, // Aptomat — bảng điện tường
  BTU_METER:             1.00, // BTU meter — gắn ống, tầm thấp
  // ── Thiết bị mặt đất / đặt sàn (floor-mounted) ──
  CHILLER:               0.40, // Chiller — đặt sàn (máy lớn)
  CHILLER_PIPE:          0.50, // Ống CHW — dưới sàn/mặt đất
  CHILLER_VALVE:         0.60, // Van CHW — trên ống thấp
  CHILLER_COLD_PUMP:     0.45, // Bơm nước lạnh — đặt sàn
  CHILLER_COOLING_PUMP:  0.45, // Bơm giải nhiệt — đặt sàn
  CHILLER_COOLING_TOWER: 0.60, // Tháp giải nhiệt — đặt sàn/mái
  FIRE_PUMP:             0.50, // Bơm PCCC — đặt sàn phòng bơm
  PUMP:                  0.45, // Bơm sinh hoạt — đặt sàn
  WATER_METER:           0.40, // Đồng hồ nước — thấp („0.4m)
};

/* ─── Device 3D marker overlay ─── */
const DeviceMarker3D = ({
  device,
  isSelected,
  onClick,
  onDragStart,
  isDragging,
}: {
  device: IDevice;
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
    else if (attrs.temp != null) quickValue = `${Number(attrs.temp).toFixed(1)}°C`;
    else if (attrs.speed != null) quickValue = `Spd: ${attrs.speed}`;
    else if (attrs.fanSpeed != null) quickValue = `Fan: ${attrs.fanSpeed}`;
    else if (attrs.pressure != null) quickValue = `${attrs.pressure}bar`;
    else if (attrs.co2 != null) quickValue = `${attrs.co2}ppm`;
    else if (attrs.brightness != null) quickValue = `${attrs.brightness}%`;
    else if (attrs.energy != null) quickValue = `${attrs.energy}kWh`;
  }

  // Đường thẳng đứng nối từ điểm đặt xuống sàn (stem line)
  const heightOffsetM = DEVICE_HEIGHT_OFFSETS[device.type] ?? 0.5;

  return (
    <group position={[device.xCoordinate ?? 0, device.zCoordinate ?? 0, device.yCoordinate ?? 0]}>
      {/* Stem line từ thiết bị xuống sàn */}
      {heightOffsetM > 0.8 && (
        <mesh position={[0, -heightOffsetM / 2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, heightOffsetM, 4]} />
          <meshBasicMaterial color={statusColor} transparent opacity={isOnline ? 0.3 : 0.08} />
        </mesh>
      )}

      <Html distanceFactor={6} zIndexRange={[100, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (!isOnline) return; // Chặn kéo thả thiết bị offline
            onDragStart?.(device);
          }}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: !isOnline ? 'default' : isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'all 0.3s ease',
            opacity: isOnline ? 1 : 0.3,
            filter: isSelected ? 'drop-shadow(0 0 14px rgba(0,229,255,0.7))'
              : isDragging ? 'drop-shadow(0 0 10px rgba(255,200,0,0.6))'
              : !isOnline ? 'grayscale(0.8)' : 'none',
            padding: 6,
          }}
        >
          {/* Icon vòng tròn chính */}
          <div style={{
            width: isSelected ? 52 : isOnline ? 40 : 30,
            height: isSelected ? 52 : isOnline ? 40 : 30,
            borderRadius: '50%',
            background: isSelected
              ? 'linear-gradient(135deg, rgba(0,229,255,0.4), rgba(0,180,219,0.25))'
              : !isOnline ? 'rgba(30,30,40,0.7)' : 'rgba(10,15,30,0.92)',
            border: `2px solid ${isSelected ? '#00e5ff' : !isOnline ? '#555' : statusColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isSelected
              ? '0 0 18px rgba(0,229,255,0.6), inset 0 0 6px rgba(0,229,255,0.2)'
              : !isOnline ? 'none'
              : `0 2px 8px rgba(0,0,0,0.5), 0 0 6px ${statusColor}60`,
            position: 'relative',
            animation: isSelected ? 'devicePulse 2s ease-in-out infinite' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                const Icon = getDeviceCustomIcon(device.type);
                const size = isSelected ? 30 : isOnline ? 22 : 16;
                return <Icon width={size} height={size} color={isSelected ? '#00e5ff' : !isOnline ? '#666' : '#e2e8f0'} />;
              })()}
            </div>
            {/* Dot trạng thái */}
            <div style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: isOnline ? 11 : 8,
              height: isOnline ? 11 : 8,
              borderRadius: '50%',
              backgroundColor: !isOnline ? '#555' : statusColor,
              border: '2px solid #0a0f1e',
              animation: isOnline && isRunning ? 'statusBlink 2s ease-in-out infinite' : 'none',
            }} />
          </div>

          {/* Label */}
          <div style={{
            marginTop: 5,
            padding: '3px 8px',
            borderRadius: 5,
            background: isSelected ? 'rgba(0,229,255,0.22)' : 'rgba(10,15,30,0.88)',
            border: `1px solid ${isSelected ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
            backdropFilter: 'blur(6px)',
            maxWidth: 90,
            textAlign: 'center' as const,
          }}>
            <div style={{
              fontSize: isOnline ? 9 : 7,
              fontWeight: 700,
              color: isSelected ? '#00e5ff' : !isOnline ? '#666' : '#e2e8f0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {device.name.replace(/\[T\d+\] /, '')}
            </div>
            {quickValue && (
              <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>
                {quickValue}
              </div>
            )}
          </div>
        </div>
        <style>{`
          @keyframes devicePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes statusBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
      </Html>
    </group>
  );
};


/* ─── Floor Label overlay ─── */
const FloorLabel = ({
  position,
  name,
  isSelected,
  isHovered,
  deviceCount,
}: {
  position: [number, number, number];
  name: string;
  isSelected: boolean;
  isHovered: boolean;
  deviceCount?: number;
}) => (
  <group position={position}>
    <Html distanceFactor={20} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          background: isSelected
            ? 'rgba(0,229,255,0.2)'
            : isHovered
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${isSelected ? '#00e5ff' : isHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
          transform: 'translate(10px, -50%)',
        }}
      >
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: isSelected ? '#00e5ff' : '#e2e8f0',
          letterSpacing: '0.05em',
        }}>
          {name}
        </span>
        {deviceCount !== undefined && deviceCount > 0 && (
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: '#94a3b8',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 4,
            padding: '2px 6px',
          }}>
            {deviceCount} devices
          </span>
        )}
      </div>
    </Html>
  </group>
);

/* ─── Camera controller using useFrame (works WITH OrbitControls) ─── */
const CameraAnimator = ({
  selectedFloor,
  floorsData,
  controlsRef,
  floorCenters,
}: {
  selectedFloor: string | null;
  floorsData: { name: string; floorNumber: number }[];
  controlsRef: React.RefObject<any>;
  floorCenters?: Record<string, THREE.Vector3>;
}) => {
  const targetPos = useRef(new THREE.Vector3(25, 35, 25));
  const targetLookAt = useRef(new THREE.Vector3(0, 20, 0));
  const isAnimating = useRef(false);
  const lastAnimatedFloor = useRef<string | null>(null);
  const lastHadCenter = useRef(false);

  useEffect(() => {
    if (selectedFloor && floorsData.length > 0) {
      const fd = floorsData.find(f => f.name.toLowerCase() === selectedFloor.toLowerCase());
      if (!fd) return;

      const center = floorCenters?.[fd.name];
      const hasCenter = !!center;

      // Skip only if same floor AND we already animated with proper center data
      if (lastAnimatedFloor.current === selectedFloor && hasCenter === lastHadCenter.current) return;
      lastAnimatedFloor.current = selectedFloor;
      lastHadCenter.current = hasCenter;

      const fallbackY = (fd.floorNumber + 2) * FLOOR_HEIGHT_3D;
      const cx = center?.x ?? 0;
      const cy = center?.y ?? fallbackY;
      const cz = center?.z ?? 0;

      // Close isometric view centered on the floor
      targetPos.current.set(cx + 4, cy + 3, cz + 4);
      targetLookAt.current.set(cx, cy, cz);
      isAnimating.current = true;
    } else {
      if (lastAnimatedFloor.current === null && !isAnimating.current) return;
      lastAnimatedFloor.current = null;
      lastHadCenter.current = false;

      // Overview: isometric view of whole building
      targetPos.current.set(25, 35, 25);
      targetLookAt.current.set(0, 20, 0);
      isAnimating.current = true;
    }
  }, [selectedFloor, floorsData, floorCenters]);

  useFrame(({ camera }) => {
    if (!isAnimating.current) return;

    const ctrl = controlsRef.current;
    if (ctrl) {
      // Disable OrbitControls damping/interaction during animation so it doesn't fight the camera
      ctrl.enabled = false;
    }

    camera.position.lerp(targetPos.current, TRANSITION_SPEED);

    if (ctrl) {
      ctrl.target.lerp(targetLookAt.current, TRANSITION_SPEED);
      ctrl.update();
    }

    // Stop animating when close enough
    if (
      camera.position.distanceTo(targetPos.current) < 0.5 &&
      (!ctrl || ctrl.target.distanceTo(targetLookAt.current) < 0.5)
    ) {
      isAnimating.current = false;
      camera.position.copy(targetPos.current);
      if (ctrl) {
        ctrl.target.copy(targetLookAt.current);
        ctrl.enabled = true;
        ctrl.update();
      }
    }
  });

  return null;
};

/* ─── Building Scene ─── */
interface FloorInfo {
  name: string;
  object: THREE.Object3D;
  originalY: number;
  visualY: number;
  center: THREE.Vector3;
  index: number;
  materials: THREE.MeshStandardMaterial[];
}

const BuildingScene = ({
  modelUrl,
  selectedFloor,
  onFloorClick,
  devices,
  selectedDeviceId,
  onDeviceSelect,
  floorDeviceCounts,
  floorsData,
  setFloorCenters,
  onDevicePositionChange,
  controlsRef,
}: {
  modelUrl: string;
  selectedFloor: string | null;
  onFloorClick: (floorName: string) => void;
  devices: IDevice[];
  selectedDeviceId?: string;
  onDeviceSelect?: (device: IDevice) => void;
  floorDeviceCounts?: Record<string, number>;
  floorsData?: { name: string; floorNumber: number }[];
  setFloorCenters?: React.Dispatch<React.SetStateAction<Record<string, THREE.Vector3>>>;
  onDevicePositionChange?: (deviceId: string, x: number, y: number) => void;
  controlsRef?: React.RefObject<any>;
}) => {
  const { scene } = useGLTF(modelUrl);
  const { camera, gl } = useThree();
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const [constructedScene, setConstructedScene] = useState<THREE.Group | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<string | null>(null);
  const [dragDeviceId, setDragDeviceId] = useState<string | null>(null);
  const [floorsReady, setFloorsReady] = useState(0);
  const floorsRef = useRef<FloorInfo[]>([]);
  const targetPositionsRef = useRef<Record<string, number>>({});
  const targetOpacitiesRef = useRef<Record<string, number>>({});
  const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const floorBoundsRef = useRef<{ minX: number; maxX: number; minZ: number; maxZ: number }>(
    { minX: -5, maxX: 5, minZ: -3, maxZ: 3 }
  );
  // Cache bounding boxes của từng tầng sau khi build (tránh recompute Box3 mỗi frame)
  const floorBoxCacheRef = useRef<Map<string, THREE.Box3>>(new Map());
  // Track pointer-down position để phân biệt click vs drag-orbit
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  // Cache emissive colors (tránh tạo new THREE.Color mỗi frame)
  const emissiveSelected = useMemo(() => new THREE.Color('#1a6b7a'), []);
  const emissiveHover    = useMemo(() => new THREE.Color('#ffffff'), []);
  const emissiveNone     = useMemo(() => new THREE.Color('#000000'), []);

  // ─── Drag-and-drop logic ───
  const dragRef = useRef<{
    deviceId: string;
    device: IDevice;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
    floorY: number;
    fMinX: number; fMaxX: number; fMinZ: number; fMaxZ: number;
    fWidth: number; fDepth: number;
  } | null>(null);

  const handleDeviceDragStart = useCallback((device: IDevice) => {
    if (!selectedFloor || !onDevicePositionChange) return;

    const selectedFloorInfo = floorsRef.current.find(
      floor => floor.name.toLowerCase() === selectedFloor.toLowerCase()
    );
    if (!selectedFloorInfo) return;

    const floorBox = new THREE.Box3().setFromObject(selectedFloorInfo.object);
    const fMinX = floorBox.min.x + 0.5;
    const fMaxX = floorBox.max.x - 0.5;
    const fMinZ = floorBox.min.z + 0.5;
    const fMaxZ = floorBox.max.z - 0.5;

    // Adaptive: match same logic as device marker placement
    const floorThicknessDrag = floorBox.max.y - floorBox.min.y;
    const dragPlaneY = floorThicknessDrag < 1.5
      ? floorBox.max.y + 0.25   // Thin slab
      : floorBox.min.y + 0.30;  // Room-height

    dragRef.current = {
      deviceId: device.id,
      device,
      startClientX: 0,
      startClientY: 0,
      hasMoved: false,
      floorY: dragPlaneY, // Drag plane at floor surface level (not ceiling)
      fMinX, fMaxX, fMinZ, fMaxZ,
      fWidth: fMaxX - fMinX,
      fDepth: fMaxZ - fMinZ,
    };
    setDragDeviceId(device.id);

    if (controlsRef?.current) {
      controlsRef.current.enabled = false;
    }
  }, [selectedFloor, onDevicePositionChange, controlsRef]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      // Set start position on first move
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
        // Clamp to floor bounds
        const clampedX = Math.max(drag.fMinX, Math.min(drag.fMaxX, intersection.x));
        const clampedZ = Math.max(drag.fMinZ, Math.min(drag.fMaxZ, intersection.z));

        // Convert 3D world → normalized coordinates (-10 to 10)
        const nx = (clampedX - drag.fMinX) / drag.fWidth; // 0..1
        const nz = (clampedZ - drag.fMinZ) / drag.fDepth;
        const normalizedX = nx * 20 - 10; // -10..10
        const normalizedZ = nz * 20 - 10;

        onDevicePositionChange?.(drag.deviceId, normalizedX, normalizedZ);
      }
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.hasMoved) {
        // Was a click, not a drag → select the device
        onDeviceSelect?.(drag.device);
      }

      // Re-enable orbit controls
      if (controlsRef?.current) {
        controlsRef.current.enabled = true;
      }
      dragRef.current = null;
      setDragDeviceId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, gl, onDevicePositionChange, onDeviceSelect, controlsRef]);

  // Build the 24-floor building
  useEffect(() => {
    if (!clonedScene) return;

    // Auto-center
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    clonedScene.position.sub(center);
    const newBox = new THREE.Box3().setFromObject(clonedScene);
    clonedScene.position.y -= newBox.min.y;
    
    // CẬP NHẬT MATRIX ĐỂ BOUNDING BOX TÍNH ĐÚNG VỊ TRÍ MỚI
    clonedScene.updateMatrixWorld(true);

    // ─── Tìm floor groups trong GLB ───────────────────────────────────────────
    // Blender GLTF thường export theo cấu trúc:  root → "Scene" → [tang_B1, tang_G, ...]
    // Không giới hạn ở top-level, traverse toàn bộ cây để bắt được mọi naming convention.
    const existingFloors: { name: string; object: THREE.Object3D; y: number }[] = [];
    const seen = new Set<THREE.Object3D>(); // tránh thêm duplicate

    const isFloorName = (name: string): boolean => {
      const nm = name.toLowerCase().trim();
      return (
        // New convention (GLB_SPECIFICATION.md): floor_B1, floor_G, floor_F01, floor_R
        nm.startsWith('floor_') ||
        // Fallback patterns
        nm.startsWith('level_') || nm.startsWith('story_') ||
        nm.match(/^f\d+$/i)
      );
    };

    clonedScene.traverse((child) => {
      if (child === clonedScene) return;
      if (!child.name || seen.has(child)) return;

      if (isFloorName(child.name)) {
        // Bỏ qua nếu PARENT của nó đã được thêm (tránh thêm cả group cha lẫn con)
        if (child.parent && seen.has(child.parent)) return;

        const floorBox = new THREE.Box3().setFromObject(child);
        if (floorBox.isEmpty()) return; // bỏ qua object rỗng
        const cy = floorBox.getCenter(new THREE.Vector3()).y;
        existingFloors.push({ name: child.name, object: child, y: cy });
        seen.add(child);
      }
    });

    // Fallback 1: Blender wraps toàn bộ scene trong 1 group "Scene"
    // → lấy children của group đó làm floors
    if (existingFloors.length === 0) {
      // Tìm "inner scene" wrapper (thường là children[0] của root GLTF)
      const innerCandidates: THREE.Object3D[] = [];
      clonedScene.children.forEach(child => {
        // Nếu child là wrapper (tên "Scene", "Root", hoặc không tên) → dùng children của nó
        const nm = child.name.toLowerCase();
        if (nm === '' || nm === 'scene' || nm === 'root' || nm === 'armature') {
          child.children.forEach(c => innerCandidates.push(c));
        } else {
          innerCandidates.push(child);
        }
      });

      const withGeom = innerCandidates.filter(c => {
        const b = new THREE.Box3().setFromObject(c);
        return !b.isEmpty();
      });

      if (withGeom.length >= 1) {
        withGeom.forEach(c => {
          const b = new THREE.Box3().setFromObject(c);
          const cy = b.getCenter(new THREE.Vector3()).y;
          existingFloors.push({ name: c.name || `group_${existingFloors.length}`, object: c, y: cy });
        });
        console.info('[BuildingScene] Fallback-1: dùng inner children làm floors:', existingFloors.map(f => f.name));
      }
    }

    // Fallback 2: không tìm thấy gì → hiển thị toàn bộ building như 1 khối đơn
    if (existingFloors.length === 0) {
      console.warn('[BuildingScene] Fallback-2: hiển thị building.glb nguyên bản (1 khối)');
      const allBox = new THREE.Box3().setFromObject(clonedScene);
      const allCenter = allBox.getCenter(new THREE.Vector3());
      const singleContainer = new THREE.Group();
      singleContainer.add(clonedScene);
      const singleFloor: FloorInfo = {
        name: 'building',
        object: clonedScene,
        originalY: 0,
        visualY: 0,
        center: allCenter,
        index: 0,
      };
      floorsRef.current = [singleFloor];
      floorBoxCacheRef.current.clear();
      floorBoxCacheRef.current.set('building', allBox);
      if (setFloorCenters) setFloorCenters({ building: allCenter });
      setFloorsReady(v => v + 1);
      setConstructedScene(singleContainer);
      return;
    }

    console.info(`[BuildingScene] Tìm thấy ${existingFloors.length} floor groups:`, existingFloors.map(f => f.name));


    // Sort existing floors by Y (bottom to top)
    existingFloors.sort((a, b) => a.y - b.y);

    // Pick a non-basement floor as a template for cloning (or last one if all basement)
    let templateFloor: THREE.Object3D;
    const nonBasement = existingFloors.filter(f => !f.name.toLowerCase().startsWith('b'));
    if (nonBasement.length > 0) {
      templateFloor = nonBasement[0].object;
    } else if (existingFloors.length > 0) {
      templateFloor = existingFloors[existingFloors.length - 1].object;
    } else {
      templateFloor = clonedScene;
    }

    // Compute actual floor height from the template mesh's bounding box
    const templateBox = new THREE.Box3().setFromObject(templateFloor);
    const actualFloorHeight = Math.max(templateBox.max.y - templateBox.min.y, 0.5);
    // Use the actual height + small gap for stacking
    const stackHeight = actualFloorHeight * 1.05; // 5% gap between floors

    // DB floors
    const sortedData = floorsData && floorsData.length > 0
      ? [...floorsData].sort((a, b) => a.floorNumber - b.floorNumber)
      : Array.from({ length: 24 }, (_, i) => ({ name: i < 2 ? `B${2 - i}` : i === 2 ? 'Ground' : `Floor ${i - 2}`, floorNumber: i - 2 }));

    // Build the container
    const floorContainer = new THREE.Group();
    const floors: FloorInfo[] = [];

    // Match a DB floor to an existing mesh in the GLB file
    const matchExisting = (dbName: string): { name: string; object: THREE.Object3D; y: number } | null => {
      const norm = dbName.toLowerCase().trim();
      for (const ef of existingFloors) {
        const efn = ef.name.toLowerCase();
        // Exact match
        if (efn === norm) return ef;
        // Partial match: both are basement and same number
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

    sortedData.forEach((fd, i) => {
      const matched = matchExisting(fd.name);
      
      let baseObject: THREE.Object3D;
      let sourceCy: number = 0;
      
      if (matched) {
        baseObject = matched.object;
        sourceCy = matched.y;
      } else {
        baseObject = templateFloor;
        // Find template floor's original cy
        const tfMatch = existingFloors.find(ef => ef.object === templateFloor);
        sourceCy = tfMatch ? tfMatch.y : 0;
      }
      
      const newFloor = baseObject.clone(true);
      newFloor.name = fd.name;
      
      // Use the actual floor height for stacking instead of the tiny constant
      const yOffset = (fd.floorNumber + 2) * stackHeight;
      newFloor.position.set(0, yOffset - sourceCy, 0);

      const floorBox = new THREE.Box3().setFromObject(newFloor);
      const floorCenter = floorBox.getCenter(new THREE.Vector3());

      const floorMaterialsSet = new Set<THREE.MeshStandardMaterial>();
      newFloor.traverse((mesh) => {
        if ((mesh as THREE.Mesh).isMesh) {
          const m = mesh as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
          
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(mat => {
            floorMaterialsSet.add(mat as THREE.MeshStandardMaterial);
          });

          if (!originalMaterialsRef.current.has(mesh.uuid)) {
            originalMaterialsRef.current.set(
              mesh.uuid,
              Array.isArray(m.material) ? m.material.map(mat => mat.clone()) : m.material.clone(),
            );
          }
        }
      });

      floorContainer.add(newFloor);

      floors.push({
        name: fd.name,
        object: newFloor,
        originalY: yOffset - sourceCy,
        visualY: yOffset,
        center: floorCenter,
        index: i,
        materials: Array.from(floorMaterialsSet),
      });
    });

    floorsRef.current = floors;
    // Build Box3 cache cho tất cả tầng
    floorBoxCacheRef.current.clear();
    floors.forEach(f => {
      floorBoxCacheRef.current.set(f.name, new THREE.Box3().setFromObject(f.object));
    });
    setFloorsReady(v => v + 1); // Force re-render so device markers can find floorsRef
    setConstructedScene(floorContainer);

    // Compute floor centers for camera and device placement
    if (setFloorCenters) {
      const centers: Record<string, THREE.Vector3> = {};
      floors.forEach(f => { centers[f.name] = f.center; });
      setFloorCenters(centers);
    }

    const sampleBox = new THREE.Box3().setFromObject(floors[0].object);
    floorBoundsRef.current = {
      minX: sampleBox.min.x + 1,
      maxX: sampleBox.max.x - 1,
      minZ: sampleBox.min.z + 1,
      maxZ: sampleBox.max.z - 1,
    };
  }, [clonedScene, floorsData]);

  // Target positions & opacities
  useEffect(() => {
    const floors = floorsRef.current;
    if (floors.length === 0) return;

    const targets: Record<string, number> = {};
    const opacities: Record<string, number> = {};

    if (!selectedFloor) {
      floors.forEach((f) => {
        targets[f.name] = f.originalY;
        opacities[f.name] = 1;
        // HIDE CEILING IF SELECTED - Restore visibility
        f.object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes('ceiling')) {
            child.visible = true;
          }
        });
      });
    } else {
      const selectedIdx = floors.findIndex((f) => f.name.toLowerCase() === selectedFloor.toLowerCase());
      if (selectedIdx === -1) {
        floors.forEach((f) => {
          targets[f.name] = f.originalY;
          opacities[f.name] = 1;
          f.object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes('ceiling')) {
              child.visible = true;
            }
          });
        });
      } else {
        floors.forEach((f, i) => {
          const isSelected = i === selectedIdx;
          if (isSelected) {
            targets[f.name] = f.originalY;
            opacities[f.name] = 1;
          } else {
            const direction = i > selectedIdx ? 1 : -1;
            const distance = Math.abs(i - selectedIdx);
            targets[f.name] = f.originalY + direction * distance * EXPLODE_GAP;
            opacities[f.name] = 0; // fully invisible — hide completely
          }
          // HIDE CEILING IF SELECTED
          f.object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes('ceiling')) {
              child.visible = !isSelected;
            }
          });
        });
      }
    }

    targetPositionsRef.current = targets;
    targetOpacitiesRef.current = opacities;
  }, [selectedFloor, floorsReady]);

  // ─── Ceiling removal: ẩn mesh trần khi chọn tầng ───────────────────────
  useEffect(() => {
    gl.localClippingEnabled = false;
    gl.clippingPlanes = [];

    const floors = floorsRef.current;
    if (floors.length === 0) return;

    // Bước 1: Khôi phục opacity các mesh đã ẩn trước đó
    floors.forEach((floorInfo) => {
      floorInfo.object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            const stdMat = mat as THREE.MeshStandardMaterial;
            stdMat.clippingPlanes = [];
            // Chỉ khôi phục nếu đã bị ẩn bởi ceiling effect
            if ((stdMat as any).__ceilHidden) {
              stdMat.opacity = (stdMat as any).__origOpacity ?? 1;
              stdMat.transparent = (stdMat as any).__origTransparent ?? false;
              delete (stdMat as any).__ceilHidden;
              stdMat.needsUpdate = true;
            }
          });
        }
      });
    });

    if (!selectedFloor) return;

    const floorInfo = floors.find(
      (f) => f.name.toLowerCase() === selectedFloor.toLowerCase()
    );
    if (!floorInfo) return;

    // Dùng cached Box3 (đã tính lúc build) — không recompute ở đây
    const floorBox = floorBoxCacheRef.current.get(floorInfo.name)
      ?? new THREE.Box3().setFromObject(floorInfo.object);
    const floorH = floorBox.max.y - floorBox.min.y;
    if (floorH < 0.8) return;

    const ceilThreshold = floorBox.min.y + floorH * 0.92;

    // Traverse và ẩn mesh trần — mỗi mesh tính Box3 1 lần
    let hiddenCount = 0;
    floorInfo.object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh    = child as THREE.Mesh;
        const meshBox = new THREE.Box3().setFromObject(mesh);
        const meshH   = meshBox.max.y - meshBox.min.y;
        const meshCtr = (meshBox.min.y + meshBox.max.y) / 2;
        const isCeiling = meshCtr > ceilThreshold && meshH < floorH * 0.3;

        if (isCeiling) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            const stdMat = mat as THREE.MeshStandardMaterial;
            // Lưu giá trị gốc để khôi phục sau
            (stdMat as any).__ceilHidden    = true;
            (stdMat as any).__origOpacity   = stdMat.opacity;
            (stdMat as any).__origTransparent = stdMat.transparent;
            stdMat.opacity     = 0;
            stdMat.transparent = true;
            stdMat.needsUpdate = true;
          });
          hiddenCount++;
        }
      }
    });

    console.debug(`[CeilingHide] ${selectedFloor}: ẩn ${hiddenCount} mesh / floorH=${floorH.toFixed(2)}m`);
  }, [selectedFloor, floorsReady, gl]);

  // Animate floor positions & opacity each frame
  useFrame(() => {
    const floors = floorsRef.current;

    floors.forEach((f) => {
      // Lerp position
      const targetY = targetPositionsRef.current[f.name] ?? f.originalY;
      const currentY = f.object.position.y;
      if (Math.abs(currentY - targetY) > 0.01) {
        f.object.position.y += (targetY - currentY) * TRANSITION_SPEED;
      }

      // Lerp opacity & highlight directly on pre-collected materials array
      const targetOpacity = targetOpacitiesRef.current[f.name] ?? 1;
      const isHovered = hoveredFloor?.toLowerCase() === f.name.toLowerCase();
      const isSelected = selectedFloor?.toLowerCase() === f.name.toLowerCase();

      f.materials.forEach((stdMat) => {
        // Opacity
        if (stdMat.opacity !== undefined) {
          const diff = targetOpacity - stdMat.opacity;
          if (Math.abs(diff) > 0.01) {
            stdMat.opacity += diff * TRANSITION_SPEED;
            stdMat.transparent = stdMat.opacity < 0.99;
          } else if (Math.abs(diff) > 0) {
            stdMat.opacity = targetOpacity;
          }
        }

        // Highlight
        if (stdMat.emissive) {
          if (isSelected) {
            stdMat.emissive.lerp(emissiveSelected, 0.1);
            stdMat.emissiveIntensity = 0.4;
          } else if (isHovered) {
            stdMat.emissive.lerp(emissiveHover, 0.1);
            stdMat.emissiveIntensity = 0.15;
          } else {
            stdMat.emissive.lerp(emissiveNone, 0.1);
            stdMat.emissiveIntensity = 0;
          }
        }
      });
    });
  });

  // Handle floor click — phân biệt click thật vs drag orbit
  // Dùng pointerDown position để bỏ qua sự kiện khi người dùng kéo camera
  const handlePointerDown = useCallback((e: any) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();

    // Nếu con trỏ đã di chuyển > 6px kể từ pointerdown → là drag, không phải click
    if (pointerDownRef.current) {
      const dx = e.clientX - pointerDownRef.current.x;
      const dy = e.clientY - pointerDownRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 6) return;
    }

    let target = e.object;
    while (target && target.parent) {
      const floorMatch = floorsRef.current.find(
        (f) => f.object === target || f.name.toLowerCase() === target.name?.toLowerCase()
      );
      if (floorMatch) {
        onFloorClick(floorMatch.name);
        return;
      }
      target = target.parent;
    }
  }, [onFloorClick]);

  const handlePointerOver = useCallback((e: any) => {
    e.stopPropagation();
    let target = e.object;
    while (target && target.parent) {
      const floorMatch = floorsRef.current.find(
        (f) => f.object === target || f.name.toLowerCase() === target.name?.toLowerCase()
      );
      if (floorMatch) {
        setHoveredFloor(floorMatch.name);
        document.body.style.cursor = 'pointer';
        return;
      }
      target = target.parent;
    }
  }, []);

  const handlePointerOut = useCallback(() => {
    setHoveredFloor(null);
    document.body.style.cursor = 'auto';
  }, []);

  if (!constructedScene) return null;

  return (
    <>
      <primitive
        object={constructedScene}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Floor labels */}
      {floorsRef.current.map((f) => (
        <FloorLabel
          key={f.name}
          position={[f.center.x + 8, f.object.position.y + 1.5, f.center.z]}
          name={f.name}
          isSelected={selectedFloor?.toLowerCase() === f.name.toLowerCase()}
          isHovered={hoveredFloor?.toLowerCase() === f.name.toLowerCase()}
          deviceCount={floorDeviceCounts?.[f.name]}
        />
      ))}

      {/* Device markers — only show for selected floor */}
      {selectedFloor && devices.length > 0 && (() => {
          const selectedFloorInfo = floorsRef.current.find(
            floor => floor.name.toLowerCase() === selectedFloor.toLowerCase()
          );
          if (!selectedFloorInfo) return null;

          // Dùng cached Box3 (tính lúc build, không recompute mỗi render)
          const floorBox = floorBoxCacheRef.current.get(selectedFloorInfo.name)
            ?? new THREE.Box3().setFromObject(selectedFloorInfo.object);
          const fMinX = floorBox.min.x + 0.5;
          const fMaxX = floorBox.max.x - 0.5;
          const fMinZ = floorBox.min.z + 0.5;
          const fMaxZ = floorBox.max.z - 0.5;
          const fWidth = fMaxX - fMinX;
          const fDepth = fMaxZ - fMinZ;

          // Vị trí Y mặt sàn (adaptive thin slab vs room-height)
          const floorThickness = floorBox.max.y - floorBox.min.y;
          const devSurfaceY = floorThickness < 1.5
            ? floorBox.max.y + 0.25
            : floorBox.min.y + 0.30;

          // Filter: devices belonging to selected floor by floorNumber
          const selectedFloorData = floorsData?.find(
            fd => fd.name.toLowerCase() === selectedFloor.toLowerCase()
          );
          const floorDevices = selectedFloorData
            ? devices.filter(d => (d as any)._floorNumber === selectedFloorData.floorNumber)
            : [];

          return floorDevices.map((device) => {
            // Vì device.xCoordinate trong DB được lưu ở dạng chuẩn hóa [-10, 10] (drag logic)
            // Ta nội suy lại ra tọa độ thực tế (world coordinate) trên mặt sàn này:
            const normX = device.xCoordinate ?? 0;
            const normZ = device.yCoordinate ?? 0; // DB uses yCoordinate for Z depth
            
            const nx = (normX + 10) / 20;
            const nz = (normZ + 10) / 20;
            
            const devX = fMinX + nx * fWidth;
            const devZ = fMinZ + nz * fDepth;
            
            if (device.id === floorDevices[0]?.id) {
              console.log('=== DEBUG DEVICE MAPPING ===');
              console.log('Floor Name:', selectedFloorInfo.name);
              console.log('Floor Center:', selectedFloorInfo.center);
              console.log('Device original coords:', device.xCoordinate, device.yCoordinate);
              console.log('Device mapped (devX, devZ):', devX, devZ);
              console.log('Floor BoundingBox Min:', floorBox.min);
              console.log('Floor BoundingBox Max:', floorBox.max);
            }

            // Áp dụng độ cao theo loại thiết bị (mét thực tế)
            const heightOffset = DEVICE_HEIGHT_OFFSETS[device.type] ?? 0.5;

            const scaledDevice = {
              ...device,
              xCoordinate: devX,
              yCoordinate: devZ,
              zCoordinate: devSurfaceY + heightOffset,
            };

            return (
              <DeviceMarker3D
                key={device.id}
                device={scaledDevice}
                isSelected={selectedDeviceId === device.id}
                onClick={() => onDeviceSelect?.(device)}
                onDragStart={handleDeviceDragStart}
                isDragging={dragDeviceId === device.id}
              />
            );
          });
        })()}
    </>
  );
};

/* ─── Main 3D Viewer ─── */
interface Bms3DViewerProps {
  modelUrl?: string;
  selectedFloor?: string | null;
  onFloorSelect?: (floorName: string) => void;
  devices?: IDevice[];
  selectedDeviceId?: string;
  onDeviceSelect?: (device: IDevice) => void;
  floorDeviceCounts?: Record<string, number>;
  floorsData?: { name: string; floorNumber: number }[];
  onDevicePositionChange?: (deviceId: string, x: number, y: number) => void;
}

const Bms3DViewer = ({
  modelUrl = '/models/model3D.glb',
  selectedFloor = null,
  onFloorSelect,
  devices = [],
  selectedDeviceId,
  onDeviceSelect,
  floorDeviceCounts,
  floorsData = [],
  onDevicePositionChange,
}: Bms3DViewerProps) => {
  const controlsRef = useRef<any>(null);
  const [floorCenters, setFloorCenters] = useState<Record<string, THREE.Vector3>>({});

  const handleFloorClick = useCallback((floorName: string) => {
    if (onFloorSelect) {
      if (selectedFloor?.toLowerCase() === floorName.toLowerCase()) {
        onFloorSelect('');
      } else {
        onFloorSelect(floorName);
      }
    }
  }, [selectedFloor, onFloorSelect]);

  return (
    <Box sx={{ width: '100%', height: '100%', background: '#0a0f1e', position: 'relative', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(0,200,255,0.1)' }}>
      {/* Title overlay */}
      <Box sx={{ position: 'absolute', top: 16, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {selectedFloor ? `Tầng: ${selectedFloor}` : 'Tổng quan tòa nhà 3D'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#64748b' }}>
            {selectedFloor
              ? `${devices.length} thiết bị — Click tầng khác hoặc nhấn Reset`
              : 'Click vào tầng để xem thiết bị'}
          </Typography>
        </Box>
      </Box>

      {/* Reset button */}
      {selectedFloor && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <IconButton
            onClick={() => onFloorSelect?.('')}
            sx={{
              bgcolor: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0,229,255,0.3)',
              color: '#00e5ff',
              '&:hover': { bgcolor: 'rgba(0,229,255,0.15)' },
            }}
            title="Xem toàn bộ tòa nhà"
          >
            <RotateCcw size={18} />
          </IconButton>
        </Box>
      )}

      {/* Floor info chip — hiển thị đúng số thiết bị của tầng được chọn */}
      {selectedFloor && (() => {
        // Đếm thiết bị thuộc đúng tầng đang chọn
        const selectedFloorData = floorsData.find(
          fd => fd.name.toLowerCase() === selectedFloor.toLowerCase()
        );
        const floorDeviceCount = selectedFloorData
          ? devices.filter(d => (d as any)._floorNumber === selectedFloorData.floorNumber).length
          : devices.length;
        return (
          <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <Chip
              label={`🏢 ${selectedFloor} — ${floorDeviceCount} thiết bị`}
              sx={{
                bgcolor: 'rgba(0,229,255,0.15)',
                color: '#00e5ff',
                border: '1px solid rgba(0,229,255,0.3)',
                fontWeight: 600,
                fontSize: 12,
                backdropFilter: 'blur(8px)',
              }}
            />
          </Box>
        );
      })()}

      <Canvas shadows camera={{ position: [25, 35, 25], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Environment preset="city" />

        <Suspense fallback={null}>
          <CameraAnimator
            selectedFloor={selectedFloor}
            floorsData={floorsData}
            controlsRef={controlsRef}
            floorCenters={floorCenters}
          />
          <BuildingScene
            modelUrl={modelUrl}
            selectedFloor={selectedFloor}
            onFloorClick={handleFloorClick}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onDeviceSelect={onDeviceSelect}
            floorDeviceCounts={floorDeviceCounts}
            floorsData={floorsData}
            setFloorCenters={setFloorCenters}
            onDevicePositionChange={onDevicePositionChange}
            controlsRef={controlsRef}
          />
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={100} blur={2.5} far={10} />
          <gridHelper args={[100, 100, '#1a1a2e', '#16162a']} position={[0, -0.01, 0]} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={120}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </Box>
  );
};

export default Bms3DViewer;

// Fix HMR cache
