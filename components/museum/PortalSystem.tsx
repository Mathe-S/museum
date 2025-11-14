"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface PortalSystemProps {
  position: THREE.Vector3;
  onMuseumSwitch?: (museumId: string) => void;
  onNavigationPause?: (paused: boolean) => void;
}

export function PortalSystem({ position, onMuseumSwitch, onNavigationPause }: PortalSystemProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isInPortalZone, setIsInPortalZone] = useState(false);
  const { camera } = useThree();

  // Check if camera is in portal zone
  useFrame(() => {
    if (!meshRef.current) return;

    const distance = camera.position.distanceTo(position);
    const inZone = distance < 3; // 3 units radius

    if (inZone !== isInPortalZone) {
      setIsInPortalZone(inZone);
      if (inZone) {
        onNavigationPause?.(true);
      } else {
        onNavigationPause?.(false);
      }
    }
  });

  // Trigger museum selector when entering zone
  useEffect(() => {
    if (isInPortalZone && onMuseumSwitch) {
      // Use a custom event to communicate with the parent outside Canvas
      const event = new CustomEvent('portalZoneEntered');
      window.dispatchEvent(event);
    }
  }, [isInPortalZone, onMuseumSwitch]);

  return (
    <>
      {/* Portal 3D Mesh */}
      <PortalMesh ref={meshRef} position={position} isActive={isInPortalZone} />
    </>
  );
}

// Portal 3D Mesh Component
const PortalMesh = React.forwardRef<
  THREE.Mesh,
  { position: THREE.Vector3; isActive: boolean }
>(({ position, isActive }, ref) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Animate portal when active
  useFrame(({ clock }) => {
    if (materialRef.current) {
      const time = clock.getElapsedTime();
      materialRef.current.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
      
      if (isActive) {
        materialRef.current.emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.2;
      }
    }
  });

  return (
    <group position={position}>
      {/* Main portal cylinder */}
      <mesh ref={ref} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 3, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#4a90e2"
          emissive="#2a5a9a"
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Glowing ring effect */}
      <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.1, 16, 32]} />
        <meshBasicMaterial color="#4a90e2" transparent opacity={0.6} />
      </mesh>

      <mesh position={[0, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.1, 16, 32]} />
        <meshBasicMaterial color="#4a90e2" transparent opacity={0.6} />
      </mesh>

      {/* Particle effect when active */}
      {isActive && <PortalParticles />}
    </group>
  );
});

PortalMesh.displayName = "PortalMesh";

// Portal particle effect
function PortalParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  const particleCount = 50;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 1.2 + Math.random() * 0.5;
    const height = (Math.random() - 0.5) * 3;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [positions]);

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial size={0.1} color="#4a90e2" transparent opacity={0.8} />
    </points>
  );
}

