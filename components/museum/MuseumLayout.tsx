"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FrameEntity } from "./FrameEntity";
import { PortalSystem } from "./PortalSystem";
import { RobberCharacter3D } from "./RobberCharacter3D";
import { VisitorAvatarManager } from "./VisitorAvatar";
import { useMuseumStore } from "@/lib/store/museum-store";

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
  onMuseumSwitch?: (museumId: string) => void;
  onNavigationPause?: (paused: boolean) => void;
  isPublicView?: boolean;
}

export function MuseumLayout({
  frames,
  onCollisionBoundariesReady,
  onFrameClick,
  onMuseumSwitch,
  onNavigationPause,
  isPublicView = false,
}: MuseumLayoutProps) {
  const robberTarget = useMuseumStore((state) => state.robberTarget);
  const clearRobber = useMuseumStore((state) => state.clearRobber);
  const visitors = useMuseumStore((state) => state.visitors);

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

      {/* Robber Character - appears when deleting */}
      {robberTarget && (
        <RobberCharacter3D
          position={[
            robberTarget.position.x,
            robberTarget.position.y,
            robberTarget.position.z,
          ]}
          onComplete={clearRobber}
        />
      )}

      {/* Visitor Avatars - real-time multiplayer presence */}
      <VisitorAvatarManager visitors={visitors} maxVisitors={50} />

      {/* Portal System at end of Extendable Hall - disabled for public view */}
      {!isPublicView && (
        <PortalSystem
          position={extendableHallGeometry.portalPosition}
          onMuseumSwitch={onMuseumSwitch}
          onNavigationPause={onNavigationPause}
        />
      )}

      {/* Collision Boundaries (invisible) */}
      <CollisionBoundaries boundaries={collisionBoundaries} />
    </>
  );
}

// Generate museum geometry based on frame count
function generateMuseumGeometry(frames: Frame[]) {
  // Main Hall dimensions - MASSIVE hall
  const MAIN_HALL_WIDTH = 40;
  const MAIN_HALL_DEPTH = 30;
  const MAIN_HALL_HEIGHT = 12;
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
  // Front entrance wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-width / 2, 0, 0),
      new THREE.Vector3(width / 2, height, wallThickness)
    )
  );

  // Back wall - split into two segments with opening in center
  // Left segment of back wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-width / 2, 0, -depth - wallThickness),
      new THREE.Vector3(-5, height, -depth)
    )
  );

  // Right segment of back wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(5, 0, -depth - wallThickness),
      new THREE.Vector3(width / 2, height, -depth)
    )
  );

  // Left wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-width / 2 - wallThickness, 0, -depth),
      new THREE.Vector3(-width / 2, height, 0)
    )
  );

  // Right wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(width / 2, 0, -depth),
      new THREE.Vector3(width / 2 + wallThickness, height, 0)
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
      new THREE.Vector3(
        hallHalfWidth + wallThickness,
        extendableHall.height,
        hallStart
      )
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

      {/* Glass Pyramid Roof (Louvre style) */}
      <GlassPyramidRoof width={width} depth={depth} height={height} />

      {/* Front entrance wall */}
      <mesh position={[0, height / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[width, height, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Back wall with opening for corridor */}
      {/* Left segment of back wall */}
      <mesh
        position={[-width / 4 - 2.5, height / 2, -depth]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width / 2 - 5, height, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Right segment of back wall */}
      <mesh
        position={[width / 4 + 2.5, height / 2, -depth]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width / 2 - 5, height, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-width / 2, height / 2, -depth / 2]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Right wall */}
      <mesh
        position={[width / 2, height / 2, -depth / 2]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      {/* Plant Decorations - Optimized */}
      <PlantDecorations width={width} depth={depth} />
    </group>
  );
}

// Optimized Plant Decorations Component
function PlantDecorations({ width, depth }: { width: number; depth: number }) {
  // Shared geometries for performance (instancing)
  const potGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.8, 0.6, 1, 8),
    []
  );
  const leafGeometry = useMemo(() => new THREE.SphereGeometry(1.2, 8, 8), []);

  // Plant positions - strategically placed to not block movement or frame views
  const plantPositions = useMemo(
    () => [
      // Front corners - further from walls
      { x: -width / 2 + 5, z: -3 },
      { x: width / 2 - 5, z: -3 },
      // Back corners (near corridor entrance) - further from walls
      { x: -width / 2 + 5, z: -depth + 5 },
      { x: width / 2 - 5, z: -depth + 5 },
    ],
    [width, depth]
  );

  return (
    <group>
      {plantPositions.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
          {/* Pot */}
          <mesh geometry={potGeometry} position={[0, 0.5, 0]} castShadow>
            <meshStandardMaterial color="#8B4513" roughness={0.8} />
          </mesh>
          {/* Plant leaves */}
          <mesh geometry={leafGeometry} position={[0, 2, 0]} castShadow>
            <meshStandardMaterial color="#2d5016" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Glass Pyramid Roof component (Louvre style)
function GlassPyramidRoof({
  width,
  depth,
  height,
}: {
  width: number;
  depth: number;
  height: number;
}) {
  const pyramidHeight = 6;
  const baseY = height;
  const apexY = baseY + pyramidHeight;

  // Calculate pyramid vertices
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  // Create geometries using useMemo to avoid recreating on every render
  const frontGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -halfWidth,
      baseY,
      0,
      halfWidth,
      baseY,
      0,
      0,
      apexY,
      -halfDepth,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, apexY, halfDepth]);

  const rightGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      halfWidth,
      baseY,
      0,
      halfWidth,
      baseY,
      -depth,
      0,
      apexY,
      -halfDepth,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const backGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      halfWidth,
      baseY,
      -depth,
      -halfWidth,
      baseY,
      -depth,
      0,
      apexY,
      -halfDepth,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const leftGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -halfWidth,
      baseY,
      -depth,
      -halfWidth,
      baseY,
      0,
      0,
      apexY,
      -halfDepth,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const edgesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Base edges
      -halfWidth,
      baseY,
      0,
      halfWidth,
      baseY,
      0,
      halfWidth,
      baseY,
      0,
      halfWidth,
      baseY,
      -depth,
      halfWidth,
      baseY,
      -depth,
      -halfWidth,
      baseY,
      -depth,
      -halfWidth,
      baseY,
      -depth,
      -halfWidth,
      baseY,
      0,
      // Edges to apex
      -halfWidth,
      baseY,
      0,
      0,
      apexY,
      -halfDepth,
      halfWidth,
      baseY,
      0,
      0,
      apexY,
      -halfDepth,
      halfWidth,
      baseY,
      -depth,
      0,
      apexY,
      -halfDepth,
      -halfWidth,
      baseY,
      -depth,
      0,
      apexY,
      -halfDepth,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  return (
    <group>
      {/* Front face */}
      <mesh geometry={frontGeometry}>
        <meshPhysicalMaterial
          color="#87ceeb"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
          transmission={0.9}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right face */}
      <mesh geometry={rightGeometry}>
        <meshPhysicalMaterial
          color="#87ceeb"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
          transmission={0.9}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Back face */}
      <mesh geometry={backGeometry}>
        <meshPhysicalMaterial
          color="#87ceeb"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
          transmission={0.9}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left face */}
      <mesh geometry={leftGeometry}>
        <meshPhysicalMaterial
          color="#87ceeb"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
          transmission={0.9}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pyramid frame edges for structure */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#666666" />
      </lineSegments>
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
        const zPosition = -30 - segmentLength / 2 - i * segmentLength; // Start from back wall at -30

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
        position={[0, height / 2, -30 - segmentLength * segments]}
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
function FramePositions({
  frames,
  onFrameClick,
}: {
  frames: Frame[];
  onFrameClick?: (frameId: string) => void;
}) {
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

  // Main Hall: Distribute 9 frames across 3 walls (front entrance, left, right)
  const MAIN_HALL_WIDTH = 40;
  const MAIN_HALL_DEPTH = 30;
  const FRAME_HEIGHT = 5;

  // Front entrance wall: 3 frames (positions 0, 1, 2)
  for (let i = 0; i < 3; i++) {
    const frame = frames.find((f) => f.position === i);
    if (!frame) continue;

    const x = (i - 1) * 10; // Spacing of 10 units for larger hall
    const y = FRAME_HEIGHT;
    const z = -0.3; // Just in front of entrance wall

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, Math.PI, 0), // Rotate 180 degrees to face inward
      imageUrl: frame.imageUrl,
    });
  }

  // Left wall: 3 frames (positions 3, 4, 5)
  for (let i = 3; i < 6; i++) {
    const frame = frames.find((f) => f.position === i);
    if (!frame) continue;

    const wallIndex = i - 3;
    const x = -MAIN_HALL_WIDTH / 2 + 0.3;
    const y = FRAME_HEIGHT;
    const z = -(wallIndex * 10 + 5); // Distribute along the larger wall

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      imageUrl: frame.imageUrl,
    });
  }

  // Right wall: 3 frames (positions 6, 7, 8)
  for (let i = 6; i < 9; i++) {
    const frame = frames.find((f) => f.position === i);
    if (!frame) continue;

    const wallIndex = i - 6;
    const x = MAIN_HALL_WIDTH / 2 - 0.3;
    const y = FRAME_HEIGHT;
    const z = -(wallIndex * 10 + 5); // Distribute along the larger wall

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      imageUrl: frame.imageUrl,
    });
  }

  // Extendable Hall: alternating left-right (positions 9+)
  const HALL_SEGMENT_LENGTH = 8;
  const HALL_WIDTH = 10;
  const extendableFrames = frames
    .filter((f) => f.position >= 9)
    .sort((a, b) => a.position - b.position);

  extendableFrames.forEach((frame, index) => {
    const segmentIndex = Math.floor(index / 2);
    const isLeft = frame.side === "left";

    const x = isLeft ? -HALL_WIDTH / 2 + 0.3 : HALL_WIDTH / 2 - 0.3;
    const y = 4;
    const z = -MAIN_HALL_DEPTH - HALL_SEGMENT_LENGTH * (segmentIndex + 0.5);

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

// Collision boundaries (invisible helper)
function CollisionBoundaries({ boundaries }: { boundaries: THREE.Box3[] }) {
  // These are invisible but can be used for collision detection
  // For now, we'll render them as wireframes for debugging (can be removed later)
  return null;
}
