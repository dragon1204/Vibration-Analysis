import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PumpModelProps {
  position?: [number, number, number];
  name?: string;
  onStateChange?: (isOn: boolean) => void;
}

export default function PumpModel({ position = [0, 0, 0], name = "Pump", onStateChange }: PumpModelProps) {
  // Tham chiếu đến Mesh để có thể tạo hiệu ứng quay/animation
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Trạng thái bật/tắt thiết bị
  const [isOn, setIsOn] = useState(false);
  const [hovered, setHover] = useState(false);

  // Animation quay (nếu thiết bị đang bật)
  useFrame((state, delta) => {
    if (isOn && meshRef.current) {
      meshRef.current.rotation.y += delta * 2; // Tốc độ quay
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation(); // Ngăn sự kiện click xuyên qua các vật thể khác
    const newState = !isOn;
    setIsOn(newState);
    
    // Gọi callback để báo cho thẻ cha hoặc gọi API
    if (onStateChange) {
      onStateChange(newState);
    }
    
    // TODO: Gắn logic gọi API MQTT tới backend tại đây
    // bmsService.controlDevice({ deviceId: '123', status: newState })
    console.log(`Device ${name} turned ${newState ? 'ON' : 'OFF'}`);
  };

  return (
    <group position={position}>
      {/* Tạm thời dùng hình trụ (Cylinder) để mô phỏng máy bơm/quạt */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 2, 32]} />
        {/* Đổi màu đỏ (Tắt) / Xanh (Bật). Nếu chuột hover thì sáng lên chút */}
        <meshStandardMaterial 
          color={isOn ? '#4caf50' : '#f44336'} 
          emissive={hovered ? '#666' : '#000'}
        />
      </mesh>
      
      {/* Thêm một khối đế ở dưới cho đẹp */}
      <mesh position={[0, -1.2, 0]} receiveShadow>
        <boxGeometry args={[2.5, 0.4, 2.5]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
    </group>
  );
}
