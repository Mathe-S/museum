"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface VisitorAvatarProps {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

/**
 * Generate a consistent color for a visitor based on their ID
 */
function getVisitorColor(id: string): THREE.Color {
  // Hash the ID to get a consistent color
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate HSL color with good saturation and lightness
  const hue = Math.abs(hash % 360);
  const saturation = 70 + (Math.abs(hash >> 8) % 20); // 70-90%
  const lightness = 50 + (Math.abs(hash >> 16) % 15); // 50-65%

  return new THREE.Color().setHSL(hue / 360, saturation / 100, lightness / 100);
}

/**
 * VisitorAvatar component - Renders a 3D avatar for other visitors
 * Features:
 * - Capsule-shaped mesh (cylinder with spherical caps)
 * - Unique color per visitor
 * - Name label overlay
 * - Smooth position interpolation
 * - LOD based on distance
 * - Frustum culling
 */
export function VisitorAvatar({
  id,
  name,
  position,
  rotationY,
}: VisitorAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(
    new THREE.Vector3(position.x, position.y, position.z)
  );
  const currentPosition = useRef(
    new THREE.Vector3(position.x, position.y, position.z)
  );
  const targetRotation = useRef(rotationY);
  const currentRotation = useRef(rotationY);

  const { camera } = useThree();
  const [distance, setDistance] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Generate consistent color for this visitor
  const visitorColor = useMemo(() => getVisitorColor(id), [id]);

  // Update target position when prop changes
  useEffect(() => {
    targetPosition.current.set(position.x, position.y, position.z);
    targetRotation.current = rotationY;
  }, [position.x, position.y, position.z, rotationY]);

  // Smooth interpolation and LOD updates
  useFrame(() => {
    if (!groupRef.current) return;

    // Lerp position for smooth movement
    const lerpFactor = 0.15; // Adjust for smoothness vs responsiveness
    currentPosition.current.lerp(targetPosition.current, lerpFactor);
    groupRef.current.position.copy(currentPosition.current);

    // Lerp rotation
    currentRotation.current = THREE.MathUtils.lerp(
      currentRotation.current,
      targetRotation.current,
      lerpFactor
    );
    groupRef.current.rotation.y = currentRotation.current;

    // Calculate distance to camera for LOD
    const dist = camera.position.distanceTo(currentPosition.current);
    setDistance(dist);

    // Frustum culling check
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const sphere = new THREE.Sphere(currentPosition.current, 1.5);
    const visible = frustum.intersectsSphere(sphere);
    setIsVisible(visible);

    // Hide if outside frustum or too far
    if (groupRef.current) {
      groupRef.current.visible = visible && dist < 100;
    }
  });

  // Determine LOD level based on distance
  const lodLevel = useMemo(() => {
    if (distance < 10) return "high";
    if (distance < 30) return "medium";
    return "low";
  }, [distance]);

  // Capsule geometry (cylinder with sphere caps)
  const capsuleGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(
      0.3,
      0.3,
      1.2,
      lodLevel === "high" ? 16 : lodLevel === "medium" ? 8 : 4
    );
    return geometry;
  }, [lodLevel]);

  const sphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(
      0.3,
      lodLevel === "high" ? 16 : lodLevel === "medium" ? 8 : 4,
      lodLevel === "high" ? 12 : lodLevel === "medium" ? 6 : 4
    );
  }, [lodLevel]);

  // Show name label only when close enough
  const showNameLabel = distance < 15;

  return (
    <group ref={groupRef}>
      {/* Avatar body (cylinder) */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <primitive object={capsuleGeometry} />
        <meshStandardMaterial
          color={visitorColor}
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>

      {/* Avatar head (sphere) */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <primitive object={sphereGeometry} />
        <meshStandardMaterial
          color={visitorColor}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Bottom sphere cap */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry
          args={[
            0.3,
            lodLevel === "high" ? 16 : 8,
            lodLevel === "high" ? 8 : 4,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ]}
        />
        <meshStandardMaterial
          color={visitorColor}
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>

      {/* Name label (HTML overlay) */}
      {showNameLabel && isVisible && (
        <Html
          position={[0, 2.2, 0]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0, 0, 0, 0.75)",
              color: "white",
              padding: "4px 12px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "500",
              whiteSpace: "nowrap",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * VisitorAvatarManager component - Manages rendering of multiple avatars with instancing
 * Note: Full instancing implementation will be in task 27
 */
interface VisitorAvatarManagerProps {
  visitors: Map<
    string,
    {
      id: string;
      name: string;
      position: { x: number; y: number; z: number };
      rotationY: number;
    }
  >;
  maxVisitors?: number;
}

export function VisitorAvatarManager({
  visitors,
  maxVisitors = 50,
}: VisitorAvatarManagerProps) {
  // Limit to 50 concurrent avatars for performance
  const visitorArray = useMemo(() => {
    return Array.from(visitors.values()).slice(0, maxVisitors);
  }, [visitors, maxVisitors]);

  return (
    <>
      {visitorArray.map((visitor) => (
        <VisitorAvatar
          key={visitor.id}
          id={visitor.id}
          name={visitor.name}
          position={visitor.position}
          rotationY={visitor.rotationY}
        />
      ))}
    </>
  );
}
