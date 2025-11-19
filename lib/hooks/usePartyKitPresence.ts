import { useEffect, useRef, useState, useCallback } from "react";
import PartySocket from "partysocket";
import { useMuseumStore } from "@/lib/store/museum-store";
import { useUser } from "@clerk/nextjs";

/**
 * Connection status for the PartyKit presence system
 */
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

/**
 * Visitor metadata sent to PartyKit server
 */
interface VisitorUpdate {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

/**
 * Message types received from PartyKit server
 */
type ServerMessage =
  | {
      type: "visitor_list";
      visitors: Array<{
        id: string;
        name: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        lastUpdate: number;
      }>;
    }
  | {
      type: "visitor_join";
      visitor: {
        id: string;
        name: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        lastUpdate: number;
      };
    }
  | { type: "visitor_leave"; visitorId: string }
  | {
      type: "visitor_position";
      visitorId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
    }
  | {
      type: "comment_new";
      frameId: string;
      comment: {
        text: string;
        authorName: string;
        authorPicture?: string;
        timestamp: number;
      };
    }
  | { type: "comment_deleted"; frameId: string; commentId: string };

/**
 * Options for usePartyKitPresence hook
 */
interface UsePartyKitPresenceOptions {
  museumId: string | null;
  enabled?: boolean;
}

/**
 * Custom hook for managing PartyKit presence connection
 * Handles real-time visitor presence, position updates, and reconnection logic
 */
export function usePartyKitPresence({
  museumId,
  enabled = true,
}: UsePartyKitPresenceOptions) {
  const { user } = useUser();
  const socketRef = useRef<PartySocket | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Store actions
  const addVisitor = useMuseumStore((state) => state.addVisitor);
  const updateVisitor = useMuseumStore((state) => state.updateVisitor);
  const removeVisitor = useMuseumStore((state) => state.removeVisitor);
  const setVisitorCount = useMuseumStore((state) => state.setVisitorCount);

  // Position update queue for when disconnected
  const positionQueueRef = useRef<VisitorUpdate[]>([]);
  const lastPositionRef = useRef<VisitorUpdate | null>(null);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 10;

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback((attempt: number): number => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter
    return delay + Math.random() * 1000;
  }, []);

  /**
   * Send queued position updates
   */
  const flushPositionQueue = useCallback(() => {
    if (!socketRef.current || positionQueueRef.current.length === 0) return;

    // Send the most recent position from queue
    const latestPosition =
      positionQueueRef.current[positionQueueRef.current.length - 1];
    if (latestPosition) {
      socketRef.current.send(
        JSON.stringify({
          type: "position",
          position: latestPosition.position,
          rotation: latestPosition.rotation,
        })
      );
    }

    positionQueueRef.current = [];
  }, []);

  /**
   * Connect to PartyKit server
   */
  const connect = useCallback(() => {
    if (!museumId || !enabled) return;

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnectionStatus("connecting");

    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";
    const protocol = host.includes("localhost") ? "ws" : "wss";

    const socket = new PartySocket({
      host,
      room: museumId,
      party: "museum",
    });

    socket.addEventListener("open", () => {
      console.log(`[PartyKit] Connected to museum ${museumId}`);
      setConnectionStatus("connected");
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Send join message with user info
      const visitorName =
        user?.fullName || user?.username || "Anonymous Visitor";
      socket.send(
        JSON.stringify({
          type: "join",
          name: visitorName,
        })
      );

      // Flush any queued position updates
      flushPositionQueue();
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        switch (message.type) {
          case "visitor_list":
            // Initial visitor list on connection
            message.visitors.forEach((visitor) => {
              if (visitor.id !== socket.id) {
                addVisitor({
                  id: visitor.id,
                  name: visitor.name,
                  position: visitor.position,
                  rotationY: visitor.rotation.y,
                  lastUpdate: visitor.lastUpdate,
                });
              }
            });
            setVisitorCount(message.visitors.length);
            break;

          case "visitor_join":
            // New visitor joined
            if (message.visitor.id !== socket.id) {
              addVisitor({
                id: message.visitor.id,
                name: message.visitor.name,
                position: message.visitor.position,
                rotationY: message.visitor.rotation.y,
                lastUpdate: message.visitor.lastUpdate,
              });
            }
            break;

          case "visitor_leave":
            // Visitor left
            removeVisitor(message.visitorId);
            break;

          case "visitor_position":
            // Visitor position update
            if (message.visitorId !== socket.id) {
              updateVisitor(
                message.visitorId,
                message.position,
                message.rotation.y
              );
            }
            break;

          case "comment_new":
            // Comment event - can be handled by comment components
            window.dispatchEvent(
              new CustomEvent("partykit-comment-new", {
                detail: { frameId: message.frameId, comment: message.comment },
              })
            );
            break;

          case "comment_deleted":
            // Comment deletion event
            window.dispatchEvent(
              new CustomEvent("partykit-comment-deleted", {
                detail: {
                  frameId: message.frameId,
                  commentId: message.commentId,
                },
              })
            );
            break;
        }
      } catch (error) {
        console.error("[PartyKit] Error parsing message:", error);
      }
    });

    socket.addEventListener("close", () => {
      console.log("[PartyKit] Connection closed");
      setConnectionStatus("disconnected");
      setIsConnected(false);

      // Attempt reconnection with exponential backoff
      if (
        enabled &&
        museumId &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        const delay = getReconnectDelay(reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        setConnectionStatus("reconnecting");
        console.log(
          `[PartyKit] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          // Trigger reconnection by updating state
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
          setReconnectTrigger((prev) => prev + 1);
        }, delay);
      } else {
        console.error("[PartyKit] Max reconnection attempts reached");
      }
    });

    socket.addEventListener("error", (error) => {
      console.error("[PartyKit] Connection error:", error);
      setConnectionStatus("disconnected");
      setIsConnected(false);
    });

    socketRef.current = socket;
  }, [
    museumId,
    enabled,
    user,
    addVisitor,
    removeVisitor,
    updateVisitor,
    setVisitorCount,
    flushPositionQueue,
    getReconnectDelay,
  ]);

  /**
   * Broadcast visitor position update (called at 10Hz by the component)
   */
  const broadcastPosition = useCallback(
    (
      position: { x: number; y: number; z: number },
      rotation: { x: number; y: number; z: number }
    ) => {
      const update: VisitorUpdate = { position, rotation };
      lastPositionRef.current = update;

      if (socketRef.current && isConnected) {
        // Send immediately if connected
        socketRef.current.send(
          JSON.stringify({
            type: "position",
            position,
            rotation,
          })
        );
      } else {
        // Queue for later if disconnected
        positionQueueRef.current.push(update);
        // Keep only last 10 updates in queue
        if (positionQueueRef.current.length > 10) {
          positionQueueRef.current = positionQueueRef.current.slice(-10);
        }
      }
    },
    [isConnected]
  );

  /**
   * Broadcast comment event (for integration with comment system)
   */
  const broadcastComment = useCallback(
    (
      frameId: string,
      text: string,
      authorName: string,
      authorPicture?: string
    ) => {
      if (socketRef.current && isConnected) {
        socketRef.current.send(
          JSON.stringify({
            type: "comment",
            frameId,
            text,
            authorName,
            authorPicture,
          })
        );
      }
    },
    [isConnected]
  );

  /**
   * Broadcast comment deletion event
   */
  const broadcastCommentDelete = useCallback(
    (frameId: string, commentId: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.send(
          JSON.stringify({
            type: "comment_delete",
            frameId,
            commentId,
          })
        );
      }
    },
    [isConnected]
  );

  /**
   * Disconnect from PartyKit server
   */
  const disconnect = useCallback(() => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnectionStatus("disconnected");
    setIsConnected(false);
  }, []);

  // Connect when museum ID changes, enabled changes, or reconnect is triggered
  useEffect(() => {
    if (museumId && enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [museumId, enabled, reconnectTrigger, connect, disconnect]);

  return {
    connectionStatus,
    isConnected,
    broadcastPosition,
    broadcastComment,
    broadcastCommentDelete,
    disconnect,
  };
}
