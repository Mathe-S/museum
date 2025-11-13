import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/lib/db";
import { museums, frames } from "@/lib/db/schema";

/**
 * Simple in-memory rate limiter for public endpoints
 * Tracks requests per IP address
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

/**
 * Rate limiting middleware for public procedures
 * Limits requests to 30 per minute per user/session
 */
const rateLimitMiddleware = publicProcedure.use(async ({ ctx, next }) => {
  // Use userId if authenticated, otherwise use a generic identifier
  // In production, you would extract IP from request headers
  const identifier = ctx.userId || "anonymous";

  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (record) {
    // Check if window has expired
    if (now > record.resetAt) {
      // Reset the counter
      rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    } else if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
      // Rate limit exceeded
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      });
    } else {
      // Increment counter
      record.count++;
    }
  } else {
    // First request from this identifier
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
  }

  // Clean up old entries periodically (every 100 requests)
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  return next();
});

/**
 * Public router - handles public access to museums and frames
 * No authentication required, but rate limited
 */
export const publicRouter = createTRPCRouter({
  /**
   * Get museum by share token for public access
   * Returns museum data with all frames if museum is public
   */
  getMuseumByShareToken: rateLimitMiddleware
    .input(
      z.object({
        shareToken: z.string(),
      })
    )
    .query(async ({ input }) => {
      // Find museum by share token
      const museum = await db.query.museums.findFirst({
        where: eq(museums.shareToken, input.shareToken),
        with: {
          frames: {
            orderBy: (frames, { asc }) => [asc(frames.position)],
          },
        },
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or link is invalid",
        });
      }

      // Check if museum is public
      if (!museum.isPublic) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This museum is private",
        });
      }

      // Return museum data without sensitive user information
      return {
        id: museum.id,
        name: museum.name,
        themeMode: museum.themeMode,
        frames: museum.frames,
        createdAt: museum.createdAt,
      };
    }),

  /**
   * Get frame by share token for frame-specific links
   * Returns frame data with museum context and spawn position
   */
  getFrameByShareToken: rateLimitMiddleware
    .input(
      z.object({
        shareToken: z.string(),
      })
    )
    .query(async ({ input }) => {
      // Find frame by share token
      const frame = await db.query.frames.findFirst({
        where: eq(frames.shareToken, input.shareToken),
        with: {
          museum: {
            with: {
              frames: {
                orderBy: (frames, { asc }) => [asc(frames.position)],
              },
            },
          },
        },
      });

      if (!frame) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Frame not found or link is invalid",
        });
      }

      // Check if museum is public
      if (!frame.museum.isPublic) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This museum is private",
        });
      }

      // Check if frame has an image
      if (!frame.imageUrl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This frame is empty",
        });
      }

      // Calculate spawn position based on frame position
      // This will be used by the 3D scene to position the camera
      const spawnPosition = calculateSpawnPosition(frame.position, frame.side);

      // Return frame data with museum context
      return {
        frame: {
          id: frame.id,
          position: frame.position,
          side: frame.side,
          imageUrl: frame.imageUrl,
          description: frame.description,
          themeColors: frame.themeColors,
          createdAt: frame.createdAt,
        },
        museum: {
          id: frame.museum.id,
          name: frame.museum.name,
          themeMode: frame.museum.themeMode,
          frames: frame.museum.frames,
          createdAt: frame.museum.createdAt,
        },
        spawnPosition,
      };
    }),
});

/**
 * Calculate spawn position for camera based on frame position
 * Returns coordinates in front of the specified frame
 */
function calculateSpawnPosition(
  position: number,
  side: string | null
): { x: number; y: number; z: number; lookAt: { x: number; y: number; z: number } } {
  // Main Hall frames (positions 0-8) are arranged in a 3x3 grid on the back wall
  if (position >= 0 && position <= 8) {
    const row = Math.floor(position / 3); // 0, 1, or 2
    const col = position % 3; // 0, 1, or 2

    // Calculate position in front of the frame
    // Assuming frames are centered at x: -10, 0, 10 and y: 5, 2.5, 0
    const x = (col - 1) * 10; // -10, 0, 10
    const y = 2.5 - row * 2.5; // 5, 2.5, 0
    const z = -15; // Back wall is at z: -20, spawn 5 units in front

    return {
      x,
      y: 1.6, // Eye level
      z,
      lookAt: { x, y, z: -20 }, // Look at the back wall
    };
  }

  // Extendable Hall frames (positions 9+)
  // Frames alternate left-right along the corridor
  const hallPosition = position - 9;
  const distanceAlongHall = hallPosition * 8; // 8 units between frames

  // Determine which side the frame is on
  const isLeftSide = side === "left";
  const z = distanceAlongHall + 5; // Start after main hall

  return {
    x: isLeftSide ? -2 : 2, // Spawn slightly offset from center
    y: 1.6, // Eye level
    z,
    lookAt: { x: isLeftSide ? -8 : 8, y: 2, z }, // Look at the frame
  };
}
