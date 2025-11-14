"use client";

import { MuseumSceneManager } from "@/components/museum/MuseumSceneManager";
import { MuseumLayout } from "@/components/museum/MuseumLayout";
import { FrameInteractionModal } from "@/components/museum/FrameInteractionModal";
import { useMuseumStore } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { useMemo, useState, useCallback, useEffect } from "react";
import * as THREE from "three";

interface PublicMuseumPageProps {
  params: {
    shareToken: string;
  };
}

export default function PublicMuseumPage({ params }: PublicMuseumPageProps) {
  const { shareToken } = params;
  
  const themeMode = useMuseumStore((state) => state.themeMode);
  const toggleTheme = useMuseumStore((state) => state.toggleTheme);
  const selectedFrame = useMuseumStore((state) => state.selectedFrame);
  const setSelectedFrame = useMuseumStore((state) => state.setSelectedFrame);
  const setFrames = useMuseumStore((state) => state.setFrames);
  const setCurrentMuseum = useMuseumStore((state) => state.setCurrentMuseum);
  
  const [collisionBoundaries, setCollisionBoundaries] = useState<THREE.Box3[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isNavigationPaused, setIsNavigationPaused] = useState(false);
  const [cameraPosition] = useState<[number, number, number]>([0, 1.6, -15]);

  // Fetch public museum data
  const { data: museumData, isLoading, error } = trpc.public.getMuseumByShareToken.useQuery({
    shareToken,
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update store when museum data is loaded
  useEffect(() => {
    if (museumData) {
      const museum = {
        id: museumData.id,
        userId: "", // Not available for public access
        name: museumData.name,
        isPublic: true,
        shareToken: shareToken,
        themeMode: museumData.themeMode as "day" | "night",
        createdAt: museumData.createdAt,
        updatedAt: museumData.createdAt, // Use createdAt as fallback
      };
      
      const framesData = museumData.frames.map(frame => ({
        ...frame,
        themeColors: frame.themeColors as string[] | null,
      }));
      
      setCurrentMuseum(museum);
      setFrames(framesData);
    }
  }, [museumData, shareToken, setCurrentMuseum, setFrames]);

  const handleCollisionBoundariesReady = useCallback((boundaries: THREE.Box3[]) => {
    setCollisionBoundaries(boundaries);
  }, []);

  const handleFrameClick = useCallback((frameId: string) => {
    if (!museumData) return;
    const frame = museumData.frames.find((f) => f.id === frameId);
    if (frame) {
      setSelectedFrame({
        ...frame,
        themeColors: frame.themeColors as string[] | null,
      });
    }
  }, [museumData, setSelectedFrame]);

  const handleModalClose = useCallback(() => {
    setSelectedFrame(null);
  }, [setSelectedFrame]);

  // Pause navigation when modal is open
  useEffect(() => {
    setIsNavigationPaused(selectedFrame !== null);
  }, [selectedFrame]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading museum...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-white text-2xl font-bold mb-4">Museum Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error.message || "This museum is private or the link is invalid."}
          </p>
          <a
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-block"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  if (!museumData) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen">
      {/* 3D Scene */}
      <MuseumSceneManager 
        collisionBoundaries={collisionBoundaries}
        navigationEnabled={!isNavigationPaused}
        cameraPosition={cameraPosition}
      >
        <MuseumLayout 
          frames={museumData.frames} 
          onCollisionBoundariesReady={handleCollisionBoundariesReady}
          onFrameClick={handleFrameClick}
          onMuseumSwitch={() => {}} // Disabled for public access
          onNavigationPause={setIsNavigationPaused}
          isPublicView={true}
        />
      </MuseumSceneManager>

      {/* Frame Interaction Modal - View Only */}
      <FrameInteractionModal
        frame={selectedFrame}
        onClose={handleModalClose}
        onNavigationPause={setIsNavigationPaused}
        isPublicView={true}
      />

      {/* UI Overlay - Top Right Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-white/90 hover:bg-white text-black rounded-lg shadow-lg font-medium transition-colors"
        >
          {themeMode === "day" ? "🌙 Night Mode" : "☀️ Day Mode"}
        </button>
      </div>

      {/* Guest Banner */}
      <div className="absolute top-4 left-4 z-10 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg">
        <p className="font-medium">👁️ Viewing as Guest</p>
      </div>

      {/* Museum Info */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg max-w-md">
        <h2 className="font-bold mb-1">{museumData.name}</h2>
        <p className="text-sm opacity-90">
          Current theme: <span className="font-semibold">{themeMode}</span>
        </p>
        <p className="text-xs opacity-75 mt-2">
          {isMobile 
            ? "Use the joystick to move and drag the screen to look around."
            : "Click to lock pointer, then use WASD to move and mouse to look around. Press ESC to unlock."
          }
        </p>
        <p className="text-xs opacity-75 mt-1">
          Click on frames to view details. Navigation is {isNavigationPaused ? "paused" : "active"}.
        </p>
      </div>
    </div>
  );
}
