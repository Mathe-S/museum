"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FrameEntity } from "./FrameEntity";

interface Frame {
  id: string;
  position: number;
  side: string | null;
  imageUrl: string | null;
}

interface MuseumLayoutProps {
  frames: Frame[];
  onCollisionBoundariesReady?: (boundaries: THREE.Box3[]) => void;
  onFrameClick?: (frameId: string) => void;
}

export function MuseumLayout({ frames, onCollisionBoundariesReady, onFrameClick }: MuseumLayoutProps) {
  const { mainHallGeometry, extendableHallGeometry, collisionBoundaries } =
    useMemo(() => {
      const geometry = generateMuseumGeometry(frames);
      // Notify parent component of collision boundaries
      if (onCollisionBoundariesReady) {
        onCollisionBoundariesReady(geometry.collisionBoundaries);
      }
      return geometry;
    }, [frames, onCollisionBoundariesReady]);

  return (
    <>
      {/* Main Hall */}
      <MainHall geometry={mainHallGeometry} />

      {/* Extendable Hall */}
      <ExtendableHall geometry={extendableHallGeometry} />

      {/* Frame Positions */}
      <FramePositions frames={frames} onFrameClick={onFrameClick} />

      {/* Portal at end of Extendable Hall */}
      <Portal position={extendableHallGeometry.portalPosition} />

      {/* Collision Boundaries (invisible) */}
      <CollisionBoundaries boundaries={collisionBoundaries} />
    </>
  );
}

// Generate museum geometry based on frame count
function generateMuseumGeometry(frames: Frame[]) {
  // Main Hall dimensions
  const MAIN_HALL_WIDTH = 20;
  const MAIN_HALL_DEPTH = 15;
  const MAIN_HALL_HEIGHT = 8;
  const WALL_THICKNESS = 0.5;

  // Extendable Hall dimensions
  const HALL_WIDTH = 10;
  const HALL_HEIGHT = 8;
  const HALL_SEGMENT_LENGTH = 8;

  // Calculate number of extendable hall frames (position 9+)
  const extendableFrames = frames.filter((f) => f.position >= 9);
  const extendableSegments = Math.ceil(extendableFrames.length / 2) + 1; // +1 for initial segment

  const mainHallGeometry = {
    width: MAIN_HALL_WIDTH,
    depth: MAIN_HALL_DEPTH,
    height: MAIN_HALL_HEIGHT,
    wallThickness: WALL_THICKNESS,
  };

  const extendableHallGeometry = {
    width: HALL_WIDTH,
    height: HALL_HEIGHT,
    segmentLength: HALL_SEGMENT_LENGTH,
    segments: extendableSegments,
    totalLength: HALL_SEGMENT_LENGTH * extendableSegments,
    portalPosition: new THREE.Vector3(
      0,
      HALL_HEIGHT / 2,
      -MAIN_HALL_DEPTH - HALL_SEGMENT_LENGTH * extendableSegments
    ),
  };

  // Generate collision boundaries
  const collisionBoundaries = generateCollisionBoundaries(
    mainHallGeometry,
    extendableHallGeometry
  );

  return { mainHallGeometry, extendableHallGeometry, collisionBoundaries };
}

// Generate collision boundaries for walls
function generateCollisionBoundaries(
  mainHall: any,
  extendableHall: any
): THREE.Box3[] {
  const boundaries: THREE.Box3[] = [];
  const { width, depth, height, wallThickness } = mainHall;

  // Main Hall walls
  // Back wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-width / 2, 0, -depth - wallThickness),
      new THREE.Vector3(width / 2, height, -depth)
    )
  );

  // Left wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-width / 2 - wallThickness, 0, 0),
      new THREE.Vector3(-width / 2, height, -depth)
    )
  );

  // Right wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(width / 2, 0, 0),
      new THREE.Vector3(width / 2 + wallThickness, height, -depth)
    )
  );

  // Extendable Hall walls
  const hallHalfWidth = extendableHall.width / 2;
  const hallStart = -depth;
  const hallEnd = -depth - extendableHall.totalLength;

  // Left wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-hallHalfWidth - wallThickness, 0, hallEnd),
      new THREE.Vector3(-hallHalfWidth, extendableHall.height, hallStart)
    )
  );

  // Right wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(hallHalfWidth, 0, hallEnd),
      new THREE.Vector3(hallHalfWidth + wallThickness, extendableHall.height, hallStart)
    )
  );

  // End wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-hallHalfWidth, 0, hallEnd - wallThickness),
      new THREE.Vector3(hallHalfWidth, extendableHall.height, hallEnd)
    )
  );

  return boundaries;
}

// Main Hall component
function MainHall({ geometry }: { geometry: any }) {
  const { width, depth, height, wallThickness } = geometry;

  return (
    <group>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>

      {/* Ceiling */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, height, -depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, height / 2, -depth]} receiveShadow castShadow>
        <boxGeometry args={[width, height, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-width / 2, height / 2, -depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Right wall */}
      <mesh position={[width / 2, height / 2, -depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
    </group>
  );
}

// Extendable Hall component
function ExtendableHall({ geometry }: { geometry: any }) {
  const { width, height, segmentLength, segments } = geometry;
  const wallThickness = 0.5;

  return (
    <group>
      {Array.from({ length: segments }).map((_, i) => {
        const zPosition = -15 - segmentLength / 2 - i * segmentLength;

        return (
          <group key={i}>
            {/* Floor segment */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, zPosition]}
              receiveShadow
            >
              <planeGeometry args={[width, segmentLength]} />
              <meshStandardMaterial color="#cccccc" />
            </mesh>

            {/* Ceiling segment */}
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, height, zPosition]}
              receiveShadow
            >
              <planeGeometry args={[width, segmentLength]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Left wall segment */}
            <mesh
              position={[-width / 2, height / 2, zPosition]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[wallThickness, height, segmentLength]} />
              <meshStandardMaterial color="#e8e8e8" />
            </mesh>

            {/* Right wall segment */}
            <mesh
              position={[width / 2, height / 2, zPosition]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[wallThickness, height, segmentLength]} />
              <meshStandardMaterial color="#e8e8e8" />
            </mesh>
          </group>
        );
      })}

      {/* End wall */}
      <mesh
        position={[0, height / 2, -15 - segmentLength * segments]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width, height, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
    </group>
  );
}

// Frame Positions component
function FramePositions({ frames, onFrameClick }: { frames: Frame[]; onFrameClick?: (frameId: string) => void }) {
  const framePositions = useMemo(() => {
    return calculateFramePositions(frames);
  }, [frames]);

  return (
    <>
      {framePositions.map((framePos) => (
        <FrameEntity
          key={framePos.id}
          id={framePos.id}
          position={framePos.position}
          rotation={framePos.rotation}
          imageUrl={framePos.imageUrl}
          onFrameClick={onFrameClick}
        />
      ))}
    </>
  );
}

// Calculate 3D positions for all frames
export function calculateFramePositions(frames: Frame[]) {
  const positions: Array<{
    id: string;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    imageUrl: string | null;
  }> = [];

  // Main Hall: 3x3 grid on back wall (positions 0-8)
  const MAIN_HALL_BACK_WALL_Z = -15;
  const FRAME_SPACING = 4;
  const FRAME_HEIGHT_OFFSET = 2;

  for (let i = 0; i < 9; i++) {
    const frame = frames.find((f) => f.position === i);
    if (!frame) continue;

    const row = Math.floor(i / 3);
    const col = i % 3;

    const x = (col - 1) * FRAME_SPACING;
    const y = FRAME_HEIGHT_OFFSET + (2 - row) * FRAME_SPACING;
    const z = MAIN_HALL_BACK_WALL_Z + 0.3; // Slightly in front of wall

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, 0, 0),
      imageUrl: frame.imageUrl,
    });
  }

  // Extendable Hall: alternating left-right (positions 9+)
  const HALL_SEGMENT_LENGTH = 8;
  const HALL_WIDTH = 10;
  const extendableFrames = frames.filter((f) => f.position >= 9).sort((a, b) => a.position - b.position);

  extendableFrames.forEach((frame, index) => {
    const segmentIndex = Math.floor(index / 2);
    const isLeft = frame.side === "left";

    const x = isLeft ? -HALL_WIDTH / 2 + 0.3 : HALL_WIDTH / 2 - 0.3;
    const y = 4;
    const z = -15 - HALL_SEGMENT_LENGTH * (segmentIndex + 0.5);

    const rotationY = isLeft ? Math.PI / 2 : -Math.PI / 2;

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, rotationY, 0),
      imageUrl: frame.imageUrl,
    });
  });

  return positions;
}



// Portal component
function Portal({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[1.5, 1.5, 3, 32]} />
      <meshStandardMaterial
        color="#4a90e2"
        emissive="#2a5a9a"
        emissiveIntensity={0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

// Collision boundaries (invisible helper)
function CollisionBoundaries({ boundaries }: { boundaries: THREE.Box3[] }) {
  // These are invisible but can be used for collision detection
  // For now, we'll render them as wireframes for debugging (can be removed later)
  return null;
}
