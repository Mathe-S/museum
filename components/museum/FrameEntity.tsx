"use client";

import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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
  const [isHovered, setIsHovered] = useState(false);
  const [shouldLoadTexture, setShouldLoadTexture] = useState(false);
  const { camera } = useThree();

  // Calculate distance from camera to determine LOD and lazy loading
  useFrame(() => {
    if (!meshRef.current) return;

    const distance = camera.position.distanceTo(position);

    // Lazy loading: load texture within 15 units
    if (distance <= 15 && !shouldLoadTexture && imageUrl) {
      setShouldLoadTexture(true);
    }

    // Unload texture beyond 30 units to save memory
    if (distance > 30 && shouldLoadTexture) {
      setShouldLoadTexture(false);
    }

    // Remove hover indicator when camera moves away (< 100ms handled by state)
    if (distance > 5 && isHovered) {
      setIsHovered(false);
    }
  });

  // Raycasting for hover detection
  useFrame(({ raycaster }) => {
    if (!meshRef.current) return;

    // Simple raycasting check
    const intersects = raycaster.intersectObject(meshRef.current);
    const shouldHover = intersects.length > 0;

    if (shouldHover !== isHovered) {
      setIsHovered(shouldHover);
    }
  });

  const handleClick = () => {
    if (onFrameClick) {
      onFrameClick(id);
    }
  };

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Frame mesh with picture frame geometry */}
      <FrameMesh
        ref={meshRef}
        imageUrl={imageUrl}
        shouldLoadTexture={shouldLoadTexture}
        onClick={handleClick}
      />

      {/* Hover indicators */}
      {isHovered && (
        <>
          {!imageUrl ? (
            <CircleIndicator />
          ) : (
            <HighlightIndicator />
          )}
        </>
      )}
    </group>
  );
}

// Frame mesh component with LOD system
const FrameMesh = React.forwardRef<
  THREE.Mesh,
  {
    imageUrl: string | null;
    shouldLoadTexture: boolean;
    onClick: () => void;
  }
>(({ imageUrl, shouldLoadTexture, onClick }, ref) => {
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
      {/* Picture frame border */}
      <mesh onClick={onClick} ref={ref} castShadow receiveShadow>
        <boxGeometry args={[2.8, 3.3, 0.15]} />
        <meshStandardMaterial
          color="#8b4513"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Inner frame (where image goes) */}
      <mesh position={[0, 0, 0.08]} onClick={onClick}>
        <boxGeometry args={[2.5, 3, 0.05]} />
        {imageUrl && shouldLoadTexture ? (
          <ImageMaterial
            imageUrl={imageUrl}
            lod={currentLOD}
          />
        ) : (
          <meshStandardMaterial color="#1a1a1a" />
        )}
      </mesh>
    </>
  );
});

FrameMesh.displayName = "FrameMesh";

// Image material component with texture loading
function ImageMaterial({
  imageUrl,
  lod,
}: {
  imageUrl: string;
  lod: "high" | "low";
}) {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);

  useEffect(() => {
    // In a real implementation, we would:
    // 1. Compress images to WebP format on upload
    // 2. Generate multiple sizes (thumbnail, medium, full)
    // 3. Load appropriate size based on LOD
    
    // For now, we'll use the original URL
    // In production, this would be:
    // const url = lod === "high" ? `${imageUrl}?size=full` : `${imageUrl}?size=medium`;
    setTextureUrl(imageUrl);
  }, [imageUrl, lod]);

  if (!textureUrl) {
    return <meshStandardMaterial color="#1a1a1a" />;
  }

  return <TextureLoader url={textureUrl} />;
}

// Texture loader component
function TextureLoader({ url }: { url: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    
    loader.load(
      url,
      (loadedTexture) => {
        // Compress textures and generate mipmaps
        loadedTexture.generateMipmaps = true;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = 4;
        
        // Set texture wrapping
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        setTexture(loadedTexture);
        setError(false);
      },
      undefined,
      (err) => {
        console.error("Error loading texture:", err);
        setError(true);
      }
    );

    return () => {
      // Cleanup texture on unmount
      if (texture) {
        texture.dispose();
      }
    };
  }, [url]);

  if (error || !texture) {
    return <meshStandardMaterial color="#1a1a1a" />;
  }

  return <meshStandardMaterial map={texture} />;
}

// Circle indicator for empty frames
function CircleIndicator() {
  return (
    <mesh position={[0, 0, 0.15]}>
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Highlight indicator for filled frames
function HighlightIndicator() {
  const [opacity, setOpacity] = useState(0.3);

  // Pulsing animation
  useFrame(({ clock }) => {
    setOpacity(0.3 + Math.sin(clock.getElapsedTime() * 3) * 0.2);
  });

  return (
    <mesh position={[0, 0, 0.15]}>
      <planeGeometry args={[2.6, 3.1]} />
      <meshBasicMaterial
        color="#4a90e2"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


