"use client";

import { MuseumSceneManager } from "@/components/museum/MuseumSceneManager";
import { MuseumLayout } from "@/components/museum/MuseumLayout";
import { FrameInteractionModal } from "@/components/museum/FrameInteractionModal";
import { useMuseumStore } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { use, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import Link from "next/link";

interface FrameSharePageProps {
  params: Promise<{
    shareToken: string;
  }>;
}

export default function FrameSharePage({ params }: FrameSharePageProps) {
  const { shareToken } = use(params);

  const themeMode = useMuseumStore((state) => state.themeMode);
  const toggleTheme = useMuseumStore((state) => state.toggleTheme);
  const selectedFrame = useMuseumStore((state) => state.selectedFrame);
  const setSelectedFrame = useMuseumStore((state) => state.setSelectedFrame);
  const setFrames = useMuseumStore((state) => state.setFrames);
  const setCurrentMuseum = useMuseumStore((state) => state.setCurrentMuseum);

  const [collisionBoundaries, setCollisionBoundaries] = useState<THREE.Box3[]>(
    []
  );
  const [isMobile, setIsMobile] = useState(false);
  const [isNavigationPaused, setIsNavigationPaused] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<
    [number, number, number]
  >([0, 1.6, -15]);
  const [cameraLookAt, setCameraLookAt] = useState<[number, number, number]>([
    0, 2, -20,
  ]);

  // Fetch frame and museum data using frame share token
  const {
    data: frameData,
    isLoading,
    error,
  } = trpc.public.getFrameByShareToken.useQuery({
    shareToken,
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update store and camera position when frame data is loaded
  useEffect(() => {
    if (frameData) {
      const museum = {
        id: frameData.museum.id,
        userId: "", // Not available for public access
        name: frameData.museum.name,
        isPublic: true,
        shareToken: null,
        themeMode: frameData.museum.themeMode as "day" | "night",
        createdAt: frameData.museum.createdAt,
        updatedAt: frameData.museum.createdAt,
      };

      const framesData = frameData.museum.frames.map((frame) => ({
        ...frame,
        themeColors: frame.themeColors as string[] | null,
      }));

      setCurrentMuseum(museum);
      setFrames(framesData);

      // Set camera position in front of the shared frame
      const spawnPos = frameData.spawnPosition;
      setCameraPosition([spawnPos.x, spawnPos.y, spawnPos.z]);
      setCameraLookAt([
        spawnPos.lookAt.x,
        spawnPos.lookAt.y,
        spawnPos.lookAt.z,
      ]);

      // Don't auto-open modal - let user click the frame if they want to see details
    }
  }, [frameData, setCurrentMuseum, setFrames]);

  const handleCollisionBoundariesReady = useCallback(
    (boundaries: THREE.Box3[]) => {
      setCollisionBoundaries(boundaries);
    },
    []
  );

  const handleFrameClick = useCallback(
    (frameId: string) => {
      if (!frameData) return;
      const frame = frameData.museum.frames.find((f) => f.id === frameId);
      if (frame) {
        setSelectedFrame({
          ...frame,
          themeColors: frame.themeColors as string[] | null,
        });
      }
    },
    [frameData, setSelectedFrame]
  );

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
        <div className="text-white text-xl">Loading frame...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-white text-2xl font-bold mb-4">
            Frame Not Found
          </h1>
          <p className="text-gray-400 mb-6">
            {error.message ||
              "This frame is private, empty, or the link is invalid."}
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-block"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!frameData) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen">
      {/* 3D Scene */}
      <MuseumSceneManager
        collisionBoundaries={collisionBoundaries}
        navigationEnabled={!isNavigationPaused}
        cameraPosition={cameraPosition}
        cameraLookAt={cameraLookAt}
      >
        <MuseumLayout
          frames={frameData.museum.frames}
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

      {/* Guest Banner with Frame Info */}
      <div className="absolute top-4 left-4 z-10 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg max-w-md">
        <p className="font-medium">🖼️ Viewing Shared Frame</p>
        <p className="text-sm opacity-90 mt-1">
          {frameData.frame.description || "A beautiful artwork"}
        </p>
      </div>

      {/* Museum Info */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg max-w-md">
        <h2 className="font-bold mb-1">{frameData.museum.name}</h2>
        <p className="text-sm opacity-90">
          Current theme: <span className="font-semibold">{themeMode}</span>
        </p>
        <p className="text-xs opacity-75 mt-2">
          {isMobile
            ? "Use the joystick to move and drag the screen to look around."
            : "Click to lock pointer, then use WASD to move and mouse to look around. Press ESC to unlock."}
        </p>
        <p className="text-xs opacity-75 mt-1">
          Click on frames to view details. You can explore the entire museum
          freely.
        </p>
      </div>
    </div>
  );
}
