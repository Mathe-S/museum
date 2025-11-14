"use client";

import { Canvas } from "@react-three/fiber";
import { useMuseumStore } from "@/lib/store/museum-store";
import { useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { DesktopControls } from "./DesktopControls";
import { MobileControls, VirtualJoystick } from "./MobileControls";

interface MuseumSceneManagerProps {
  children?: React.ReactNode;
  collisionBoundaries?: THREE.Box3[];
  navigationEnabled?: boolean;
  cameraPosition?: [number, number, number];
}

export function MuseumSceneManager({ children, collisionBoundaries = [], navigationEnabled = true, cameraPosition = [0, 1.6, 5] }: MuseumSceneManagerProps) {
  const themeMode = useMuseumStore((state) => state.themeMode);
  const [isMobile, setIsMobile] = useState(false);
  const [joystickDirection, setJoystickDirection] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleJoystickChange = useCallback((x: number, y: number) => {
    setJoystickDirection({ x, y });
  }, []);

  return (
    <>
    <Canvas
      key={cameraPosition.join(',')} // Force re-render when camera position changes
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
      }}
    >
      {/* Lighting based on theme */}
      <SceneLighting themeMode={themeMode} />

      {/* Desktop navigation controls (WASD + mouse) */}
      {!isMobile && collisionBoundaries.length > 0 && (
        <DesktopControls collisionBoundaries={collisionBoundaries} enabled={navigationEnabled} />
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
      {children}
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
