import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RobberCharacter3DProps {
  position: [number, number, number];
  onComplete: () => void;
}

export function RobberCharacter3D({
  position,
  onComplete,
}: RobberCharacter3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(0);

  useEffect(() => {
    startTime.current = Date.now();

    // Call onComplete after animation duration (4 seconds)
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / 4, 1); // 4 second animation

    // Animation phases
    if (progress < 0.3) {
      // Phase 1: Appear and approach (0-1.2s)
      const phaseProgress = progress / 0.3;
      groupRef.current.position.z = position[2] + 3 - phaseProgress * 3;
      groupRef.current.scale.setScalar(phaseProgress);
    } else if (progress < 0.7) {
      // Phase 2: At frame, grabbing (1.2-2.8s)
      groupRef.current.position.z = position[2];
      groupRef.current.scale.setScalar(1);

      // Bob up and down
      const bobProgress = (progress - 0.3) / 0.4;
      groupRef.current.position.y =
        position[1] + Math.sin(bobProgress * Math.PI * 4) * 0.1;
    } else {
      // Phase 3: Walk away (2.8-4s)
      const phaseProgress = (progress - 0.7) / 0.3;
      groupRef.current.position.z = position[2] + phaseProgress * 5;
      groupRef.current.scale.setScalar(1 - phaseProgress * 0.5);

      // Walking animation
      groupRef.current.rotation.y = Math.sin(phaseProgress * Math.PI * 6) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body - Torso */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 1, 0.4]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>

      {/* Mask over eyes */}
      <mesh position={[0, 0.75, 0.24]}>
        <planeGeometry args={[0.4, 0.1]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Hat */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.15, 16]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Left Arm */}
      <mesh position={[-0.45, 0.2, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>

      {/* Right Arm */}
      <mesh position={[0.45, 0.2, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>

      {/* Left Leg */}
      <mesh position={[-0.15, -0.8, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Right Leg */}
      <mesh position={[0.15, -0.8, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Suitcase with painting */}
      <group position={[-0.7, -0.3, 0]} rotation={[0, 0, 0.2]}>
        {/* Suitcase body */}
        <mesh>
          <boxGeometry args={[0.5, 0.7, 0.1]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>

        {/* Suitcase handle */}
        <mesh position={[0, 0.45, 0]}>
          <torusGeometry args={[0.15, 0.03, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#654321" />
        </mesh>

        {/* Painting inside (visible edge) */}
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[0.4, 0.6]} />
          <meshStandardMaterial color="#ffd700" />
        </mesh>

        {/* Frame edge of painting */}
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[0.42, 0.02, 0.01]} />
          <meshStandardMaterial color="#8b6914" />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[0.02, 0.62, 0.01]} />
          <meshStandardMaterial color="#8b6914" />
        </mesh>
      </group>

      {/* Spotlight on robber */}
      <pointLight
        position={[0, 2, 1]}
        intensity={2}
        distance={4}
        color="#ff0000"
      />
    </group>
  );
}
