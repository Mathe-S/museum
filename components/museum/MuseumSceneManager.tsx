"use client";

import { Canvas } from "@react-three/fiber";
import { useMuseumStore } from "@/lib/store/museum-store";
import { useEffect } from "react";
import * as THREE from "three";

interface MuseumSceneManagerProps {
  children?: React.ReactNode;
}

export function MuseumSceneManager({ children }: MuseumSceneManagerProps) {
  const themeMode = useMuseumStore((state) => state.themeMode);

  return (
    <Canvas
      camera={{
        fov: 75,
        near: 0.1,
        far: 1000,
        position: [0, 1.6, 5],
      }}
      gl={{
        powerPreference: "high-performance",
        antialias: typeof window !== "undefined" && window.innerWidth > 768,
        alpha: false,
      }}
      dpr={
        typeof window !== "undefined"
          ? Math.min(window.devicePixelRatio, 2)
          : 1
      }
      frameloop="always"
      onCreated={({ gl, scene, camera }) => {
        // Configure renderer for performance
        gl.setClearColor(0x000000);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;

        // Enable frustum culling (enabled by default in Three.js)
        camera.matrixAutoUpdate = true;

        // Set scene fog for depth perception
        scene.fog = new THREE.Fog(0x000000, 10, 100);
      }}
    >
      {/* Lighting based on theme */}
      <SceneLighting themeMode={themeMode} />

      {/* Children components (museum layout, frames, etc.) */}
      {children}
    </Canvas>
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
