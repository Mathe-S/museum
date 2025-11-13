"use client";

import { MuseumSceneManager } from "@/components/museum/MuseumSceneManager";
import { MuseumLayout } from "@/components/museum/MuseumLayout";
import { useMuseumStore } from "@/lib/store/museum-store";
import { useMemo, useState, useCallback, useEffect } from "react";
import * as THREE from "three";

export default function MuseumPage() {
  const themeMode = useMuseumStore((state) => state.themeMode);
  const toggleTheme = useMuseumStore((state) => state.toggleTheme);
  const [collisionBoundaries, setCollisionBoundaries] = useState<THREE.Box3[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCollisionBoundariesReady = useCallback((boundaries: THREE.Box3[]) => {
    setCollisionBoundaries(boundaries);
  }, []);

  // Test data: Create frames for demonstration
  const testFrames = useMemo(() => {
    const frames = [];
    
    // Main Hall: 9 frames (positions 0-8)
    for (let i = 0; i < 9; i++) {
      frames.push({
        id: `frame-${i}`,
        position: i,
        side: null,
        imageUrl: i % 3 === 0 ? "test-image.jpg" : null, // Some filled, some empty
      });
    }
    
    // Extendable Hall: 6 frames (positions 9-14) alternating left-right
    for (let i = 9; i < 15; i++) {
      frames.push({
        id: `frame-${i}`,
        position: i,
        side: (i - 9) % 2 === 0 ? "left" : "right",
        imageUrl: i % 4 === 0 ? "test-image.jpg" : null,
      });
    }
    
    return frames;
  }, []);

  return (
    <div className="relative h-screen w-screen">
      {/* 3D Scene */}
      <MuseumSceneManager collisionBoundaries={collisionBoundaries}>
        <MuseumLayout 
          frames={testFrames} 
          onCollisionBoundariesReady={handleCollisionBoundariesReady}
        />
      </MuseumSceneManager>

      {/* UI Overlay - Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-white/90 hover:bg-white text-black rounded-lg shadow-lg font-medium transition-colors"
        >
          {themeMode === "day" ? "🌙 Night Mode" : "☀️ Day Mode"}
        </button>
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg max-w-md">
        <h2 className="font-bold mb-1">Museum Layout Generator</h2>
        <p className="text-sm opacity-90">
          Current theme: <span className="font-semibold">{themeMode}</span>
        </p>
        <p className="text-xs opacity-75 mt-2">
          Main Hall: 9 frames in 3x3 grid | Extendable Hall: 6 frames alternating left-right | Portal at end
        </p>
        <p className="text-xs opacity-75 mt-1">
          {isMobile 
            ? "Use the joystick to move and drag the screen to look around."
            : "Click to lock pointer, then use WASD to move and mouse to look around. Press ESC to unlock."
          }
        </p>
      </div>
    </div>
  );
}
