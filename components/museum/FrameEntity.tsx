"use client";

import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMuseumStore } from "@/lib/store/museum-store";

interface FrameEntityProps {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  imageUrl: string | null;
  onFrameClick?: (frameId: string) => void;
}

export function FrameEntity({
  id,
  position,
  rotation,
  imageUrl,
  onFrameClick,
}: FrameEntityProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false); // Crosshair on frame
  // Default to true so images try to load immediately. We rely on LOD/distance for unloading if needed.
  const [shouldLoadTexture, setShouldLoadTexture] = useState(true);
  const { camera } = useThree();

  const processingFrames = useMuseumStore((state) => state.processingFrames);
  const isProcessing =
    processingFrames[id] === "uploading" || processingFrames[id] === "deleting";

  // Calculate distance from camera to determine LOD and lazy loading
  useFrame(() => {
    if (!meshRef.current) return;

    const distance = camera.position.distanceTo(position);

    // Lazy loading: load texture within 60 units
    if (distance <= 60 && !shouldLoadTexture && imageUrl) {
      setShouldLoadTexture(true);
    }

    // Unload texture beyond 80 units to save memory (increased buffer)
    if (distance > 80 && shouldLoadTexture) {
      setShouldLoadTexture(false);
    }
  });

  // Raycasting for crosshair detection (center of screen) - works at any distance
  useFrame(({ camera }) => {
    if (!meshRef.current) return;

    // Check center of screen with small area
    const centerPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.1, 0),
      new THREE.Vector2(-0.1, 0),
      new THREE.Vector2(0, 0.1),
      new THREE.Vector2(0, -0.1),
    ];

    let shouldHover = false;

    for (const point of centerPoints) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(point, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        shouldHover = true;
        break;
      }
    }

    if (shouldHover !== isHovered) {
      setIsHovered(shouldHover);
    }
  });

  // Listen for custom frameClick event from center-screen raycasting
  useEffect(() => {
    const handleFrameClick = (event: Event) => {
      const frameId = (event as any).frameId;
      if (frameId === id && onFrameClick) {
        onFrameClick(id);
      }
    };

    window.addEventListener("frameClick", handleFrameClick);
    return () => window.removeEventListener("frameClick", handleFrameClick);
  }, [id, onFrameClick]);

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Frame mesh with picture frame geometry */}
      <FrameMesh
        ref={meshRef}
        frameId={id}
        imageUrl={imageUrl}
        shouldLoadTexture={shouldLoadTexture}
        isProcessing={isProcessing}
      />

      {/* Circle indicator when crosshair is on frame (only if empty) */}
      {isHovered && !imageUrl && !isProcessing && <CircleIndicator />}
    </group>
  );
}

// Frame mesh component with LOD system
const FrameMesh = React.forwardRef<
  THREE.Mesh,
  {
    frameId: string;
    imageUrl: string | null;
    shouldLoadTexture: boolean;
    isProcessing: boolean;
  }
>(({ frameId, imageUrl, shouldLoadTexture, isProcessing }, ref) => {
  const { camera } = useThree();
  const [currentLOD, setCurrentLOD] = useState<"high" | "low">("high");

  // LOD system: high-res < 10 units, low-res > 10 units
  useFrame(() => {
    if (!ref || typeof ref === "function" || !ref.current) return;

    const distance = camera.position.distanceTo(ref.current.position);
    const newLOD = distance < 10 ? "high" : "low";

    if (newLOD !== currentLOD) {
      setCurrentLOD(newLOD);
    }
  });

  return (
    <>
      {/* Picture frame border - Made bigger */}
      <mesh ref={ref} castShadow receiveShadow userData={{ frameId }}>
        <boxGeometry args={[4.2, 5.0, 0.2]} />
        <meshStandardMaterial color="#8b4513" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Inner frame backing */}
      <mesh position={[0, 0, 0.1]} userData={{ frameId }}>
        <boxGeometry args={[3.8, 4.5, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Loading Spinner Overlay */}
      {isProcessing && (
        <group position={[0, 0, 0.15]}>
          <LoadingSpinner />
        </group>
      )}

      {/* Image Plane - Show if exists and not deleted, or if uploading (keep old image until new one ready if replace) */}
      {imageUrl && shouldLoadTexture && !isProcessing && (
        <AsyncImage
          key={imageUrl} // Force remount when URL changes
          imageUrl={imageUrl}
          frameId={frameId}
        />
      )}
    </>
  );
});

FrameMesh.displayName = "FrameMesh";

import { trpc } from "@/lib/trpc/client";

// AsyncImage component that handles signed URLs and texture loading with spinner
function AsyncImage({
  imageUrl,
  frameId,
}: {
  imageUrl: string;
  frameId: string;
}) {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Query to get signed URL if needed
  const { data: signedUrlData } = trpc.image.getSignedUrl.useQuery(
    { filename: imageUrl },
    {
      enabled: !!imageUrl && !imageUrl.startsWith("http"),
      staleTime: 1000 * 60 * 55, // Cache for 55 minutes
    }
  );

  // Resolve texture URL
  useEffect(() => {
    if (imageUrl.startsWith("http")) {
      setTextureUrl(imageUrl);
    } else if (signedUrlData) {
      setTextureUrl(signedUrlData.url);
    }
  }, [imageUrl, signedUrlData]);

  // Load texture once URL is resolved
  useEffect(() => {
    if (!textureUrl) return;

    setLoading(true);
    const loader = new THREE.TextureLoader();

    loader.load(
      textureUrl,
      (loadedTexture) => {
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.colorSpace = THREE.SRGBColorSpace;

        setTexture(loadedTexture);
        setLoading(false);
        setError(false);
      },
      undefined,
      (err) => {
        if (textureUrl !== "test-image.jpg") {
          console.error("Error loading texture:", err);
        }
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      if (texture) texture.dispose();
    };
  }, [textureUrl]);

  if (loading) {
    return (
      <group>
        {/* Dark background while loading */}
        <mesh position={[0, 0, 0.14]} userData={{ frameId }}>
          <planeGeometry args={[3.8, 4.5]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <LoadingSpinner />
      </group>
    );
  }

  if (error || !texture) {
    return (
      <mesh position={[0, 0, 0.14]} userData={{ frameId }}>
        <planeGeometry args={[3.8, 4.5]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    );
  }

  return (
    <mesh position={[0, 0, 0.14]} userData={{ frameId }}>
      <planeGeometry args={[3.8, 4.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// Loading spinner component
function LoadingSpinner() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.z -= delta * 4; // Rotate
    }
  });

  return (
    <mesh ref={ref} position={[0, 0, 0.15]}>
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  );
}

// Circle indicator for empty frames
function CircleIndicator() {
  return (
    <mesh position={[0, 0, 0.2]}>
      <ringGeometry args={[0.6, 0.75, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
