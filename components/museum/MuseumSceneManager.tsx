"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useMuseumStore } from "@/lib/store/museum-store";
import { useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { DesktopControls } from "./DesktopControls";
import { MobileControls, VirtualJoystick } from "./MobileControls";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";

interface MuseumSceneManagerProps {
  children?: React.ReactNode;
  collisionBoundaries?: THREE.Box3[];
  navigationEnabled?: boolean;
  cameraPosition?: [number, number, number];
  cameraLookAt?: [number, number, number];
}

export function MuseumSceneManager({
  children,
  collisionBoundaries = [],
  navigationEnabled = true,
  cameraPosition = [0, 1.6, 5],
  cameraLookAt,
}: MuseumSceneManagerProps) {
  const themeMode = useMuseumStore((state) => state.themeMode);
  const [isMobile, setIsMobile] = useState(false);
  const [joystickDirection, setJoystickDirection] = useState({ x: 0, y: 0 });
  const queryClient = useQueryClient();

  // Recreate TRPC client to bridge context into Canvas
  const [trpcClient] = useState(() => {
    // Handle SSR case
    if (typeof window === "undefined") {
      return trpc.createClient({
        links: [
          httpBatchLink({
            url: "/api/trpc", // Fallback for SSR (though this component usually runs on client)
            transformer: superjson,
          }),
        ],
      });
    }

    return trpc.createClient({
      links: [
        httpBatchLink({
          url: `${window.location.origin}/api/trpc`,
          transformer: superjson,
        }),
      ],
    });
  });

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleJoystickChange = useCallback((x: number, y: number) => {
    setJoystickDirection({ x, y });
  }, []);

  return (
    <>
      <Canvas
        key={cameraPosition.join(",")} // Force re-render when camera position changes
        camera={{
          fov: 75,
          near: 0.1,
          far: 1000,
          position: cameraPosition,
        }}
        gl={{
          powerPreference: "high-performance",
          antialias: typeof window !== "undefined" && window.innerWidth > 768,
          alpha: false,
          stencil: false, // Disable stencil buffer for performance
          depth: true,
        }}
        dpr={
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio, 2)
            : 1
        }
        frameloop="always" // Always render for smooth controls
        onCreated={({ gl, scene, camera }) => {
          // Configure renderer for performance
          gl.setClearColor(0x000000);
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = false; // Manual shadow updates for performance

          // Performance optimizations
          gl.outputColorSpace = THREE.SRGBColorSpace;

          // Enable frustum culling (enabled by default in Three.js)
          camera.matrixAutoUpdate = true;

          // Set scene fog for depth perception and performance (hides far objects)
          scene.fog = new THREE.Fog(0x000000, 30, 120);

          // Set initial camera look direction if provided
          if (cameraLookAt) {
            camera.lookAt(
              new THREE.Vector3(
                cameraLookAt[0],
                cameraLookAt[1],
                cameraLookAt[2]
              )
            );
          }
        }}
      >
        {/* Lighting based on theme */}
        <SceneLighting themeMode={themeMode} />

        {/* Center-screen click handler for pointer lock mode */}
        <CenterClickHandler />

        {/* Desktop navigation controls (WASD + mouse) */}
        {!isMobile && collisionBoundaries.length > 0 && (
          <DesktopControls
            collisionBoundaries={collisionBoundaries}
            enabled={navigationEnabled}
          />
        )}

        {/* Mobile navigation controls (joystick + touch drag) */}
        {isMobile && collisionBoundaries.length > 0 && (
          <MobileControls
            collisionBoundaries={collisionBoundaries}
            enabled={navigationEnabled}
            joystickDirection={joystickDirection}
          />
        )}

        {/* Children components (museum layout, frames, etc.) */}
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </trpc.Provider>
      </Canvas>
      {/* Virtual joystick overlay for mobile */}
      {isMobile && <VirtualJoystick onDirectionChange={handleJoystickChange} />}
    </>
  );
}

interface SceneLightingProps {
  themeMode: "day" | "night";
}

function SceneLighting({ themeMode }: SceneLightingProps) {
  useEffect(() => {
    // Theme change effect can trigger additional logic if needed
  }, [themeMode]);

  if (themeMode === "day") {
    return (
      <>
        {/* Day theme: bright directional light simulating sunlight */}
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        {/* Ambient light for overall scene illumination */}
        <ambientLight intensity={0.6} />

        {/* Hemisphere light for natural sky/ground color gradient */}
        <hemisphereLight
          color={0xffffff}
          groundColor={0x444444}
          intensity={0.4}
        />
      </>
    );
  }

  // Night theme: reduced intensity with moonlight effect
  return (
    <>
      {/* Night theme: dim directional light simulating moonlight */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.4}
        color={0xaaccff}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Dim ambient light for night atmosphere */}
      <ambientLight intensity={0.15} color={0x6688aa} />

      {/* Subtle hemisphere light for night sky effect */}
      <hemisphereLight
        color={0x223344}
        groundColor={0x111111}
        intensity={0.2}
      />
    </>
  );
}

// Component to handle clicks from center of screen when pointer is locked
function CenterClickHandler() {
  const { camera, scene, gl } = useThree();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only handle clicks when pointer is locked
      if (document.pointerLockElement !== gl.domElement) {
        return;
      }

      // Raycast from center of screen
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

      // Get all intersectable objects (frames)
      const intersects = raycaster.intersectObjects(scene.children, true);

      // Find the first frame mesh that was hit
      for (const intersect of intersects) {
        const object = intersect.object;

        // Check if this is a frame mesh (has userData with frameId)
        if (object.userData && object.userData.frameId) {
          // Trigger click event on the frame
          const clickEvent = new Event("frameClick");
          (clickEvent as any).frameId = object.userData.frameId;
          window.dispatchEvent(clickEvent);
          break;
        }
      }
    };

    gl.domElement.addEventListener("click", handleClick);

    return () => {
      gl.domElement.removeEventListener("click", handleClick);
    };
  }, [camera, scene, gl]);

  return null;
}
