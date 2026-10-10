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
  initialX: number;
  initialY: number; // in 2D space, X=X, Y=Z (in 3D)
  onSave: (x: number, y: number) => void;
}

const FloorViewer = ({ 
  buildingId, 
  floorName, 
  position, 
  setPosition 
}: { 
  buildingId: number; 
  floorName: string; 
  position: THREE.Vector3; 
  setPosition: (p: THREE.Vector3) => void 
}) => {
  const modelUrl = `/models/${buildingId}.glb`;
  const { scene } = useGLTF(modelUrl);
  const floorMesh = useRef<THREE.Group>(null);
  
  // Clone the floor to avoid mutating the cached GLTF
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
    return (
      <mesh>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#334155" wireframe />
      </mesh>
    );
  }

  // Center the floor at origin for easier viewing
  const box = new THREE.Box3().setFromObject(floorClone);
  const center = box.getCenter(new THREE.Vector3());
  floorClone.position.x = -center.x;
  floorClone.position.y = -center.y;
  floorClone.position.z = -center.z;

  // We want to drag on the XZ plane
  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    // e.point is in world space. We need to convert it back to the original model space.
    // The marker position we store is relative to the original model coordinates.
    const worldPoint = e.point;
    // Original = worldPoint + center
    setPosition(new THREE.Vector3(worldPoint.x + center.x, 0, worldPoint.z + center.z));
  };

  const handlePointerMove = (e: any) => {
    if (e.buttons === 1) { // Left click dragging
      e.stopPropagation();
      const worldPoint = e.point;
      setPosition(new THREE.Vector3(worldPoint.x + center.x, 0, worldPoint.z + center.z));
    }
  };

  // Marker world position
  const markerPos = new THREE.Vector3(position.x - center.x, 2, position.z - center.z);

  return (
    <group>
      <primitive 
        ref={floorMesh} 
        object={floorClone} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />
      {/* Invisible plane for dragging outside the floor mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} visible={false}>
        <planeGeometry args={[100, 100]} />
      </mesh>
      
      {/* Device Marker */}
      <mesh position={markerPos}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#00B8DB" emissive="#00B8DB" emissiveIntensity={0.5} />
      </mesh>
      
      <gridHelper args={[50, 50, '#00B8DB', '#334155']} position={[0, 0, 0]} />
    </group>
  );
};

export const DevicePlacementXY = ({ open, onClose, buildingId, floorName, initialX, initialY, onSave }: Props) => {
  // initialY from the database maps to Z in 3D space (depth)
  const [pos, setPos] = useState(new THREE.Vector3(initialX, 0, initialY));

  // Reset position when opened
  useEffect(() => {
    if (open) {
      setPos(new THREE.Vector3(initialX, 0, initialY));
    }
  }, [open, initialX, initialY]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { bgcolor: '#0f172a', borderRadius: 3, border: '1px solid rgba(0,184,219,0.3)', height: '85vh' } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ color: '#00e5ff', fontWeight: 600, fontSize: 16 }}>
            Đặt vị trí trên mặt bằng (Kéo thả chấm xanh) - {floorName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>
              X: {pos.x.toFixed(2)} | Y: {pos.z.toFixed(2)}
            </Typography>
            <Button onClick={onClose} sx={{ color: '#94a3b8', minWidth: 40 }}><X size={20} /></Button>
            <Button onClick={() => onSave(pos.x, pos.z)} variant="contained" startIcon={<Check size={16} />} sx={{ bgcolor: '#00B8DB', '&:hover': { bgcolor: '#0097B5' }, textTransform: 'none' }}>
              Xong
            </Button>
          </Box>
        </Box>
        
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#020617' }}>
          <Canvas>
            <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={15} rotation={[-Math.PI / 2, 0, 0]} />
            <ambientLight intensity={1.5} />
            <Environment preset="city" />
            {open && (
              <FloorViewer buildingId={buildingId} floorName={floorName} position={pos} setPosition={setPos} />
            )}
          </Canvas>
          <Box sx={{ position: 'absolute', bottom: 20, left: 20, p: 1.5, bgcolor: 'rgba(15,23,42,0.8)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            <Typography sx={{ color: '#e2e8f0', fontSize: 12 }}>🖱️ Click hoặc kéo thả trên mặt phẳng để di chuyển thiết bị.</Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: 11, mt: 0.5 }}>Lưu ý: Tọa độ Y trong hệ thống tương ứng với trục Z (độ sâu) trong mô hình 3D.</Typography>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};
