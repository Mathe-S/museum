"use client";

import { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface MobileControlsProps {
  collisionBoundaries: THREE.Box3[];
  enabled?: boolean;
  joystickDirection: { x: number; y: number };
}

export function MobileControls({
  collisionBoundaries,
  enabled = true,
  joystickDirection,
}: MobileControlsProps) {
  const { camera, gl } = useThree();
  const velocityRef = useRef(new THREE.Vector3());
  const touchRotationRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 });
  const isTouchingScreenRef = useRef(false);

  // Movement speed: 3 units/second for mobile
  const MOVE_SPEED = 3.0;
  const PLAYER_HEIGHT = 1.6;
  const COLLISION_RADIUS = 0.5;
  const ROTATION_SENSITIVITY = 0.002;
  const MAX_PITCH = Math.PI / 3; // 60 degrees up/down

  useEffect(() => {
    if (!enabled) return;

    // Set camera to player height
    camera.position.y = PLAYER_HEIGHT;

    // Initialize camera rotation from current camera orientation
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    cameraRotationRef.current.yaw = euler.y;
    cameraRotationRef.current.pitch = euler.x;

    // Disable pinch-to-zoom
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventZoom, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    // Add viewport meta tag to prevent zoom
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      );
    }

    return () => {
      document.removeEventListener("touchmove", preventZoom);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, [camera, enabled]);

  // Update movement and rotation every frame
  useFrame((_state, delta) => {
    if (!enabled) return;

    // Update camera rotation
    const rotation = cameraRotationRef.current;
    const euler = new THREE.Euler(rotation.pitch, rotation.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    // Calculate movement based on joystick input
    const velocity = velocityRef.current;

    // Reset velocity
    velocity.x = 0;
    velocity.z = 0;

    // Apply joystick direction
    if (joystickDirection.x !== 0 || joystickDirection.y !== 0) {
      velocity.x = joystickDirection.x * MOVE_SPEED * delta;
      velocity.z = joystickDirection.y * MOVE_SPEED * delta;
    }

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

  // Handle touch rotation (camera look)
  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch is on joystick area (handled by VirtualJoystick component)
      const touch = e.touches[0];
      const joystickArea = document.getElementById("virtual-joystick");
      
      if (joystickArea) {
        const rect = joystickArea.getBoundingClientRect();
        const isOnJoystick =
          touch.clientX >= rect.left &&
          touch.clientX <= rect.right &&
          touch.clientY >= rect.top &&
          touch.clientY <= rect.bottom;

        if (isOnJoystick) {
          return; // Let joystick handle this touch
        }
      }

      // This touch is for camera rotation
      isTouchingScreenRef.current = true;
      touchRotationRef.current.startX = touch.clientX;
      touchRotationRef.current.startY = touch.clientY;
      touchRotationRef.current.currentX = touch.clientX;
      touchRotationRef.current.currentY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingScreenRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchRotationRef.current.currentX;
      const deltaY = touch.clientY - touchRotationRef.current.currentY;

      touchRotationRef.current.currentX = touch.clientX;
      touchRotationRef.current.currentY = touch.clientY;

      // Update camera rotation
      cameraRotationRef.current.yaw -= deltaX * ROTATION_SENSITIVITY;
      cameraRotationRef.current.pitch -= deltaY * ROTATION_SENSITIVITY;

      // Clamp pitch to prevent camera flipping
      cameraRotationRef.current.pitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, cameraRotationRef.current.pitch)
      );
    };

    const handleTouchEnd = () => {
      isTouchingScreenRef.current = false;
    };

    gl.domElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    gl.domElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    gl.domElement.addEventListener("touchend", handleTouchEnd);
    gl.domElement.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      gl.domElement.removeEventListener("touchstart", handleTouchStart);
      gl.domElement.removeEventListener("touchmove", handleTouchMove);
      gl.domElement.removeEventListener("touchend", handleTouchEnd);
      gl.domElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [camera, gl, enabled]);

  return null;
}

/**
 * Virtual Joystick UI Component
 */
interface VirtualJoystickProps {
  onDirectionChange: (x: number, y: number) => void;
}

export function VirtualJoystick({ onDirectionChange }: VirtualJoystickProps) {
  const [isActive, setIsActive] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  const JOYSTICK_SIZE = 120;
  const KNOB_SIZE = 50;
  const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!baseRef.current) return;

      const touch = Array.from(e.touches).find((t) => {
        const rect = baseRef.current!.getBoundingClientRect();
        return (
          t.clientX >= rect.left &&
          t.clientX <= rect.right &&
          t.clientY >= rect.top &&
          t.clientY <= rect.bottom
        );
      });

      if (touch) {
        touchIdRef.current = touch.identifier;
        setIsActive(true);
        updateJoystick(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      const touch = Array.from(e.touches).find(
        (t) => t.identifier === touchIdRef.current
      );

      if (touch) {
        updateJoystick(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === touchIdRef.current
      );

      if (touch) {
        touchIdRef.current = null;
        setIsActive(false);
        setKnobPosition({ x: 0, y: 0 });
        onDirectionChange(0, 0);
      }
    };

    const updateJoystick = (clientX: number, clientY: number) => {
      if (!baseRef.current) return;

      const rect = baseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let deltaX = clientX - centerX;
      let deltaY = clientY - centerY;

      // Limit to max distance
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > MAX_DISTANCE) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * MAX_DISTANCE;
        deltaY = Math.sin(angle) * MAX_DISTANCE;
      }

      setKnobPosition({ x: deltaX, y: deltaY });

      // Normalize direction for movement (-1 to 1)
      const normalizedX = deltaX / MAX_DISTANCE;
      const normalizedY = deltaY / MAX_DISTANCE;

      onDirectionChange(normalizedX, normalizedY);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [onDirectionChange]);

  return (
    <div
      id="virtual-joystick"
      ref={baseRef}
      className="fixed bottom-8 left-8 z-50 touch-none"
      style={{
        width: JOYSTICK_SIZE,
        height: JOYSTICK_SIZE,
      }}
    >
      {/* Base circle */}
      <div
        className={`absolute inset-0 rounded-full border-4 transition-colors ${
          isActive
            ? "bg-white/20 border-white/60"
            : "bg-white/10 border-white/30"
        }`}
      />

      {/* Knob */}
      <div
        className={`absolute rounded-full transition-colors ${
          isActive ? "bg-white/80" : "bg-white/50"
        }`}
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPosition.x}px)`,
          top: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPosition.y}px)`,
          transition: isActive ? "none" : "all 0.2s ease-out",
        }}
      />
    </div>
  );
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
