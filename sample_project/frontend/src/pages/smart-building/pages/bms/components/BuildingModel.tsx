import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface BuildingModelProps {
  url: string;
  onSelectFloor?: (floorName: string) => void;
}

const BuildingModel = ({ url, onSelectFloor }: BuildingModelProps) => {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (scene) {
      console.log('--- 3D Model Hierarchy ---');
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          console.log('Mesh Name:', child.name);
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Tự động căn giữa
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x += (scene.position.x - center.x);
      scene.position.y += (scene.position.y - center.y);
      scene.position.z += (scene.position.z - center.z);
      const newBox = new THREE.Box3().setFromObject(scene);
      scene.position.y -= newBox.min.y;
    }
  }, [scene]);

  // Hiệu ứng highlight
  useFrame(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const isSelected = mesh.name === selected || mesh.parent?.name === selected;
        const isHovered = mesh.name === hovered || mesh.parent?.name === hovered;

        if (isSelected) {
          (mesh.material as THREE.MeshStandardMaterial).emissive?.set('#3b82f6');
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
        } else if (isHovered) {
          (mesh.material as THREE.MeshStandardMaterial).emissive?.set('#ffffff');
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        } else {
          (mesh.material as THREE.MeshStandardMaterial).emissive?.set('#000000');
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
    });
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    // Tìm object hoặc group cha có tên chứa 'floor' hoặc 'b'
    let target = e.object;
    while (target && !target.name.toLowerCase().includes('floor') && !target.name.toLowerCase().match(/^b\d+/)) {
      target = target.parent;
      if (target === scene) break;
    }

    if (target && target.name) {
      const floorName = target.name;
      console.log('Selected Floor:', floorName);
      setSelected(floorName);
      if (onSelectFloor) onSelectFloor(floorName);
    }
  };

  return (
    <primitive 
      ref={modelRef}
      object={scene} 
      onClick={handleClick}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        setHovered(e.object.name);
      }}
      onPointerOut={() => setHovered(null)}
    />
  );
};

export default BuildingModel;


