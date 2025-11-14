"use client";

import { MuseumSceneManager } from "@/components/museum/MuseumSceneManager";
import { MuseumLayout } from "@/components/museum/MuseumLayout";
import { FrameInteractionModal } from "@/components/museum/FrameInteractionModal";
import { ProfileOverlay } from "@/components/museum/ProfileOverlay";
import { MuseumSelectorUI } from "@/components/museum/MuseumSelectorUI";
import { TutorialModal } from "@/components/museum/TutorialModal";
import { useMuseumStore } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { useMemo, useState, useCallback, useEffect } from "react";
import * as THREE from "three";

export default function MuseumPage() {
  const themeMode = useMuseumStore((state) => state.themeMode);
  const toggleTheme = useMuseumStore((state) => state.toggleTheme);
  const selectedFrame = useMuseumStore((state) => state.selectedFrame);
  const setSelectedFrame = useMuseumStore((state) => state.setSelectedFrame);
  const frames = useMuseumStore((state) => state.frames);
  const setFrames = useMuseumStore((state) => state.setFrames);
  const setShowProfileOverlay = useMuseumStore(
    (state) => state.setShowProfileOverlay
  );
  const showProfileOverlay = useMuseumStore(
    (state) => state.showProfileOverlay
  );
  const setCurrentMuseum = useMuseumStore((state) => state.setCurrentMuseum);
  const showTutorial = useMuseumStore((state) => state.showTutorial);
  const setShowTutorial = useMuseumStore((state) => state.setShowTutorial);

  const [collisionBoundaries, setCollisionBoundaries] = useState<THREE.Box3[]>(
    []
  );
  const [isMobile, setIsMobile] = useState(false);
  const [isNavigationPaused, setIsNavigationPaused] = useState(false);
  const [currentMuseumId, setCurrentMuseumId] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState<
    [number, number, number]
  >([0, 1.6, -15]); // Center of main hall
  const [showMuseumSelector, setShowMuseumSelector] = useState(false);

  // Fetch user profile to check tutorial dismissal status
  const { data: userProfile } = trpc.user.getProfile.useQuery();

  // Test data: Create frames for demonstration
  const testFrames = useMemo(() => {
    const framesList = [];

    // Main Hall: 9 frames (positions 0-8)
    for (let i = 0; i < 9; i++) {
      framesList.push({
        id: `frame-${i}`,
        museumId: "test-museum",
        position: i,
        side: null,
        imageUrl: i % 3 === 0 ? "test-image.jpg" : null, // Some filled, some empty
        description: i % 3 === 0 ? `Test frame ${i}` : null,
        themeColors: i % 3 === 0 ? ["#ff0000", "#00ff00", "#0000ff"] : null,
        shareToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Extendable Hall: 6 frames (positions 9-14) alternating left-right
    for (let i = 9; i < 15; i++) {
      framesList.push({
        id: `frame-${i}`,
        museumId: "test-museum",
        position: i,
        side: (i - 9) % 2 === 0 ? "left" : "right",
        imageUrl: i % 4 === 0 ? "test-image.jpg" : null,
        description: i % 4 === 0 ? `Test frame ${i}` : null,
        themeColors: i % 4 === 0 ? ["#ff0000", "#00ff00", "#0000ff"] : null,
        shareToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return framesList;
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check if tutorial should be shown
  useEffect(() => {
    // Check localStorage first for instant feedback
    const localDismissed = localStorage.getItem("tutorialDismissed") === "true";

    // If user profile is loaded, use database value as source of truth
    if (userProfile) {
      const dbDismissed = userProfile.tutorialDismissed;

      // Show tutorial only if not dismissed in both localStorage and database
      if (!localDismissed && !dbDismissed) {
        setShowTutorial(true);
      } else {
        setShowTutorial(false);
        // Sync localStorage with database
        if (dbDismissed) {
          localStorage.setItem("tutorialDismissed", "true");
        }
      }
    } else if (!localDismissed) {
      // If profile not loaded yet, check localStorage only
      setShowTutorial(true);
    }
  }, [userProfile, setShowTutorial]);

  // Initialize frames in store
  useEffect(() => {
    setFrames(testFrames);
  }, [testFrames, setFrames]);

  const handleCollisionBoundariesReady = useCallback(
    (boundaries: THREE.Box3[]) => {
      setCollisionBoundaries(boundaries);
    },
    []
  );

  const handleFrameClick = useCallback(
    (frameId: string) => {
      const frame = frames.find((f) => f.id === frameId);
      if (frame) {
        setSelectedFrame(frame);
      }
    },
    [frames, setSelectedFrame]
  );

  const handleModalClose = useCallback(() => {
    setSelectedFrame(null);
  }, [setSelectedFrame]);

  const handleTutorialClose = useCallback(() => {
    setShowTutorial(false);
  }, [setShowTutorial]);

  // Pause navigation when profile overlay, modal, or tutorial is open
  useEffect(() => {
    setIsNavigationPaused(
      showProfileOverlay ||
        selectedFrame !== null ||
        showMuseumSelector ||
        showTutorial
    );
  }, [showProfileOverlay, selectedFrame, showMuseumSelector, showTutorial]);

  // Listen for portal zone entered event
  useEffect(() => {
    const handlePortalZoneEntered = () => {
      setShowMuseumSelector(true);
    };

    window.addEventListener("portalZoneEntered", handlePortalZoneEntered);
    return () => {
      window.removeEventListener("portalZoneEntered", handlePortalZoneEntered);
    };
  }, []);

  // Handle museum switching
  const handleMuseumSwitch = useCallback(async (museumId: string) => {
    setCurrentMuseumId(museumId);
    setShowMuseumSelector(false);
    // Reset camera to center of main hall
    setCameraPosition([0, 1.6, -15]);
  }, []);

  // Fetch museum data when switching
  const { data: museumData } = trpc.museum.getById.useQuery(
    { id: currentMuseumId! },
    { enabled: !!currentMuseumId }
  );

  // Update store when museum data is loaded
  useEffect(() => {
    if (museumData) {
      // Transform the data to match the store types
      const museum = {
        ...museumData,
        themeMode: museumData.themeMode as "day" | "night",
      };
      const framesData = museumData.frames.map((frame) => ({
        ...frame,
        themeColors: frame.themeColors as string[] | null,
      }));

      setCurrentMuseum(museum);
      setFrames(framesData);
    }
  }, [museumData, setCurrentMuseum, setFrames]);

  return (
    <div className="relative h-screen w-screen">
      {/* 3D Scene */}
      <MuseumSceneManager
        collisionBoundaries={collisionBoundaries}
        navigationEnabled={!isNavigationPaused}
        cameraPosition={cameraPosition}
      >
        <MuseumLayout
          frames={
            currentMuseumId && museumData ? museumData.frames : testFrames
          }
          onCollisionBoundariesReady={handleCollisionBoundariesReady}
          onFrameClick={handleFrameClick}
          onMuseumSwitch={handleMuseumSwitch}
          onNavigationPause={setIsNavigationPaused}
        />
      </MuseumSceneManager>

      {/* Center Crosshair - Always visible to show aim point */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/60 transform -translate-y-1/2"></div>
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/60 transform -translate-x-1/2"></div>
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
      </div>

      {/* Frame Interaction Modal */}
      <FrameInteractionModal
        frame={selectedFrame}
        onClose={handleModalClose}
        onNavigationPause={setIsNavigationPaused}
      />

      {/* UI Overlay - Top Right Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowProfileOverlay(true)}
          className="px-4 py-2 bg-white/90 hover:bg-white text-black rounded-lg shadow-lg font-medium transition-colors"
        >
          👤 Profile
        </button>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-white/90 hover:bg-white text-black rounded-lg shadow-lg font-medium transition-colors"
        >
          {themeMode === "day" ? "🌙 Night Mode" : "☀️ Day Mode"}
        </button>
      </div>

      {/* Profile Overlay */}
      <ProfileOverlay />

      {/* Museum Selector UI */}
      {showMuseumSelector && (
        <MuseumSelectorUI
          onClose={() => setShowMuseumSelector(false)}
          onSelect={handleMuseumSwitch}
        />
      )}

      {/* Tutorial Modal */}
      {showTutorial && <TutorialModal onClose={handleTutorialClose} />}

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg max-w-md">
        <h2 className="font-bold mb-1">Museum Layout Generator</h2>
        <p className="text-sm opacity-90">
          Current theme: <span className="font-semibold">{themeMode}</span>
        </p>
        <p className="text-xs opacity-75 mt-2">
          Main Hall: 9 frames in 3x3 grid | Extendable Hall: 6 frames
          alternating left-right | Portal at end
        </p>
        <p className="text-xs opacity-75 mt-1">
          {isMobile
            ? "Use the joystick to move and drag the screen to look around."
            : "Click to lock pointer, then use WASD to move and mouse to look around. Press ESC to unlock."}
        </p>
        <p className="text-xs opacity-75 mt-1">
          Click on frames to interact with them. Navigation is{" "}
          {isNavigationPaused ? "paused" : "active"}.
        </p>
      </div>
    </div>
  );
}
