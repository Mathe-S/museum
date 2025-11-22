"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useMuseumStore } from "@/lib/store/museum-store";

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
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const yawRef = useRef(0); // Track Y-axis rotation separately

  const moveSpeed = useMuseumStore((state) => state.moveSpeed);
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

    // Attempt to lock pointer immediately if enabled (may be blocked by browser without user gesture)
    const timeout = setTimeout(() => {
      // Only try if not already locked and if we have focus
      if (document.hasFocus() && !controls.isLocked) {
        try {
          controls.lock();
        } catch {
          console.log(
            "Auto-lock prevented by browser policy, waiting for click"
          );
        }
      }
    }, 1000);

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
      clearTimeout(timeout);
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
    const ROTATION_SPEED = 2.0; // radians per second

    // Handle camera rotation with A/D - only rotate around Y axis
    // We need to add to the existing rotation from mouse movement
    if (keysPressed.current["KeyA"]) {
      yawRef.current += ROTATION_SPEED * delta;

      // Apply additional yaw rotation to the camera
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(camera.quaternion);
      euler.y += ROTATION_SPEED * delta;
      camera.quaternion.setFromEuler(euler);
    }
    if (keysPressed.current["KeyD"]) {
      yawRef.current -= ROTATION_SPEED * delta;

      // Apply additional yaw rotation to the camera
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= ROTATION_SPEED * delta;
      camera.quaternion.setFromEuler(euler);
    }

    // Reset velocity
    velocity.x = 0;
    velocity.z = 0;

    // Handle forward/backward movement with W/S
    let moveDirection = 0;
    if (keysPressed.current["KeyW"]) {
      moveDirection = 1; // Forward
    }
    if (keysPressed.current["KeyS"]) {
      moveDirection = -1; // Backward
    }

    // Get current position
    const currentPosition = camera.position.clone();

    // Calculate new position based on camera orientation
    const moveVector = new THREE.Vector3();

    if (moveDirection !== 0) {
      // Forward/backward movement
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; // Keep movement horizontal
      forward.normalize();
      moveVector.add(forward.multiplyScalar(moveDirection * moveSpeed * delta));
    }

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
