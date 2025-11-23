import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/lib/db";
import { museums, frames } from "@/lib/db/schema";
import { Storage } from "@google-cloud/storage";

// Lazy initialization of Google Cloud Storage for public image access
let storage: Storage | null = null;
let bucket: ReturnType<Storage["bucket"]> | null = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS
        ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
        : undefined,
    });
  }
  return storage;
}

function getBucket() {
  if (!bucket) {
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Google Cloud Storage bucket not configured.",
      });
    }
    bucket = getStorage().bucket(bucketName);
  }
  return bucket;
}

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
      rateLimitMap.set(identifier, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW,
      });
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
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
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

  /**
   * Get signed URL for accessing an image (public access for shared museums/frames)
   * Returns a URL that expires after the specified duration
   */
  getImageSignedUrl: rateLimitMiddleware
    .input(
      z.object({
        filename: z.string(),
        expiresIn: z.number().min(60).max(86400).optional().default(3600), // 1 hour default
      })
    )
    .query(async ({ input }) => {
      try {
        const bucketInstance = getBucket();
        const file = bucketInstance.file(input.filename);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Image not found.",
          });
        }

        // Generate signed URL
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + input.expiresIn * 1000,
        });

        return {
          url: signedUrl,
          expiresAt: new Date(Date.now() + input.expiresIn * 1000),
        };
      } catch (error) {
        console.error("Error generating signed URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate signed URL.",
        });
      }
    }),
});

/**
 * Calculate spawn position for camera based on frame position
 * Returns coordinates in front of the specified frame
 */
function calculateSpawnPosition(
  position: number,
  side: string | null
): {
  x: number;
  y: number;
  z: number;
  lookAt: { x: number; y: number; z: number };
} {
  const MAIN_HALL_WIDTH = 40;
  const MAIN_HALL_DEPTH = 30;
  const FRAME_HEIGHT = 5;

  // Front entrance wall: positions 0-2
  if (position >= 0 && position < 3) {
    const x = (position - 1) * 10; // -10, 0, 10
    const z = -8; // Spawn inside museum, facing the entrance wall

    return {
      x,
      y: 1.6, // Eye level
      z,
      lookAt: { x, y: FRAME_HEIGHT, z: -0.3 }, // Look at frame on entrance wall
    };
  }

  // Left wall: positions 3-5
  if (position >= 3 && position < 6) {
    const wallIndex = position - 3;
    const frameZ = -(wallIndex * 10 + 5);
    const x = -MAIN_HALL_WIDTH / 2 + 5; // Spawn 5 units from left wall

    return {
      x,
      y: 1.6,
      z: frameZ,
      lookAt: { x: -MAIN_HALL_WIDTH / 2 + 0.3, y: FRAME_HEIGHT, z: frameZ }, // Look at left wall frame
    };
  }

  // Right wall: positions 6-8
  if (position >= 6 && position < 9) {
    const wallIndex = position - 6;
    const frameZ = -(wallIndex * 10 + 5);
    const x = MAIN_HALL_WIDTH / 2 - 5; // Spawn 5 units from right wall

    return {
      x,
      y: 1.6,
      z: frameZ,
      lookAt: { x: MAIN_HALL_WIDTH / 2 - 0.3, y: FRAME_HEIGHT, z: frameZ }, // Look at right wall frame
    };
  }

  // Extendable Hall frames (positions 9+)
  // Frames alternate left-right along the corridor
  const HALL_WIDTH = 10;
  const HALL_SEGMENT_LENGTH = 8;
  const extendableIndex = position - 9;
  const segmentIndex = Math.floor(extendableIndex / 2);

  // Actual frame position matches MuseumLayout
  const isLeftSide = side === "left";
  const frameX = isLeftSide ? -HALL_WIDTH / 2 + 0.3 : HALL_WIDTH / 2 - 0.3;
  const frameY = 4;
  const frameZ = -MAIN_HALL_DEPTH - HALL_SEGMENT_LENGTH * (segmentIndex + 0.5);

  // Spawn in center of hall, facing the frame
  return {
    x: 0,
    y: 1.6, // Eye level
    z: frameZ,
    lookAt: { x: frameX, y: frameY, z: frameZ }, // Look at the frame
  };
}
