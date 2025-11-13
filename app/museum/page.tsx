"use client";

import { MuseumSceneManager } from "@/components/museum/MuseumSceneManager";
import { useMuseumStore } from "@/lib/store/museum-store";

export default function MuseumPage() {
  const themeMode = useMuseumStore((state) => state.themeMode);
  const toggleTheme = useMuseumStore((state) => state.toggleTheme);

  return (
    <div className="relative h-screen w-screen">
      {/* 3D Scene */}
      <MuseumSceneManager>
        {/* Temporary ground plane for testing */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#888888" />
        </mesh>

        {/* Temporary test cube */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff6b6b" />
        </mesh>
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
        <h2 className="font-bold mb-1">Museum Scene Manager Test</h2>
        <p className="text-sm opacity-90">
          Current theme: <span className="font-semibold">{themeMode}</span>
        </p>
        <p className="text-xs opacity-75 mt-2">
          Toggle the theme to see lighting changes. The scene uses optimized
          renderer settings with frustum culling enabled.
        </p>
      </div>
    </div>
  );
}
