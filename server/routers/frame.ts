import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { frames, museums, users } from "@/lib/db/schema";

/**
 * Frame router - handles frame CRUD operations
 * All routes require authentication
 */
export const frameRouter = createTRPCRouter({
  /**
   * List all frames in a museum
   */
  listByMuseum: protectedProcedure
    .input(
      z.object({
        museumId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Verify museum ownership
      const museum = await db.query.museums.findFirst({
        where: and(
          eq(museums.id, input.museumId)
          // eq(museums.userId, user.id)
        ),
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      // Get all frames for the museum
      const museumFrames = await db.query.frames.findMany({
        where: eq(frames.museumId, input.museumId),
        orderBy: (frames, { asc }) => [asc(frames.position)],
      });

      return museumFrames;
    }),

  /**
   * Create or update frame with image
   * Validates max 30 frames per museum
   */
  create: protectedProcedure
    .input(
      z.object({
        museumId: z.string(),
        position: z.number().int().min(0).max(29), // Max 30 frames (0-29)
        side: z.enum(["left", "right"]).nullable().optional(),
        imageUrl: z.string(), // Removed .url() validation to allow gs:// URLs
        description: z.string().max(1000).optional(),
        themeColors: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Verify museum ownership
      const museum = await db.query.museums.findFirst({
        where: and(eq(museums.id, input.museumId), eq(museums.userId, user.id)),
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      // Check if frame already exists at this position
      const existingFrame = await db.query.frames.findFirst({
        where: and(
          eq(frames.museumId, input.museumId),
          eq(frames.position, input.position)
        ),
      });

      let frame;

      if (existingFrame) {
        // Update existing frame
        const [updatedFrame] = await db
          .update(frames)
          .set({
            imageUrl: input.imageUrl,
            description: input.description,
            themeColors: input.themeColors,
            side: input.side,
            updatedAt: new Date(),
          })
          .where(eq(frames.id, existingFrame.id))
          .returning();

        frame = updatedFrame;
      } else {
        // Check frame count limit (max 30 frames per museum)
        const frameCount = await db.query.frames.findMany({
          where: eq(frames.museumId, input.museumId),
        });

        if (frameCount.length >= 30) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum of 30 frames per museum reached",
          });
        }

        // Create new frame
        const [newFrame] = await db
          .insert(frames)
          .values({
            museumId: input.museumId,
            position: input.position,
            side: input.side,
            imageUrl: input.imageUrl,
            description: input.description,
            themeColors: input.themeColors,
          })
          .returning();

        frame = newFrame;
      }

      return frame;
    }),

  /**
   * Delete frame image (converts filled frame to empty frame)
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Get frame with museum info
      const frame = await db.query.frames.findFirst({
        where: eq(frames.id, input.id),
        with: {
          museum: true,
        },
      });

      if (!frame) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Frame not found",
        });
      }

      // Verify museum ownership
      if (frame.museum.userId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this frame",
        });
      }

      // Remove image data (convert to empty frame)
      const [updatedFrame] = await db
        .update(frames)
        .set({
          imageUrl: null,
          description: null,
          themeColors: null,
          shareToken: null,
          updatedAt: new Date(),
        })
        .where(eq(frames.id, input.id))
        .returning();

      return updatedFrame;
    }),

  /**
   * Generate unique share link for frame
   */
  generateShareLink: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Get frame with museum info
      const frame = await db.query.frames.findFirst({
        where: eq(frames.id, input.id),
        with: {
          museum: true,
        },
      });

      if (!frame) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Frame not found",
        });
      }

      // Verify museum ownership
      if (frame.museum.userId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to share this frame",
        });
      }

      // Verify frame has an image
      if (!frame.imageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot share an empty frame",
        });
      }

      // Generate new share token if one doesn't exist
      const shareToken = frame.shareToken || createId();

      const [updatedFrame] = await db
        .update(frames)
        .set({
          shareToken,
          updatedAt: new Date(),
        })
        .where(eq(frames.id, input.id))
        .returning();

      return {
        shareToken: updatedFrame.shareToken,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/frame/${
          updatedFrame.shareToken
        }`,
      };
    }),
});
