import type * as Party from "partykit/server";

/**
 * Visitor metadata stored in presence map
 */
interface VisitorMetadata {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  lastUpdate: number;
}

/**
 * Message types for client-server communication
 */
type MessageType =
  | { type: "join"; name: string }
  | {
      type: "position";
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
    }
  | {
      type: "comment";
      frameId: string;
      text: string;
      authorName: string;
      authorPicture?: string;
    }
  | { type: "comment_delete"; frameId: string; commentId: string };

/**
 * Rate limiter for position updates
 */
class RateLimiter {
  private limits: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  check(key: string): boolean {
    const now = Date.now();
    const record = this.limits.get(key);

    if (!record || now > record.resetAt) {
      // Reset or create new record
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    record.count++;
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.limits.entries()) {
      if (now > record.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * PartyKit server for real-time multiplayer presence in 3D museum
 * Handles visitor presence, position updates, and comment broadcasts
 */
export default class MuseumServer implements Party.Server {
  private visitors: Map<string, VisitorMetadata> = new Map();
  private positionRateLimiter: RateLimiter;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(readonly room: Party.Room) {
    // Rate limit: max 10 position updates per second per visitor
    this.positionRateLimiter = new RateLimiter(1000, 10);
  }

  onConnect(conn: Party.Connection) {
    console.log(`[Museum ${this.room.id}] Visitor ${conn.id} connected`);

    // Send current visitor list to new connection
    const visitorList = Array.from(this.visitors.values());
    conn.send(
      JSON.stringify({
        type: "visitor_list",
        visitors: visitorList,
      })
    );

    // Start cleanup interval if not already running
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.positionRateLimiter.cleanup();
      }, 60000); // Clean up every minute
    }
  }

  onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    try {
      // Parse message
      const msg = typeof message === "string" ? JSON.parse(message) : null;
      if (!msg || typeof msg !== "object") return;

      const typedMsg = msg as MessageType;

      switch (typedMsg.type) {
        case "join":
          this.handleJoin(sender.id, typedMsg.name);
          break;

        case "position":
          this.handlePositionUpdate(
            sender.id,
            typedMsg.position,
            typedMsg.rotation
          );
          break;

        case "comment":
          this.handleComment(sender.id, typedMsg);
          break;

        case "comment_delete":
          this.handleCommentDelete(sender.id, typedMsg);
          break;

        default:
          console.warn(
            `[Museum ${this.room.id}] Unknown message type from ${sender.id}`
          );
      }
    } catch (error) {
      console.error(
        `[Museum ${this.room.id}] Error processing message:`,
        error
      );
    }
  }

  onClose(conn: Party.Connection) {
    console.log(`[Museum ${this.room.id}] Visitor ${conn.id} disconnected`);

    // Remove visitor from presence map
    this.visitors.delete(conn.id);

    // Broadcast leave event to all remaining visitors
    this.room.broadcast(
      JSON.stringify({
        type: "visitor_leave",
        visitorId: conn.id,
      }),
      [conn.id] // Exclude the disconnected connection
    );
  }

  onError(conn: Party.Connection, error: Error) {
    console.error(
      `[Museum ${this.room.id}] Error for visitor ${conn.id}:`,
      error
    );
  }

  /**
   * Handle visitor join event
   */
  private handleJoin(visitorId: string, name: string) {
    const visitor: VisitorMetadata = {
      id: visitorId,
      name: name || "Anonymous Visitor",
      position: { x: 0, y: 1.6, z: 5 }, // Default spawn position
      rotation: { x: 0, y: 0, z: 0 },
      lastUpdate: Date.now(),
    };

    this.visitors.set(visitorId, visitor);

    // Broadcast new visitor to all other connections
    this.room.broadcast(
      JSON.stringify({
        type: "visitor_join",
        visitor,
      }),
      [visitorId] // Exclude the new visitor (they already know they joined)
    );

    console.log(
      `[Museum ${this.room.id}] Visitor ${name} (${visitorId}) joined`
    );
  }

  /**
   * Handle position update with rate limiting
   */
  private handlePositionUpdate(
    visitorId: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ) {
    // Check rate limit
    if (!this.positionRateLimiter.check(visitorId)) {
      // Rate limit exceeded, silently drop the update
      return;
    }

    const visitor = this.visitors.get(visitorId);
    if (!visitor) {
      console.warn(
        `[Museum ${this.room.id}] Position update from unknown visitor ${visitorId}`
      );
      return;
    }

    // Update visitor position
    visitor.position = position;
    visitor.rotation = rotation;
    visitor.lastUpdate = Date.now();

    // Broadcast position update to all other visitors
    this.room.broadcast(
      JSON.stringify({
        type: "visitor_position",
        visitorId,
        position,
        rotation,
      }),
      [visitorId] // Exclude sender
    );
  }

  /**
   * Handle comment broadcast
   */
  private handleComment(
    visitorId: string,
    data: {
      frameId: string;
      text: string;
      authorName: string;
      authorPicture?: string;
    }
  ) {
    const visitor = this.visitors.get(visitorId);
    if (!visitor) {
      console.warn(
        `[Museum ${this.room.id}] Comment from unknown visitor ${visitorId}`
      );
      return;
    }

    // Broadcast comment to all visitors (including sender for confirmation)
    this.room.broadcast(
      JSON.stringify({
        type: "comment_new",
        frameId: data.frameId,
        comment: {
          text: data.text,
          authorName: data.authorName,
          authorPicture: data.authorPicture,
          timestamp: Date.now(),
        },
      })
    );

    console.log(
      `[Museum ${this.room.id}] Comment broadcast for frame ${data.frameId}`
    );
  }

  /**
   * Handle comment deletion broadcast
   */
  private handleCommentDelete(
    visitorId: string,
    data: { frameId: string; commentId: string }
  ) {
    // Broadcast comment deletion to all visitors
    this.room.broadcast(
      JSON.stringify({
        type: "comment_deleted",
        frameId: data.frameId,
        commentId: data.commentId,
      })
    );

    console.log(
      `[Museum ${this.room.id}] Comment deletion broadcast for frame ${data.frameId}`
    );
  }
}

MuseumServer satisfies Party.Worker;
