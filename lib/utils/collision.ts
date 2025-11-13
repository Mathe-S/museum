import * as THREE from "three";

/**
 * Collision detection utilities for museum navigation
 */

export interface CollisionBoundary {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Check if a position collides with any boundaries
 */
export function checkCollision(
  position: THREE.Vector3,
  boundaries: THREE.Box3[],
  radius: number = 0.5
): boolean {
  const sphere = new THREE.Sphere(position, radius);

  for (const boundary of boundaries) {
    if (boundary.intersectsSphere(sphere)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the nearest valid position if collision detected
 */
export function resolveCollision(
  currentPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  boundaries: THREE.Box3[],
  radius: number = 0.5
): THREE.Vector3 {
  if (!checkCollision(newPosition, boundaries, radius)) {
    return newPosition;
  }

  // Try moving only on X axis
  const xOnly = new THREE.Vector3(newPosition.x, currentPosition.y, currentPosition.z);
  if (!checkCollision(xOnly, boundaries, radius)) {
    return xOnly;
  }

  // Try moving only on Z axis
  const zOnly = new THREE.Vector3(currentPosition.x, currentPosition.y, newPosition.z);
  if (!checkCollision(zOnly, boundaries, radius)) {
    return zOnly;
  }

  // If both fail, stay at current position
  return currentPosition;
}

/**
 * Generate collision boundaries for museum layout
 */
export function generateMuseumCollisionBoundaries(
  mainHallWidth: number,
  mainHallDepth: number,
  mainHallHeight: number,
  extendableHallWidth: number,
  extendableHallLength: number,
  extendableHallHeight: number,
  wallThickness: number = 0.5
): THREE.Box3[] {
  const boundaries: THREE.Box3[] = [];

  // Main Hall walls
  // Back wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-mainHallWidth / 2, 0, -mainHallDepth - wallThickness),
      new THREE.Vector3(mainHallWidth / 2, mainHallHeight, -mainHallDepth)
    )
  );

  // Left wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-mainHallWidth / 2 - wallThickness, 0, 0),
      new THREE.Vector3(-mainHallWidth / 2, mainHallHeight, -mainHallDepth)
    )
  );

  // Right wall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(mainHallWidth / 2, 0, 0),
      new THREE.Vector3(mainHallWidth / 2 + wallThickness, mainHallHeight, -mainHallDepth)
    )
  );

  // Extendable Hall walls
  const hallHalfWidth = extendableHallWidth / 2;
  const hallStart = -mainHallDepth;
  const hallEnd = -mainHallDepth - extendableHallLength;

  // Left wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-hallHalfWidth - wallThickness, 0, hallEnd),
      new THREE.Vector3(-hallHalfWidth, extendableHallHeight, hallStart)
    )
  );

  // Right wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(hallHalfWidth, 0, hallEnd),
      new THREE.Vector3(hallHalfWidth + wallThickness, extendableHallHeight, hallStart)
    )
  );

  // End wall of extendable hall
  boundaries.push(
    new THREE.Box3(
      new THREE.Vector3(-hallHalfWidth, 0, hallEnd - wallThickness),
      new THREE.Vector3(hallHalfWidth, extendableHallHeight, hallEnd)
    )
  );

  return boundaries;
}
