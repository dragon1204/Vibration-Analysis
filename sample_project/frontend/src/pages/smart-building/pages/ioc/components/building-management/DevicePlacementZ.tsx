import { Box, Button, Dialog, Typography } from '@mui/material';
import { Environment, OrthographicCamera, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Check, X } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId: number;
  floorName: string;
  floorHeight: number;
  deviceType: string;
  initialZ: number; // in 3D space, this maps to Y (up)
  onSave: (z: number) => void;
}

const FloorViewerZ = ({ 
  buildingId, 
  floorName, 
  floorHeight,
  positionZ, 
  setPositionZ 
}: { 
  buildingId: number; 
  floorName: string; 
  floorHeight: number;
  positionZ: number; 
  setPositionZ: (z: number) => void 
}) => {
  const modelUrl = `/models/${buildingId}.glb`;
  const { scene } = useGLTF(modelUrl);
  const floorMesh = useRef<THREE.Group>(null);
  
  const floorClone = useMemo(() => {
    let targetFloor: THREE.Object3D | null = null;
    scene.traverse((child) => {
      if (child.name === floorName) {
        targetFloor = child.clone();
      }
    });
    return targetFloor;
  }, [scene, floorName]);

  if (!floorClone) {
    return null;
  }

  // Center the floor at origin, but keep Y starting from 0
  const box = new THREE.Box3().setFromObject(floorClone);
  const center = box.getCenter(new THREE.Vector3());
  floorClone.position.x = -center.x;
  floorClone.position.z = -center.z;
  floorClone.position.y = -box.min.y;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    let newY = e.point.y;
    newY = Math.max(0, Math.min(floorHeight, newY));
    setPositionZ(newY);
  };

  const handlePointerMove = (e: any) => {
    if (e.buttons === 1) { // Left click dragging
      e.stopPropagation();
      let newY = e.point.y;
      newY = Math.max(0, Math.min(floorHeight, newY));
      setPositionZ(newY);
    }
  };

  return (
    <group>
      <primitive 
        ref={floorMesh} 
        object={floorClone} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />
      
      {/* Invisible wall for dragging */}
      <mesh position={[0, floorHeight / 2, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} visible={false}>
        <boxGeometry args={[100, floorHeight, 100]} />
      </mesh>
      
      {/* Device Marker */}
      <mesh position={[0, positionZ, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.5} />
      </mesh>

      {/* Floor and Ceiling reference lines */}
      <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, 0, 0]} />
      <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, floorHeight, 0]} />
    </group>
  );
};

export const DevicePlacementZ = ({ open, onClose, buildingId, floorName, floorHeight, deviceType, initialZ, onSave }: Props) => {
  const [zPos, setZPos] = useState(initialZ);

  // Auto-suggest Z based on device type if initialZ is 0 (assuming new device)
  useEffect(() => {
    if (open) {
      if (initialZ !== 0) {
        setZPos(initialZ);
      } else {
        const type = deviceType?.toUpperCase() || '';
        if (['FAN', 'VAV', 'FCU', 'AHU', 'LIGHT', 'DIM_LIGHT'].includes(type)) {
          setZPos(floorHeight * 0.9); // Ceiling
        } else if (['CHILLER', 'PUMP', 'FIRE_PUMP'].includes(type)) {
          setZPos(floorHeight * 0.05); // Floor
        } else if (['CAMERA', 'FIRE_ALARM', 'CO2_METER'].includes(type)) {
          setZPos(floorHeight * 0.75); // Wall
        } else {
          setZPos(floorHeight / 2); // Middle
        }
      }
    }
  }, [open, initialZ, deviceType, floorHeight]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#0f172a', borderRadius: 3, border: '1px solid rgba(167,139,250,0.3)', height: '70vh' } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ color: '#a78bfa', fontWeight: 600, fontSize: 16 }}>
            Đặt độ cao Z (Mặt cắt dọc) - {floorName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>
              Độ cao (Z): {zPos.toFixed(2)}m
            </Typography>
            <Button onClick={onClose} sx={{ color: '#94a3b8', minWidth: 40 }}><X size={20} /></Button>
            <Button onClick={() => onSave(zPos)} variant="contained" startIcon={<Check size={16} />} sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>
              Xong
            </Button>
          </Box>
        </Box>
        
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#020617' }}>
          <Canvas>
            {/* Side view camera */}
            <OrthographicCamera makeDefault position={[50, floorHeight / 2, 0]} zoom={30} rotation={[0, Math.PI / 2, 0]} />
            <ambientLight intensity={1.5} />
            <Environment preset="city" />
            {open && (
              <FloorViewerZ buildingId={buildingId} floorName={floorName} floorHeight={floorHeight} positionZ={zPos} setPositionZ={setZPos} />
            )}
          </Canvas>

          <Box sx={{ position: 'absolute', top: '10%', right: '50%', transform: 'translateX(50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <Typography sx={{ color: '#e2e8f0', fontSize: 13, bgcolor: 'rgba(15,23,42,0.8)', px: 2, py: 0.5, borderRadius: 1 }}>
              TRẦN ({floorHeight.toFixed(1)}m)
            </Typography>
          </Box>
          <Box sx={{ position: 'absolute', bottom: '10%', right: '50%', transform: 'translateX(50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <Typography sx={{ color: '#e2e8f0', fontSize: 13, bgcolor: 'rgba(15,23,42,0.8)', px: 2, py: 0.5, borderRadius: 1 }}>
              SÀN (0.0m)
            </Typography>
          </Box>

          <Box sx={{ position: 'absolute', bottom: 20, left: 20, p: 1.5, bgcolor: 'rgba(15,23,42,0.8)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            <Typography sx={{ color: '#e2e8f0', fontSize: 12 }}>🖱️ Kéo thả thiết bị lên/xuống để đặt độ cao.</Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: 11, mt: 0.5 }}>Hệ thống đã tự động gợi ý vị trí phù hợp với loại thiết bị ({deviceType}).</Typography>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};
