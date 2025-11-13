"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import * as THREE from "three";

interface DesktopControlsProps {
  collisionBoundaries: THREE.Box3[];
  enabled?: boolean;
}

export function DesktopControls({
  collisionBoundaries,
  enabled = true,
}: DesktopControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Movement speed: 5 units/second
  const MOVE_SPEED = 5.0;
  const PLAYER_HEIGHT = 1.6;
  const COLLISION_RADIUS = 0.5;

  useEffect(() => {
    if (!enabled) return;

    // Initialize PointerLockControls
    const controls = new PointerLockControlsImpl(camera, gl.domElement);
    controlsRef.current = controls;

    // Set camera to player height
    camera.position.y = PLAYER_HEIGHT;

    // Lock pointer on canvas click
    const handleCanvasClick = () => {
      controls.lock();
    };

    gl.domElement.addEventListener("click", handleCanvasClick);

    // Keyboard event listeners
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.code] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.code] = false;
    };

    // Pointer lock change listeners
    const handleLockChange = () => {
      if (document.pointerLockElement === gl.domElement) {
        console.log("Pointer locked");
      } else {
        console.log("Pointer unlocked");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", handleLockChange);

    // Cleanup
    return () => {
      gl.domElement.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("pointerlockchange", handleLockChange);
      controls.unlock();
      controls.dispose();
    };
  }, [camera, gl, enabled]);

  // Update movement every frame
  useFrame((_state, delta) => {
    if (!controlsRef.current || !controlsRef.current.isLocked || !enabled) {
      return;
    }

    const velocity = velocityRef.current;
    const direction = directionRef.current;

    // Reset velocity
    velocity.x = 0;
    velocity.z = 0;

    // Get movement direction based on keys pressed
    direction.set(0, 0, 0);

    if (keysPressed.current["KeyW"]) {
      direction.z -= 1;
    }
    if (keysPressed.current["KeyS"]) {
      direction.z += 1;
    }
    if (keysPressed.current["KeyA"]) {
      direction.x -= 1;
    }
    if (keysPressed.current["KeyD"]) {
      direction.x += 1;
    }

    // Normalize direction to prevent faster diagonal movement
    if (direction.length() > 0) {
      direction.normalize();
    }

    // Calculate velocity based on direction and speed
    velocity.x = direction.x * MOVE_SPEED * delta;
    velocity.z = direction.z * MOVE_SPEED * delta;

    // Get current position
    const currentPosition = camera.position.clone();

    // Calculate new position based on camera orientation
    const moveVector = new THREE.Vector3();

    // Forward/backward movement
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    moveVector.add(forward.multiplyScalar(velocity.z));

    // Left/right movement
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize();
    moveVector.add(right.multiplyScalar(-velocity.x));

    // Calculate new position
    const newPosition = currentPosition.clone().add(moveVector);
    newPosition.y = PLAYER_HEIGHT; // Keep at constant height

    // Check collision and resolve
    const finalPosition = resolveCollision(
      currentPosition,
      newPosition,
      collisionBoundaries,
      COLLISION_RADIUS
    );

    // Apply movement
    camera.position.copy(finalPosition);
  });

  return null;
}

/**
 * Check if a position collides with any boundaries
 */
function checkCollision(
  position: THREE.Vector3,
  boundaries: THREE.Box3[],
  radius: number
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
 * Resolve collision by finding nearest valid position
 */
function resolveCollision(
  currentPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  boundaries: THREE.Box3[],
  radius: number
): THREE.Vector3 {
  // If no collision, use new position
  if (!checkCollision(newPosition, boundaries, radius)) {
    return newPosition;
  }

  // Try moving only on X axis
  const xOnly = new THREE.Vector3(
    newPosition.x,
    currentPosition.y,
    currentPosition.z
  );
  if (!checkCollision(xOnly, boundaries, radius)) {
    return xOnly;
  }

  // Try moving only on Z axis
  const zOnly = new THREE.Vector3(
    currentPosition.x,
    currentPosition.y,
    newPosition.z
  );
  if (!checkCollision(zOnly, boundaries, radius)) {
    return zOnly;
  }

  // If both fail, stay at current position
  return currentPosition;
}
