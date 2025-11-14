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

      {/* Glass Pyramid Roof (Louvre style) */}
      <GlassPyramidRoof width={width} depth={depth} height={height} />

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

// Glass Pyramid Roof component (Louvre style)
function GlassPyramidRoof({ width, depth, height }: { width: number; depth: number; height: number }) {
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
      -halfWidth, baseY, 0,
      halfWidth, baseY, 0,
      0, apexY, -halfDepth,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, apexY, halfDepth]);

  const rightGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      halfWidth, baseY, 0,
      halfWidth, baseY, -depth,
      0, apexY, -halfDepth,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const backGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      halfWidth, baseY, -depth,
      -halfWidth, baseY, -depth,
      0, apexY, -halfDepth,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const leftGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -halfWidth, baseY, -depth,
      -halfWidth, baseY, 0,
      0, apexY, -halfDepth,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfWidth, baseY, depth, apexY, halfDepth]);

  const edgesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Base edges
      -halfWidth, baseY, 0,
      halfWidth, baseY, 0,
      halfWidth, baseY, 0,
      halfWidth, baseY, -depth,
      halfWidth, baseY, -depth,
      -halfWidth, baseY, -depth,
      -halfWidth, baseY, -depth,
      -halfWidth, baseY, 0,
      // Edges to apex
      -halfWidth, baseY, 0,
      0, apexY, -halfDepth,
      halfWidth, baseY, 0,
      0, apexY, -halfDepth,
      halfWidth, baseY, -depth,
      0, apexY, -halfDepth,
      -halfWidth, baseY, -depth,
      0, apexY, -halfDepth,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
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

  // Main Hall: Distribute 9 frames across 3 walls (back, left, right)
  const MAIN_HALL_BACK_WALL_Z = -15;
  const MAIN_HALL_WIDTH = 20;
  const MAIN_HALL_DEPTH = 15;
  const FRAME_HEIGHT = 3.5;

  // Back wall: 3 frames (positions 0, 1, 2)
  for (let i = 0; i < 3; i++) {
    const frame = frames.find((f) => f.position === i);
    if (!frame) continue;

    const x = (i - 1) * 6; // Spacing of 6 units
    const y = FRAME_HEIGHT;
    const z = MAIN_HALL_BACK_WALL_Z + 0.3;

    positions.push({
      id: frame.id,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, 0, 0),
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
    const z = -(wallIndex * 5 + 2.5); // Distribute along the wall

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
    const z = -(wallIndex * 5 + 2.5); // Distribute along the wall

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
