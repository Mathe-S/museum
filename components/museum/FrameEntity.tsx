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
  const [isHovered, setIsHovered] = useState(false); // Crosshair on frame
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

    window.addEventListener('frameClick', handleFrameClick);
    return () => window.removeEventListener('frameClick', handleFrameClick);
  }, [id, onFrameClick]);



  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Frame mesh with picture frame geometry */}
      <FrameMesh
        ref={meshRef}
        frameId={id}
        imageUrl={imageUrl}
        shouldLoadTexture={shouldLoadTexture}
      />

      {/* Circle indicator when crosshair is on frame */}
      {isHovered && <CircleIndicator />}
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
  }
>(({ frameId, imageUrl, shouldLoadTexture }, ref) => {
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
      <mesh 
        ref={ref} 
        castShadow 
        receiveShadow
        userData={{ frameId }}
      >
        <boxGeometry args={[4.2, 5.0, 0.2]} />
        <meshStandardMaterial
          color="#8b4513"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Inner frame (where image goes) - Made bigger */}
      <mesh 
        position={[0, 0, 0.11]}
        userData={{ frameId }}
      >
        <boxGeometry args={[3.8, 4.5, 0.05]} />
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

import { trpc } from "@/lib/trpc/client";

// Image material component with texture loading
function ImageMaterial({
  imageUrl,
  lod,
}: {
  imageUrl: string;
  lod: "high" | "low";
}) {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  
  // Query to get signed URL if needed
  const { data: signedUrlData } = trpc.image.getSignedUrl.useQuery(
    { filename: imageUrl },
    { 
      enabled: !!imageUrl && !imageUrl.startsWith("http"),
      staleTime: 1000 * 60 * 55, // Cache for 55 minutes (urls expire in 60)
    }
  );

  useEffect(() => {
    if (imageUrl.startsWith("http")) {
      setTextureUrl(imageUrl);
    } else if (signedUrlData) {
      setTextureUrl(signedUrlData.url);
    }
  }, [imageUrl, signedUrlData]);

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
    // Check if URL is valid (not a placeholder like "test-image.jpg")
    if (!url || url === "test-image.jpg" || !url.startsWith("http")) {
      setError(true);
      return;
    }

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
        // Only log error if it's not a placeholder URL
        if (url !== "test-image.jpg") {
          console.error("Error loading texture from URL:", url, err);
        }
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


